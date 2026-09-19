import { Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { boughtLabel, compact, deliveryDates, discountPct, splitPrice } from '#/lib/format'
import type { ProductCard as Card } from '#/lib/types'
import { addToCart } from '#/server/fns'
import { useToast } from './toast'

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, (Math.round(value * 2) / 2 / 5) * 100))
  const star = 'M10 1.5l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9L4.7 18l1.1-6L1.4 7.8l6-.8z'
  const row = (fill: string) => (
    <svg width={size * 5} height={size} viewBox="0 0 100 20" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={star} transform={`translate(${i * 20} 0)`} fill={fill} stroke="#de7921" strokeWidth="1" />
      ))}
    </svg>
  )
  return (
    <span className="relative inline-block align-middle" style={{ width: size * 5, height: size }} role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {row('#fff')}
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>
        {row('#de7921')}
      </span>
    </span>
  )
}

export function Rating({ value, count, size }: { value: number; count: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[13px]">
      <span className="text-ink">{value.toFixed(1)}</span>
      <Stars value={value} size={size} />
      <span className="text-link">({compact(count)})</span>
    </span>
  )
}

export function Price({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' | 'lg' }) {
  const { whole, cents } = splitPrice(value)
  const big = { sm: 'text-[17px]', md: 'text-[21px]', lg: 'text-[28px]' }[size]
  return (
    <span className="inline-flex items-start leading-none text-ink" aria-label={`$${whole}.${cents}`}>
      <span className="text-[0.62em] mt-[0.25em]" aria-hidden="true">$</span>
      <span className={`${big} font-medium`} aria-hidden="true">{whole}</span>
      <span className="text-[0.62em] mt-[0.25em]" aria-hidden="true">{cents}</span>
    </span>
  )
}

export function PrimeBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 font-bold italic text-[#1a98ff] text-[13px]" aria-label="Prime">
      <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true"><path d="M1 6.5l4 4L13 1.5" fill="none" stroke="#f90" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      prime
    </span>
  )
}

export function DealBadge({ price, list }: { price: number; list: number }) {
  const pct = discountPct(price, list)
  if (pct < 10) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px]">
      <span className="bg-deal text-white px-1.5 py-0.5 rounded-sm font-medium">{pct}% off</span>
      <span className="text-deal font-bold">Limited time deal</span>
    </span>
  )
}

export function useAddToCart() {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const add = async (product: Pick<Card, 'id' | 'title' | 'thumbnail'>, qty = 1) => {
    setBusy(true)
    try {
      await addToCart({ data: { productId: product.id, qty } })
      await router.invalidate()
      toast({ title: 'Added to cart', body: product.title, image: product.thumbnail, href: '/cart', cta: 'Go to Cart' })
    } catch {
      toast({ tone: 'error', title: 'Could not add to cart', body: 'Please try again.' })
    } finally {
      setBusy(false)
    }
  }
  return { add, busy }
}

/** Grid/rail card used on search, home rails, lists. */
export function ProductCard({ p, compactCard = false }: { p: Card; compactCard?: boolean }) {
  const { add, busy } = useAddToCart()
  const bought = boughtLabel(p.sold)
  return (
    <article className="group flex h-full flex-col bg-white">
      <Link to="/dp/$id" params={{ id: String(p.id) }} className="img-well aspect-square rounded-sm p-4" aria-label={p.title}>
        <img src={p.thumbnail} alt="" loading="lazy" className="transition-transform duration-200 group-hover:scale-[1.04]" />
      </Link>
      <div className="flex flex-1 flex-col gap-1 pt-2">
        <Link to="/dp/$id" params={{ id: String(p.id) }} className="clamp-2 text-[15px] leading-5 hover:text-link-hover">
          {p.brand && !p.title.toLowerCase().includes(p.brand.toLowerCase()) ? <span className="font-medium">{p.brand} </span> : null}
          {p.title}
        </Link>
        <Rating value={p.rating} count={p.reviewCount} />
        {!compactCard && bought ? <span className="text-[12px] text-muted">{bought}</span> : null}
        <DealBadge price={p.price} list={p.listPrice} />
        <div className="flex items-baseline gap-2">
          <Price value={p.price} />
          {p.listPrice > p.price ? (
            <span className="text-[12px] text-muted">List: <s>${p.listPrice.toFixed(2)}</s></span>
          ) : null}
        </div>
        {!compactCard ? (
          <div className="text-[12px] leading-4 text-ink">
            {p.prime ? <PrimeBadge /> : null}
            <div>FREE delivery <b>{deliveryDates().free}</b></div>
            {p.stock > 0 && p.stock <= 10 ? <div className="text-deal">Only {p.stock} left in stock - order soon.</div> : null}
          </div>
        ) : null}
        <div className="mt-auto pt-2">
          <button className="btn btn-buy" disabled={busy || p.stock === 0} onClick={() => add(p)}>
            {p.stock === 0 ? 'Out of stock' : busy ? 'Adding…' : 'Add to cart'}
          </button>
        </div>
      </div>
    </article>
  )
}

/** Horizontal scroller with a white card frame, as on Amazon's home and PDP. */
export function Rail({ title, items, to }: { title: string; items: Card[]; to?: { search: Record<string, unknown> } }) {
  if (!items.length) return null
  return (
    <section className="bg-white p-5">
      <div className="mb-3 flex items-baseline gap-4">
        <h2 className="text-[21px] font-bold leading-7">{title}</h2>
        {to ? <Link to="/s" search={to.search as never} className="link text-[14px]">See more</Link> : null}
      </div>
      <div className="rail">
        {items.map((p) => (
          <Link key={p.id} to="/dp/$id" params={{ id: String(p.id) }} className="w-[180px]">
            <div className="img-well h-[180px] rounded-sm p-3"><img src={p.thumbnail} alt="" loading="lazy" /></div>
            <div className="clamp-2 mt-2 text-[13px] leading-[18px] text-link hover:text-link-hover">{p.title}</div>
            <Rating value={p.rating} count={p.reviewCount} size={14} />
            <div className="mt-1 flex items-baseline gap-2">
              <Price value={p.price} size="sm" />
              {discountPct(p.price, p.listPrice) >= 10 ? <span className="text-[12px] text-deal">-{discountPct(p.price, p.listPrice)}%</span> : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function QtySelect({ value, onChange, max = 10, disabled }: { value: number; onChange: (n: number) => void; max?: number; disabled?: boolean }) {
  return (
    <label className="inline-flex items-center gap-1 rounded-lg border border-line bg-[#f0f2f2] px-2 py-1 text-[13px] shadow-[0_2px_5px_rgba(15,17,17,.15)] hover:bg-[#e3e6e6]">
      <span>Qty:</span>
      <select className="cursor-pointer bg-transparent outline-none" value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} aria-label="Quantity">
        {Array.from({ length: Math.max(1, Math.min(10, max)) }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </label>
  )
}

export function Breadcrumbs({ items }: { items: { label: string; search?: Record<string, unknown> }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 ? <span aria-hidden="true">›</span> : null}
          {it.search ? <Link to="/s" search={it.search as never} className="hover:text-link-hover hover:underline">{it.label}</Link> : <span>{it.label}</span>}
        </span>
      ))}
    </nav>
  )
}

export function EmptyState({ title, body, children }: { title: string; body?: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-start gap-2 p-8">
      <h2 className="text-[22px] font-bold leading-7">{title}</h2>
      {body ? <p className="text-muted">{body}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  )
}
