import { env } from 'cloudflare:workers'
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import type { Product, ProductCard, User } from '#/lib/types'

export const db = () => env.DB

const SID = 'sid'
const YEAR = 60 * 60 * 24 * 365

const token = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Session id from the cookie, without creating one (reads must stay cheap). */
export const peekSid = () => getCookie(SID) ?? null

/** Session id, minted on first write (add to cart, sign in). */
export async function ensureSid() {
  const existing = peekSid()
  if (existing) {
    const row = await db().prepare('SELECT id FROM sessions WHERE id = ?').bind(existing).first()
    if (row) return existing
  }
  const sid = token()
  await db().prepare('INSERT INTO sessions (id) VALUES (?)').bind(sid).run()
  setCookie(SID, sid, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: YEAR })
  return sid
}

export const clearSid = () => deleteCookie(SID, { path: '/' })

export async function currentUser(): Promise<User | null> {
  const sid = peekSid()
  if (!sid) return null
  return db()
    .prepare('SELECT u.id, u.name, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?')
    .bind(sid)
    .first<User>()
}

export async function requireUser() {
  const user = await currentUser()
  if (!user) throw new Error('UNAUTHENTICATED')
  return user
}

/** Cart owner key: the user when signed in, otherwise the guest session. */
export async function cartOwner(create: boolean) {
  const user = await currentUser()
  if (user) return `u:${user.id}`
  const sid = create ? await ensureSid() : peekSid()
  return sid ? `s:${sid}` : null
}

// PBKDF2 via WebCrypto; 100k iterations is the Workers runtime ceiling.
export async function hashPassword(password: string, saltHex?: string) {
  const salt = saltHex
    ? Uint8Array.from(saltHex.match(/../g)!, (h) => parseInt(h, 16))
    : crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 }, key, 256)
  const hex = (a: Uint8Array) => Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
  return { hash: hex(new Uint8Array(bits)), salt: hex(salt) }
}

export const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export const CARD_COLS =
  'p.id, p.title, p.category, p.brand, p.price, p.list_price, p.rating, p.review_count, p.prime, p.thumbnail, p.stock, p.sold'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toCard = (r: any): ProductCard => ({
  id: r.id,
  title: r.title,
  category: r.category,
  brand: r.brand,
  price: r.price,
  listPrice: r.list_price,
  rating: r.rating,
  reviewCount: r.review_count,
  prime: !!r.prime,
  thumbnail: r.thumbnail,
  stock: r.stock,
  sold: r.sold,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toProduct = (r: any): Product => ({
  ...toCard(r),
  description: r.description,
  images: JSON.parse(r.images),
  tags: JSON.parse(r.tags),
  bullets: JSON.parse(r.bullets),
  shipping: r.shipping,
  warranty: r.warranty,
  returnPolicy: r.return_policy,
})
