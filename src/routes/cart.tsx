import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { RecentlyViewed } from '#/components/browse/RecentlyViewed'
import { useToast } from '#/components/toast'
import { Price, PrimeBadge } from '#/components/ui'
import { money } from '#/lib/format'
import type { CartLine } from '#/lib/types'
import { getCart, updateCartItem } from '#/server/fns'

const FREE_SHIPPING_MIN = 35

export const Route = createFileRoute('/cart')({
  loader: () => getCart(),
  head: () => ({ meta: [{ title: 'Amazon.clone Shopping Cart' }] }),
  component: CartPage,
})

type Row = CartLine & { removed?: boolean }

// Removed rows only exist client-side; keep them where they were when fresh server data lands.
const merge = (prev: Row[], server: CartLine[]): Row[] => {
  const next: Row[] = [...server]
  prev.forEach((r, i) => {
    if (r.removed && !server.some((s) => s.id === r.id)) next.splice(Math.min(i, next.length), 0, r)
  })
  return next
}

function CartPage() {
  const data = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const toast = useToast()
  const [rows, setRows] = useState<Row[]>(data)
  const inflight = useRef(0)

  useEffect(() => {
    if (inflight.current === 0) setRows((prev) => merge(prev, data))
  }, [data])

  const mutate = async (id: number, patch: { qty?: number; saved?: boolean }) => {
    const before = rows
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        if (patch.qty === 0) return { ...r, removed: true }
        return { ...r, qty: patch.qty ?? r.qty, saved: patch.saved ?? r.saved }
      }),
    )
    inflight.current++
    try {
      const res = await updateCartItem({ data: { productId: id, ...patch } })
      if (!res.ok) throw new Error('not saved')
      inflight.current--
      if (inflight.current === 0) await router.invalidate()
    } catch {
      inflight.current = Math.max(0, inflight.current - 1)
      setRows(before)
      toast({ title: 'We could not update your cart', body: 'Please try again.' })
    }
  }

  const active = rows.filter((r) => !r.saved || r.removed)
  const live = rows.filter((r) => !r.saved && !r.removed)
  const saved = rows.filter((r) => r.saved && !r.removed)
  const count = live.reduce((n, r) => n + r.qty, 0)
  const subtotal = live.reduce((n, r) => n + r.price * r.qty, 0)
  const itemsLabel = `${count} ${count === 1 ? 'item' : 'items'}`

  return (
    <main id="main" className="flex-1 bg-page">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-3 md:p-5">
        <div className="flex flex-col items-start gap-4 lg:flex-row">
          <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
            {live.length === 0 ? <EmptyCart signedIn={!!user} /> : null}

            {active.length > 0 ? (
              <section className="bg-white p-4 md:p-5" aria-labelledby="cart-h">
                {live.length > 0 ? (
                  <>
                    <h1 id="cart-h" className="text-[28px] font-normal leading-9">Shopping Cart</h1>
                    <div className="border-b border-line pb-1 text-right text-[13px] text-muted">Price</div>
                  </>
                ) : (
                  <h2 id="cart-h" className="sr-only">Removed items</h2>
                )}
                <ul>
                  {active.map((r) =>
                    r.removed ? (
                      <li key={r.id} className="fade-in border-b border-line py-3 text-[13px]" role="status">
                        <Link to="/dp/$id" params={{ id: String(r.id) }} className="link">{r.title}</Link>{' '}
                        was removed from Shopping Cart.
                      </li>
                    ) : (
                      <CartRow key={r.id} line={r} onChange={(patch) => mutate(r.id, patch)} />
                    ),
                  )}
                </ul>
                {live.length > 0 ? (
                  <div className="pt-2 text-right text-[18px]" aria-live="polite">
                    Subtotal ({itemsLabel}): <b>{money(subtotal)}</b>
                  </div>
                ) : null}
              </section>
            ) : null}

            {saved.length > 0 ? (
              <section className="bg-white p-4 md:p-5" aria-labelledby="saved-h">
                <h2 id="saved-h" className="border-b border-line pb-3 text-[24px] font-normal leading-8">
                  Saved for later ({saved.length} {saved.length === 1 ? 'item' : 'items'})
                </h2>
                <ul className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-3 xl:grid-cols-5">
                  {saved.map((r) => (
                    <SavedCard key={r.id} line={r} onChange={(patch) => mutate(r.id, patch)} />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          {live.length > 0 ? (
            <aside className="w-full flex-none bg-white p-4 md:p-5 lg:sticky lg:top-3 lg:w-[300px]" aria-label="Order subtotal">
              <ShippingProgress subtotal={subtotal} />
              <div className="mt-3 text-[18px] leading-6">
                Subtotal ({itemsLabel}): <b>{money(subtotal)}</b>
              </div>
              {user ? (
                <Link to="/checkout" className="btn btn-buy btn-block mt-3">Proceed to checkout</Link>
              ) : (
                <Link to="/signin" search={{ redirect: '/checkout' } as never} className="btn btn-buy btn-block mt-3">
                  Proceed to checkout
                </Link>
              )}
            </aside>
          ) : null}
        </div>

        <RecentlyViewed />

        <p className="px-1 pb-4 text-[12px] leading-4 text-muted">
          The price and availability of items at Amazon.clone are subject to change. The Cart is a temporary place to
          store a list of your items and reflects each item's most recent price.
        </p>
      </div>
    </main>
  )
}

function ShippingProgress({ subtotal }: { subtotal: number }) {
  if (subtotal >= FREE_SHIPPING_MIN)
    return (
      <p className="flex items-start gap-2 text-[13px] leading-[18px]">
        <svg className="mt-px flex-none" width="18" height="18" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#007600" /><path d="M4.5 8.2l2.3 2.3 4.7-4.9" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
        <span>
          <span className="text-ok">Your order qualifies for FREE Shipping.</span>{' '}
          <span className="text-muted">Choose this option at checkout.</span>
        </span>
      </p>
    )
  const pct = Math.round((subtotal / FREE_SHIPPING_MIN) * 100)
  return (
    <div className="text-[13px] leading-[18px]">
      <div
        className="mb-2 h-2 overflow-hidden rounded-full border border-line bg-white"
        role="progressbar"
        aria-label="Progress toward FREE Shipping"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="h-full rounded-full bg-ok transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
      Add <b className="text-deal">{money(FREE_SHIPPING_MIN - subtotal)}</b> of eligible items to your order to qualify
      for FREE Shipping.
    </div>
  )
}

function Stock({ stock }: { stock: number }) {
  if (stock === 0) return <div className="text-[12px] text-deal">Currently unavailable</div>
  if (stock <= 10) return <div className="text-[12px] text-deal">Only {stock} left in stock - order soon.</div>
  return <div className="text-[12px] text-ok">In Stock</div>
}

const Sep = () => <span className="h-3.5 w-px bg-line" aria-hidden="true" />

function CartRow({ line, onChange }: { line: CartLine; onChange: (patch: { qty?: number; saved?: boolean }) => void }) {
  const max = Math.max(1, Math.min(10, line.stock))
  return (
    <li className="flex gap-3 border-b border-line py-4 md:gap-4">
      <Link to="/dp/$id" params={{ id: String(line.id) }} className="img-well h-[100px] w-[100px] flex-none rounded-sm p-2 md:h-[180px] md:w-[180px] md:p-3" aria-label={line.title}>
        <img src={line.thumbnail} alt="" loading="lazy" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <Link to="/dp/$id" params={{ id: String(line.id) }} className="clamp-2 min-w-0 flex-1 text-[16px] leading-[22px] hover:text-link-hover md:text-[18px] md:leading-6">
            {line.title}
          </Link>
          <div className="flex-none text-right text-[18px] font-bold leading-6">{money(line.price)}</div>
        </div>
        <div className="mt-1 flex flex-col gap-0.5">
          <Stock stock={line.stock} />
          {line.prime ? <PrimeBadge /> : null}
          <div className="text-[12px] text-muted"><span className="text-link">FREE Returns</span></div>
          {line.brand ? <div className="text-[12px]"><b>Brand:</b> {line.brand}</div> : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px]">
          <Stepper qty={line.qty} max={max} title={line.title} onChange={(qty) => onChange({ qty })} />
          <Sep />
          <button className="link" onClick={() => onChange({ qty: 0 })}>Delete</button>
          <Sep />
          <button className="link" onClick={() => onChange({ saved: true })}>Save for later</button>
          <Sep />
          <Link to="/s" search={{ category: line.category } as never} className="link">See more like this</Link>
        </div>
      </div>
    </li>
  )
}

function Stepper({ qty, max, title, onChange }: { qty: number; max: number; title: string; onChange: (qty: number) => void }) {
  const hit = 'flex h-full w-9 items-center justify-center rounded-full hover:bg-[#f0f2f2] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent'
  return (
    <div className="inline-flex h-8 items-center rounded-full border-[3px] border-buy bg-white text-[13px] font-bold" role="group" aria-label={`Quantity of ${title}`}>
      <button className={hit} onClick={() => onChange(qty - 1)} aria-label={qty === 1 ? 'Delete item' : 'Decrease quantity by one'}>
        {qty === 1 ? (
          <svg width="14" height="15" viewBox="0 0 14 15" fill="none" stroke="#0f1111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 3.5h12M5 3.5V1.5h4v2M2.5 3.5l.7 10h7.6l.7-10M5.5 6.5v4.5M8.5 6.5v4.5" /></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" stroke="#0f1111" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M2 6h8" /></svg>
        )}
      </button>
      <span className="min-w-6 text-center tabular-nums" aria-live="polite">{qty}</span>
      <button className={hit} disabled={qty >= max} onClick={() => onChange(qty + 1)} aria-label="Increase quantity by one">
        <svg width="12" height="12" viewBox="0 0 12 12" stroke="#0f1111" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M2 6h8M6 2v8" /></svg>
      </button>
    </div>
  )
}

function SavedCard({ line, onChange }: { line: CartLine; onChange: (patch: { qty?: number; saved?: boolean }) => void }) {
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-line p-3">
      <Link to="/dp/$id" params={{ id: String(line.id) }} className="img-well aspect-square rounded-sm p-3" aria-label={line.title}>
        <img src={line.thumbnail} alt="" loading="lazy" />
      </Link>
      <Link to="/dp/$id" params={{ id: String(line.id) }} className="clamp-2 text-[14px] leading-5 hover:text-link-hover">{line.title}</Link>
      <Price value={line.price} size="sm" />
      <Stock stock={line.stock} />
      {line.prime ? <PrimeBadge /> : null}
      <div className="mt-auto flex flex-col gap-2 pt-2">
        <button className="btn btn-plain btn-block" disabled={line.stock === 0} onClick={() => onChange({ saved: false })}>Move to cart</button>
        <button className="link self-start text-[12px]" onClick={() => onChange({ qty: 0 })}>Delete</button>
      </div>
    </li>
  )
}

function EmptyCart({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="flex flex-col items-center gap-5 bg-white p-6 sm:flex-row sm:items-center md:p-8">
      <svg className="flex-none" width="200" height="130" viewBox="0 0 200 130" fill="none" aria-hidden="true">
        <ellipse cx="100" cy="118" rx="76" ry="7" fill="#eaeded" />
        <path d="M28 22h20l20 62h78l16-46H60" stroke="#565959" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="78" cy="102" r="8" fill="#565959" />
        <circle cx="136" cy="102" r="8" fill="#565959" />
        <path d="M84 56c14 9 32 9 46 1" stroke="#ff9900" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <div className="text-center sm:text-left">
        <h1 className="text-[24px] font-bold leading-8">Your Amazon Cart is empty</h1>
        <Link to="/s" search={{ deals: true } as never} className="link text-[14px]">Shop today's deals</Link>
        {signedIn ? null : (
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Link to="/signin" search={{ redirect: '/cart' } as never} className="btn btn-buy">Sign in to your account</Link>
            <Link to="/register" search={{ redirect: '/cart' } as never} className="btn btn-plain">Sign up now</Link>
          </div>
        )}
      </div>
    </section>
  )
}
