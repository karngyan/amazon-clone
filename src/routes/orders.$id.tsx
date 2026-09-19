import { Link, createFileRoute, notFound, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { AddressLines, CancelOrder, OrderItemRow, canCancel, dayDate, statusInfo } from '#/components/account/orders'
import { longDate, money } from '#/lib/format'
import type { Order } from '#/lib/types'
import { getOrder } from '#/server/fns'

export const Route = createFileRoute('/orders/$id')({
  validateSearch: (s: Record<string, unknown>): { placed?: boolean } =>
    s.placed === true || s.placed === 'true' ? { placed: true } : {},
  beforeLoad: ({ context, location }) => {
    if (!context.user) throw redirect({ to: '/signin', search: { redirect: location.href } })
  },
  loader: async ({ params }) => {
    const order = await getOrder({ data: { id: params.id } })
    if (!order) throw notFound()
    return order
  },
  head: () => ({ meta: [{ title: 'Order Details' }] }),
  notFoundComponent: () => (
    <main id="main" className="mx-auto max-w-[700px] px-4 py-16 text-center">
      <h1 className="text-[28px] font-normal">We can't find that order</h1>
      <p className="mt-2 text-muted">It may belong to a different account, or the link may be incomplete.</p>
      <Link to="/orders" className="btn btn-buy mt-5">Go to Your Orders</Link>
    </main>
  ),
  component: OrderDetail,
})

function OrderDetail() {
  const order = Route.useLoaderData()
  const { placed } = Route.useSearch()
  const { user } = Route.useRouteContext()
  const s = statusInfo(order)

  return (
    <main id="main" className="mx-auto w-full max-w-[960px] px-4 pb-12 pt-4">
      {placed ? <ThankYou order={order} email={user?.email} /> : null}

      <nav aria-label="Breadcrumb" className="mb-2 text-[12px] text-muted">
        <Link to="/account" className="hover:text-link-hover hover:underline">Your Account</Link>
        <span aria-hidden="true"> › </span>
        <Link to="/orders" className="hover:text-link-hover hover:underline">Your Orders</Link>
        <span aria-hidden="true"> › </span>
        <span className="text-link-hover">Order Details</span>
      </nav>
      <h1 className="text-[28px] font-normal leading-9">Order Details</h1>
      <p className="mb-3 flex flex-wrap gap-x-3 text-[14px]">
        <span>Ordered on {longDate(order.createdAt)}</span>
        <span aria-hidden="true" className="text-line">|</span>
        <span>Order# {order.id}</span>
      </p>

      <section aria-label="Order summary" className="card grid gap-5 p-4 sm:grid-cols-2 md:grid-cols-[1fr_1fr_1.2fr]">
        <div>
          <h2 className="mb-1 font-bold">Shipping Address</h2>
          <AddressLines a={order.address} />
        </div>
        <div>
          <h2 className="mb-1 font-bold">Payment Method</h2>
          <div className="flex items-center gap-2">
            <svg width="28" height="19" viewBox="0 0 28 19" aria-hidden="true"><rect x=".5" y=".5" width="27" height="18" rx="2.500" fill="#fff" stroke="#d5d9d9" /><rect y="4" width="28" height="3.500" fill="#232f3e" /><rect x="3" y="11" width="9" height="2.500" rx="1" fill="#d5d9d9" /></svg>
            <span>{order.paymentLabel}</span>
          </div>
          <h2 className="mb-1 mt-3 font-bold">Delivery</h2>
          <div>{order.deliveryOption}</div>
        </div>
        <div className="sm:col-span-2 md:col-span-1">
          <h2 className="mb-1 font-bold">Order Summary</h2>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5">
            <dt>Item(s) Subtotal:</dt><dd className="text-right">{money(order.subtotal)}</dd>
            <dt>Shipping &amp; Handling:</dt><dd className="text-right">{money(order.shipping)}</dd>
            <dt>Total before tax:</dt><dd className="text-right">{money(order.subtotal + order.shipping)}</dd>
            <dt>Estimated tax to be collected:</dt><dd className="text-right">{money(order.tax)}</dd>
            <dt className="mt-1 font-bold">Grand Total:</dt><dd className="mt-1 text-right font-bold">{money(order.total)}</dd>
          </dl>
        </div>
      </section>

      <section aria-labelledby="track-title" className="card mt-5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="track-title" className={`text-[18px] font-bold leading-6 ${s.tone}`}>{s.title}</h2>
            <p className="text-[13px]">{s.note}</p>
          </div>
          <RefreshStatus />
        </div>
        <Tracker order={order} />
      </section>

      <section aria-label="Items in this order" className="card mt-5 flex flex-col gap-4 p-4 md:flex-row">
        <div className="grid min-w-0 flex-1 gap-4">
          {order.items.map((i) => <OrderItemRow key={i.productId} item={i} showPrice />)}
        </div>
        <div className="flex flex-none flex-col gap-2 md:w-[230px]">
          {order.items[0] && order.status !== 'cancelled' ? (
            <Link to="/dp/$id" params={{ id: String(order.items[0].productId) }} hash="reviews" className="btn btn-plain btn-block">Write a product review</Link>
          ) : null}
          <CancelOrder order={order} />
          {!canCancel(order) && order.status === 'delivered' ? <p className="text-[12px] text-muted">Delivered orders can no longer be cancelled.</p> : null}
          <Link to="/orders" className="btn btn-plain btn-block">Back to Your Orders</Link>
        </div>
      </section>
    </main>
  )
}

function RefreshStatus() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [at, setAt] = useState<string | null>(null)
  const run = async () => {
    setBusy(true)
    try {
      await router.invalidate()
      setAt(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="text-right">
      <button className="btn btn-plain" onClick={run} disabled={busy}>
        <svg className={busy ? 'animate-spin' : ''} width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#0f1111" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13.500 8A5.500 5.500 0 118 2.500c1.700 0 3.200.8 4.200 2" /><path d="M12.500 1.500v3.200H9.300" /></svg>
        {busy ? 'Refreshing…' : 'Refresh status'}
      </button>
      <p className="mt-1 text-[11px] text-muted" aria-live="polite">{at ? `Updated ${at}` : 'Demo orders ship about a minute after they are placed.'}</p>
    </div>
  )
}

const STEPS = ['Ordered', 'Shipped', 'Out for delivery', 'Delivered']

function Tracker({ order }: { order: Order }) {
  if (order.status === 'cancelled') {
    return (
      <div className="mt-4 flex items-center gap-2 rounded border border-[#c40000] bg-[#fcf4f4] px-3 py-2.5 text-[#c40000]">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#c40000" /><path d="M5 5l6 6M11 5l-6 6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></svg>
        <b>Cancelled</b>
        <span className="text-ink">This order was cancelled and will not be delivered.</span>
      </div>
    )
  }
  // "Out for delivery" is inferred: a shipped order on its final day.
  const lastDay = new Date(order.eta).getTime() - Date.now() < 86400000
  const reached = order.status === 'delivered' ? 3 : order.status === 'shipped' ? (lastDay ? 2 : 1) : 0
  return (
    <div className="mt-5 px-1 pb-1">
      <div className="relative mx-[12.5%] h-2 rounded-full bg-[#e3e6e6]" role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={reached} aria-valuetext={STEPS[reached]}>
        <div className="h-full rounded-full bg-[#067d62] transition-[width] duration-500" style={{ width: `${(reached / 3) * 100}%` }} />
        {STEPS.map((_, i) => (
          <span
            key={i}
            className={`absolute top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 ${i <= reached ? 'border-[#067d62] bg-[#067d62]' : 'border-[#c7c7c7] bg-white'}`}
            style={{ left: `${(i / 3) * 100}%` }}
          >
            {i <= reached ? <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 5.200l2 2 4-4.400" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg> : null}
          </span>
        ))}
      </div>
      <ol className="mt-3 grid grid-cols-4 text-center text-[12px] leading-4 sm:text-[13px]">
        {STEPS.map((label, i) => (
          <li key={label} className={i === reached ? 'font-bold text-[#067d62]' : i < reached ? 'text-ink' : 'text-muted'} aria-current={i === reached ? 'step' : undefined}>
            {label}
          </li>
        ))}
      </ol>
    </div>
  )
}

function ThankYou({ order, email }: { order: Order; email?: string }) {
  const a = order.address
  return (
    <section aria-labelledby="thanks-title" className="card fade-in mb-6 p-5">
      <div className="flex items-start gap-3">
        <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" className="mt-0.5 flex-none"><circle cx="13" cy="13" r="13" fill="#067d62" /><path d="M7 13.500l4 4 8-8.500" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <div className="min-w-0">
          <h2 id="thanks-title" className="text-[20px] font-bold leading-7 text-[#067d62]">Order placed, thank you!</h2>
          <p>Confirmation will be sent to your email.</p>
          <p className="text-[12px] text-muted">This is a demo store: no email is actually sent{email ? ` to ${email}` : ''} and no payment is taken.</p>
          <p className="mt-2"><b>Shipping to {a.fullName}</b>, {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.zip}, {a.country}</p>
          <div className="mt-3 border-t border-line pt-3">
            <div className="font-bold">{dayDate(order.eta)}</div>
            <div className="text-[13px] text-muted">Estimated delivery · {order.deliveryOption}</div>
            <div className="mt-2 flex gap-2">
              {order.items.slice(0, 6).map((i) => (
                <div key={i.productId} className="img-well h-14 w-14 flex-none rounded p-1"><img src={i.thumbnail} alt={i.title} /></div>
              ))}
              {order.items.length > 6 ? <div className="flex h-14 items-center text-[13px] text-muted">+{order.items.length - 6} more</div> : null}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link to="/orders" className="link">Review or edit your recent orders <span aria-hidden="true">›</span></Link>
            <Link to="/" className="btn btn-buy">Continue shopping</Link>
          </div>
        </div>
      </div>
    </section>
  )
}
