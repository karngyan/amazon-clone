import { createServerFn } from '@tanstack/react-start'
import { expandCategory } from '#/lib/catalog'
import type { Address, CartLine, Order, OrderItem, Review, SearchParams } from '#/lib/types'
import {
  CARD_COLS,
  allow,
  clientIp,
  cartOwner,
  clearSid,
  currentUser,
  db,
  ensureSid,
  hashPassword,
  peekSid,
  requireUser,
  safeEqual,
  toCard,
  toProduct,
} from './core'

const PAGE_SIZE = 16
const FREE_SHIPPING_MIN = 35
const TAX_RATE = 0.0825

// Abuse ceilings for a public demo with open sign-up.
const MAX_USERS = 500
const SLOW_DOWN = 'Too many attempts. Please wait a few minutes and try again.'

const DELIVERY = {
  free: { label: 'FREE delivery', days: 4, cost: 0 },
  fast: { label: 'Fastest delivery', days: 1, cost: 9.99 },
} as const

// ---------- shell ----------

export const getShell = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await currentUser()
  const owner = user ? `u:${user.id}` : peekSid() ? `s:${peekSid()}` : null
  const row = owner
    ? await db()
        .prepare('SELECT COALESCE(SUM(qty), 0) AS n FROM cart_items WHERE owner = ? AND saved = 0')
        .bind(owner)
        .first<{ n: number }>()
    : null
  return { user, cartCount: row?.n ?? 0 }
})

// ---------- catalogue ----------

export const getHome = createServerFn({ method: 'GET' }).handler(async () => {
  const rail = async (where: string, order: string, limit = 14) =>
    (await db().prepare(`SELECT ${CARD_COLS} FROM products p WHERE ${where} ORDER BY ${order} LIMIT ${limit}`).all())
      .results.map(toCard)
  const quad = async (cats: string[]) =>
    (
      await db()
        .prepare(
          `SELECT ${CARD_COLS} FROM products p WHERE p.category IN (${cats.map(() => '?').join(',')}) ORDER BY p.sold DESC LIMIT 4`,
        )
        .bind(...cats)
        .all()
    ).results.map(toCard)

  const [deals, bestsellers, topRated, electronics, fashion, home, beauty, grocery] = await Promise.all([
    rail('p.list_price > p.price', '(1 - p.price / p.list_price) DESC'),
    rail('1=1', 'p.sold DESC'),
    rail('p.review_count > 500', 'p.rating DESC, p.review_count DESC'),
    quad(['smartphones', 'laptops', 'tablets', 'mobile-accessories']),
    quad(['womens-dresses', 'mens-shirts', 'womens-bags', 'mens-shoes']),
    quad(['furniture', 'home-decoration', 'kitchen-accessories']),
    quad(['beauty', 'fragrances', 'skin-care']),
    quad(['groceries']),
  ])
  return { deals, bestsellers, topRated, quads: { electronics, fashion, home, beauty, grocery } }
})

const clean = (s: SearchParams): SearchParams => s

export const searchProducts = createServerFn({ method: 'GET' })
  .validator(clean)
  .handler(async ({ data }) => {
    const where: string[] = []
    const args: (string | number)[] = []
    const terms = (data.q ?? '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6)
    for (const t of terms) {
      // Naive stemming so "headphones" still finds "headphone".
      const stem = t.length > 3 ? t.replace(/(es|s)$/, '') : t
      where.push('(lower(p.title) LIKE ? OR lower(p.brand) LIKE ? OR lower(p.tags) LIKE ? OR lower(p.category) LIKE ? OR lower(p.description) LIKE ?)')
      args.push(...Array(5).fill(`%${stem}%`))
    }
    if (data.category) {
      const cats = expandCategory(data.category)
      where.push(`p.category IN (${cats.map(() => '?').join(',')})`)
      args.push(...cats)
    }
    // Facets are computed before price/rating filters so the sidebar stays useful.
    const baseWhere = where.length ? where.join(' AND ') : '1=1'
    const baseArgs = [...args]

    if (data.min != null) (where.push('p.price >= ?'), args.push(data.min))
    if (data.max != null) (where.push('p.price <= ?'), args.push(data.max))
    if (data.rating) (where.push('p.rating >= ?'), args.push(data.rating))
    if (data.prime) where.push('p.prime = 1')
    if (data.deals) where.push('p.list_price > p.price * 1.1')

    const order = {
      featured: terms.length ? `(CASE WHEN lower(p.title) LIKE ? THEN 0 ELSE 1 END), p.sold DESC` : 'p.sold DESC',
      'price-asc': 'p.price ASC',
      'price-desc': 'p.price DESC',
      rating: 'p.rating DESC, p.review_count DESC',
      newest: 'p.id DESC',
      bestsellers: 'p.sold DESC',
    }[data.sort ?? 'featured']
    const orderArgs = (data.sort ?? 'featured') === 'featured' && terms.length ? [`%${terms[0]}%`] : []

    const w = where.length ? where.join(' AND ') : '1=1'
    const page = Math.max(1, data.page ?? 1)
    const [rows, count, cats, brands] = await Promise.all([
      db()
        .prepare(`SELECT ${CARD_COLS} FROM products p WHERE ${w} ORDER BY ${order} LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`)
        .bind(...args, ...orderArgs)
        .all(),
      db().prepare(`SELECT COUNT(*) AS n FROM products p WHERE ${w}`).bind(...args).first<{ n: number }>(),
      db()
        .prepare(`SELECT p.category AS slug, COUNT(*) AS n FROM products p WHERE ${baseWhere} GROUP BY p.category ORDER BY n DESC`)
        .bind(...baseArgs)
        .all<{ slug: string; n: number }>(),
      db()
        .prepare(`SELECT p.brand AS brand, COUNT(*) AS n FROM products p WHERE ${baseWhere} AND p.brand IS NOT NULL GROUP BY p.brand ORDER BY n DESC LIMIT 8`)
        .bind(...baseArgs)
        .all<{ brand: string; n: number }>(),
    ])
    const total = count?.n ?? 0
    return {
      items: rows.results.map(toCard),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      pageSize: PAGE_SIZE,
      facets: { categories: cats.results, brands: brands.results },
    }
  })

export const suggest = createServerFn({ method: 'GET' })
  .validator((d: { q: string }) => d)
  .handler(async ({ data }) => {
    const q = data.q.trim().toLowerCase()
    if (q.length < 2) return []
    const rows = await db()
      .prepare(
        `SELECT p.id, p.title, p.thumbnail FROM products p
         WHERE lower(p.title) LIKE ? OR lower(p.brand) LIKE ? OR lower(p.tags) LIKE ?
         ORDER BY (CASE WHEN lower(p.title) LIKE ? THEN 0 ELSE 1 END), p.sold DESC LIMIT 8`,
      )
      .bind(`%${q}%`, `%${q}%`, `%${q}%`, `${q}%`)
      .all<{ id: number; title: string; thumbnail: string }>()
    return rows.results
  })

export const getProduct = createServerFn({ method: 'GET' })
  .validator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    const row = await db().prepare('SELECT * FROM products p WHERE p.id = ?').bind(data.id).first()
    if (!row) return null
    const product = toProduct(row)
    const user = await currentUser()
    const [reviews, hist, related, alsoBought, listed] = await Promise.all([
      db()
        .prepare('SELECT id, name, rating, title, body, verified, created_at FROM reviews WHERE product_id = ? ORDER BY created_at DESC LIMIT 30')
        .bind(data.id)
        .all<{ id: number; name: string; rating: number; title: string; body: string; verified: number; created_at: string }>(),
      db().prepare('SELECT rating, COUNT(*) AS n FROM reviews WHERE product_id = ? GROUP BY rating').bind(data.id).all<{ rating: number; n: number }>(),
      db()
        .prepare(`SELECT ${CARD_COLS} FROM products p WHERE p.category = ? AND p.id != ? ORDER BY p.sold DESC LIMIT 12`)
        .bind(product.category, data.id)
        .all(),
      db()
        .prepare(`SELECT ${CARD_COLS} FROM products p WHERE p.category != ? ORDER BY ((p.id * 7919 + ?) % 97) LIMIT 12`)
        .bind(product.category, data.id)
        .all(),
      user
        ? db().prepare('SELECT 1 AS x FROM list_items WHERE user_id = ? AND product_id = ?').bind(user.id, data.id).first()
        : null,
    ])
    const histogram = [5, 4, 3, 2, 1].map((r) => ({ rating: r, n: hist.results.find((h) => h.rating === r)?.n ?? 0 }))
    return {
      product,
      reviews: reviews.results.map(
        (r): Review => ({ id: r.id, name: r.name, rating: r.rating, title: r.title, body: r.body, verified: !!r.verified, createdAt: r.created_at }),
      ),
      histogram,
      related: related.results.map(toCard),
      alsoBought: alsoBought.results.map(toCard),
      inList: !!listed,
    }
  })

export const getProductsByIds = createServerFn({ method: 'GET' })
  .validator((d: { ids: number[] }) => d)
  .handler(async ({ data }) => {
    const ids = data.ids.filter(Number.isInteger).slice(0, 20)
    if (!ids.length) return []
    const rows = await db()
      .prepare(`SELECT ${CARD_COLS} FROM products p WHERE p.id IN (${ids.map(() => '?').join(',')})`)
      .bind(...ids)
      .all()
    const cards = rows.results.map(toCard)
    return ids.map((id) => cards.find((c) => c.id === id)!).filter(Boolean)
  })

export const addReview = createServerFn({ method: 'POST' })
  .validator((d: { productId: number; rating: number; title: string; body: string }) => d)
  .handler(async ({ data }) => {
    const user = await requireUser()
    const rating = Math.min(5, Math.max(1, Math.round(data.rating)))
    const title = data.title.trim().slice(0, 120)
    const body = data.body.trim().slice(0, 4000)
    if (!title || !body) throw new Error('Please add a headline and a written review.')
    if (!(await allow(`review:${user.id}`, 10, 86400))) throw new Error('You have reached the daily review limit.')
    const bought = await db()
      .prepare(`SELECT 1 AS x FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.user_id = ? AND oi.product_id = ? AND o.status != 'cancelled'`)
      .bind(user.id, data.productId)
      .first()
    await db().batch([
      db()
        .prepare('INSERT INTO reviews (product_id, user_id, name, rating, title, body, verified) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(data.productId, user.id, user.name, rating, title, body, bought ? 1 : 0),
      db()
        .prepare('UPDATE products SET rating = ROUND((rating * review_count + ?) / (review_count + 1), 1), review_count = review_count + 1 WHERE id = ?')
        .bind(rating, data.productId),
    ])
    return { ok: true }
  })

// ---------- cart ----------

async function loadCart(owner: string | null): Promise<CartLine[]> {
  if (!owner) return []
  const rows = await db()
    .prepare(`SELECT ${CARD_COLS}, c.qty, c.saved FROM cart_items c JOIN products p ON p.id = c.product_id WHERE c.owner = ? ORDER BY c.created_at DESC`)
    .bind(owner)
    .all<{ qty: number; saved: number }>()
  return rows.results.map((r) => ({ ...toCard(r), qty: r.qty, saved: !!r.saved }))
}

export const getCart = createServerFn({ method: 'GET' }).handler(async () => loadCart(await cartOwner(false)))

export const addToCart = createServerFn({ method: 'POST' })
  .validator((d: { productId: number; qty?: number }) => d)
  .handler(async ({ data }) => {
    const owner = (await cartOwner(true))!
    const qty = Math.min(10, Math.max(1, data.qty ?? 1))
    await db()
      .prepare(
        `INSERT INTO cart_items (owner, product_id, qty) VALUES (?, ?, ?)
         ON CONFLICT(owner, product_id) DO UPDATE SET qty = MIN(10, CASE WHEN saved = 1 THEN excluded.qty ELSE qty + excluded.qty END), saved = 0`,
      )
      .bind(owner, data.productId, qty)
      .run()
    return { ok: true }
  })

export const updateCartItem = createServerFn({ method: 'POST' })
  .validator((d: { productId: number; qty?: number; saved?: boolean }) => d)
  .handler(async ({ data }) => {
    const owner = await cartOwner(false)
    if (!owner) return { ok: false }
    if (data.qty != null && data.qty <= 0) {
      await db().prepare('DELETE FROM cart_items WHERE owner = ? AND product_id = ?').bind(owner, data.productId).run()
    } else {
      await db()
        .prepare('UPDATE cart_items SET qty = COALESCE(?, qty), saved = COALESCE(?, saved) WHERE owner = ? AND product_id = ?')
        .bind(data.qty != null ? Math.min(10, data.qty) : null, data.saved == null ? null : data.saved ? 1 : 0, owner, data.productId)
        .run()
    }
    return { ok: true }
  })

// ---------- auth ----------

async function attachSession(userId: number) {
  const sid = await ensureSid()
  // Guest cart follows the shopper into their account.
  await db().batch([
    db().prepare('UPDATE sessions SET user_id = ? WHERE id = ?').bind(userId, sid),
    db()
      .prepare(
        `INSERT INTO cart_items (owner, product_id, qty, saved, created_at)
         SELECT ?, product_id, qty, saved, created_at FROM cart_items WHERE owner = ?
         ON CONFLICT(owner, product_id) DO UPDATE SET qty = MIN(10, qty + excluded.qty), saved = 0`,
      )
      .bind(`u:${userId}`, `s:${sid}`),
    db().prepare('DELETE FROM cart_items WHERE owner = ?').bind(`s:${sid}`),
  ])
}

export const signUp = createServerFn({ method: 'POST' })
  .validator((d: { name: string; email: string; password: string }) => d)
  .handler(async ({ data }) => {
    const name = data.name.trim().slice(0, 80)
    const email = data.email.trim().toLowerCase()
    if (!name) return { error: 'Enter your name' }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address' }
    if (data.password.length < 6 || data.password.length > 200) return { error: 'Passwords must be at least 6 characters' }
    if (!(await allow(`signup:${clientIp()}`, 5, 3600))) return { error: SLOW_DOWN }
    const users = await db().prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>()
    if ((users?.n ?? 0) >= MAX_USERS)
      return { error: 'This demo has reached its sign-up limit. You can still browse and use the cart as a guest.' }
    const exists = await db().prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
    if (exists) return { error: 'An account with this email already exists. Sign in instead.' }
    const { hash, salt } = await hashPassword(data.password)
    const res = await db()
      .prepare('INSERT INTO users (email, name, password_hash, salt) VALUES (?, ?, ?, ?)')
      .bind(email, name, hash, salt)
      .run()
    await attachSession(res.meta.last_row_id)
    return { ok: true }
  })

export const signIn = createServerFn({ method: 'POST' })
  .validator((d: { email: string; password: string }) => d)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase()
    if (!(await allow(`signin:${clientIp()}`, 15, 600))) return { error: SLOW_DOWN }
    const row = await db()
      .prepare('SELECT id, password_hash, salt FROM users WHERE email = ?')
      .bind(email)
      .first<{ id: number; password_hash: string; salt: string }>()
    if (!row) return { error: 'We cannot find an account with that email address' }
    const { hash } = await hashPassword(data.password, row.salt)
    if (!safeEqual(hash, row.password_hash)) return { error: 'Your password is incorrect' }
    await attachSession(row.id)
    return { ok: true }
  })

export const signOut = createServerFn({ method: 'POST' }).handler(async () => {
  const sid = peekSid()
  if (sid) await db().prepare('DELETE FROM sessions WHERE id = ?').bind(sid).run()
  clearSid()
  return { ok: true }
})

// ---------- addresses ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toAddress = (r: any): Address => ({
  id: r.id,
  fullName: r.full_name,
  line1: r.line1,
  line2: r.line2,
  city: r.city,
  state: r.state,
  zip: r.zip,
  country: r.country,
  phone: r.phone,
  isDefault: !!r.is_default,
})

async function loadAddresses(userId: number) {
  const rows = await db().prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC').bind(userId).all()
  return rows.results.map(toAddress)
}

export const getAddresses = createServerFn({ method: 'GET' }).handler(async () => loadAddresses((await requireUser()).id))

export const saveAddress = createServerFn({ method: 'POST' })
  .validator((d: Omit<Address, 'id' | 'isDefault'> & { isDefault?: boolean }) => d)
  .handler(async ({ data }) => {
    const user = await requireUser()
    for (const k of ['fullName', 'line1', 'city', 'state', 'zip'] as const)
      if (!data[k]?.trim()) return { error: 'Please fill in all required fields.' }
    if (Object.values(data).some((v) => typeof v === 'string' && v.length > 200)) return { error: 'One of the fields is too long.' }
    const count = await db().prepare('SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?').bind(user.id).first<{ n: number }>()
    if ((count?.n ?? 0) >= 10) return { error: 'You can save up to 10 addresses.' }
    const first = !(await db().prepare('SELECT 1 AS x FROM addresses WHERE user_id = ?').bind(user.id).first())
    const makeDefault = first || !!data.isDefault
    if (makeDefault) await db().prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').bind(user.id).run()
    const res = await db()
      .prepare('INSERT INTO addresses (user_id, full_name, line1, line2, city, state, zip, country, phone, is_default) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(user.id, data.fullName.trim(), data.line1.trim(), data.line2?.trim() || null, data.city.trim(), data.state.trim(), data.zip.trim(), data.country?.trim() || 'United States', data.phone?.trim() || null, makeDefault ? 1 : 0)
      .run()
    return { ok: true, id: res.meta.last_row_id }
  })

export const updateAddress = createServerFn({ method: 'POST' })
  .validator((d: { id: number; action: 'delete' | 'default' }) => d)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (data.action === 'delete') {
      await db().prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').bind(data.id, user.id).run()
    } else {
      await db().batch([
        db().prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').bind(user.id),
        db().prepare('UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?').bind(data.id, user.id),
      ])
    }
    return { ok: true }
  })

// ---------- checkout + orders ----------

const totals = (lines: CartLine[], delivery: keyof typeof DELIVERY) => {
  const subtotal = +lines.reduce((s, l) => s + l.price * l.qty, 0).toFixed(2)
  const base = subtotal >= FREE_SHIPPING_MIN || lines.every((l) => l.prime) ? 0 : 6.99
  const shipping = +(base + DELIVERY[delivery].cost).toFixed(2)
  const tax = +(subtotal * TAX_RATE).toFixed(2)
  return { subtotal, shipping, tax, total: +(subtotal + shipping + tax).toFixed(2) }
}

export const getCheckout = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser()
  const [lines, addresses] = await Promise.all([loadCart(`u:${user.id}`), loadAddresses(user.id)])
  const active = lines.filter((l) => !l.saved)
  return { lines: active, addresses, totals: { free: totals(active, 'free'), fast: totals(active, 'fast') } }
})

export const placeOrder = createServerFn({ method: 'POST' })
  .validator((d: { addressId: number; delivery: 'free' | 'fast'; paymentLabel: string }) => d)
  .handler(async ({ data }) => {
    const user = await requireUser()
    const delivery = data.delivery === 'fast' ? 'fast' : 'free'
    if (!(await allow(`order:${user.id}`, 20, 86400))) return { error: 'You have reached the daily order limit for this demo.' }
    const lines = (await loadCart(`u:${user.id}`)).filter((l) => !l.saved)
    if (!lines.length) return { error: 'Your cart is empty.' }
    const addr = await db().prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').bind(data.addressId, user.id).first()
    if (!addr) return { error: 'Choose a delivery address.' }
    const short = lines.find((l) => l.stock < l.qty)
    if (short) return { error: `Only ${short.stock} left of "${short.title}". Update your cart and try again.` }

    const t = totals(lines, delivery)
    const n = () => String(Math.floor(Math.random() * 1e7)).padStart(7, '0')
    const id = `1${n().slice(0, 2)}-${n()}-${n()}`
    const eta = new Date(Date.now() + DELIVERY[delivery].days * 86400000).toISOString()
    const { id: _id, isDefault: _d, ...address } = toAddress(addr)

    await db().batch([
      db()
        .prepare('INSERT INTO orders (id, user_id, subtotal, shipping, tax, total, address, payment_label, delivery_option, eta) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .bind(id, user.id, t.subtotal, t.shipping, t.tax, t.total, JSON.stringify(address), data.paymentLabel.slice(0, 60), DELIVERY[delivery].label, eta),
      ...lines.flatMap((l) => [
        db().prepare('INSERT INTO order_items (order_id, product_id, title, thumbnail, price, qty) VALUES (?,?,?,?,?,?)').bind(id, l.id, l.title, l.thumbnail, l.price, l.qty),
        db().prepare('UPDATE products SET stock = MAX(0, stock - ?), sold = sold + ? WHERE id = ?').bind(l.qty, l.qty, l.id),
      ]),
      db().prepare('DELETE FROM cart_items WHERE owner = ? AND saved = 0').bind(`u:${user.id}`),
    ])
    return { ok: true, orderId: id }
  })

// Orders advance on their own so the demo shows every state: shipped after a
// minute, delivered once the promised date passes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const liveStatus = (o: any): Order['status'] => {
  if (o.status === 'cancelled') return 'cancelled'
  const created = new Date(o.created_at.replace(' ', 'T') + 'Z').getTime()
  if (Date.now() > new Date(o.eta).getTime()) return 'delivered'
  return Date.now() - created > 60_000 ? 'shipped' : 'placed'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toOrder = (o: any, items: OrderItem[]): Order => ({
  id: o.id,
  status: liveStatus(o),
  subtotal: o.subtotal,
  shipping: o.shipping,
  tax: o.tax,
  total: o.total,
  address: JSON.parse(o.address),
  paymentLabel: o.payment_label,
  deliveryOption: o.delivery_option,
  eta: o.eta,
  createdAt: o.created_at,
  items,
})

async function itemsFor(orderIds: string[]) {
  if (!orderIds.length) return new Map<string, OrderItem[]>()
  const rows = await db()
    .prepare(`SELECT order_id, product_id, title, thumbnail, price, qty FROM order_items WHERE order_id IN (${orderIds.map(() => '?').join(',')})`)
    .bind(...orderIds)
    .all<{ order_id: string; product_id: number; title: string; thumbnail: string; price: number; qty: number }>()
  const map = new Map<string, OrderItem[]>()
  for (const r of rows.results)
    map.set(r.order_id, [...(map.get(r.order_id) ?? []), { productId: r.product_id, title: r.title, thumbnail: r.thumbnail, price: r.price, qty: r.qty }])
  return map
}

export const getOrders = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser()
  const rows = await db().prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').bind(user.id).all<{ id: string }>()
  const items = await itemsFor(rows.results.map((o) => o.id))
  return rows.results.map((o) => toOrder(o, items.get(o.id) ?? []))
})

export const getOrder = createServerFn({ method: 'GET' })
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const user = await requireUser()
    const o = await db().prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').bind(data.id, user.id).first()
    if (!o) return null
    return toOrder(o, (await itemsFor([data.id])).get(data.id) ?? [])
  })

export const cancelOrder = createServerFn({ method: 'POST' })
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const user = await requireUser()
    const o = await db().prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').bind(data.id, user.id).first()
    if (!o) return { error: 'Order not found.' }
    if (liveStatus(o) === 'delivered') return { error: 'Delivered orders cannot be cancelled.' }
    if (o.status === 'cancelled') return { ok: true }
    const items = (await itemsFor([data.id])).get(data.id) ?? []
    await db().batch([
      db().prepare(`UPDATE orders SET status = 'cancelled' WHERE id = ?`).bind(data.id),
      ...items.map((i) => db().prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(i.qty, i.productId)),
    ])
    return { ok: true }
  })

// ---------- wish list ----------

export const getList = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser()
  const rows = await db()
    .prepare(`SELECT ${CARD_COLS} FROM list_items l JOIN products p ON p.id = l.product_id WHERE l.user_id = ? ORDER BY l.created_at DESC`)
    .bind(user.id)
    .all()
  return rows.results.map(toCard)
})

export const toggleList = createServerFn({ method: 'POST' })
  .validator((d: { productId: number; on: boolean }) => d)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (data.on)
      await db().prepare('INSERT OR IGNORE INTO list_items (user_id, product_id) VALUES (?, ?)').bind(user.id, data.productId).run()
    else await db().prepare('DELETE FROM list_items WHERE user_id = ? AND product_id = ?').bind(user.id, data.productId).run()
    return { ok: true }
  })
