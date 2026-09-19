import { env } from 'cloudflare:workers'
import { deleteCookie, getCookie, getRequestHeader, setCookie } from '@tanstack/react-start/server'
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

export const clientIp = () => getRequestHeader('cf-connecting-ip') ?? 'local'

/**
 * Fixed-window rate limit backed by D1. Returns false once `limit` hits have
 * landed in the current window. Public demo, so every write path goes through this.
 */
export async function allow(key: string, limit: number, windowSeconds: number) {
  const now = Math.floor(Date.now() / 1000)
  const bucket = Math.floor(now / windowSeconds)
  const row = await db()
    .prepare(
      `INSERT INTO rate_limits (key, bucket, n, expires) VALUES (?, ?, 1, ?)
       ON CONFLICT(key, bucket) DO UPDATE SET n = n + 1 RETURNING n`,
    )
    .bind(key, bucket, (bucket + 1) * windowSeconds)
    .first<{ n: number }>()
  // Opportunistic cleanup keeps the table tiny without a cron.
  if (Math.random() < 0.02) await db().prepare('DELETE FROM rate_limits WHERE expires < ?').bind(now).run()
  return (row?.n ?? 1) <= limit
}

/** Session id, minted on first write (add to cart, sign in). */
export async function ensureSid() {
  const existing = peekSid()
  if (existing) {
    const row = await db().prepare('SELECT id FROM sessions WHERE id = ?').bind(existing).first()
    if (row) return existing
  }
  if (!(await allow(`session:${clientIp()}`, 40, 3600))) throw new Error('Too many requests. Please try again later.')
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
