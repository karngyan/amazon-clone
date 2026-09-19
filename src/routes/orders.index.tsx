import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { AddressLines, CancelOrder, OrderItemRow, statusInfo } from '#/components/account/orders'
import { EmptyState, useAddToCart } from '#/components/ui'
import { longDate, money } from '#/lib/format'
import type { Order, OrderItem } from '#/lib/types'
import { getOrders } from '#/server/fns'

export const Route = createFileRoute('/orders/')({
  beforeLoad: ({ context, location }) => {
    if (!context.user) throw redirect({ to: '/signin', search: { redirect: location.href } })
  },
  loader: () => getOrders(),
  head: () => ({ meta: [{ title: 'Your Orders' }] }),
  component: Orders,
})

const TABS = [
  { id: 'orders', label: 'Orders' },
  { id: 'again', label: 'Buy Again' },
  { id: 'cancelled', label: 'Cancelled Orders' },
] as const
type Tab = (typeof TABS)[number]['id']

function Orders() {
  const orders = Route.useLoaderData()
  const [tab, setTab] = useState<Tab>('orders')
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const match = (i: OrderItem) => !q || i.title.toLowerCase().includes(q)

  const shown = useMemo(
    () => orders.filter((o) => (tab === 'cancelled' ? o.status === 'cancelled' : o.status !== 'cancelled')).filter((o) => o.items.some(match)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, tab, q],
  )
  const again = useMemo(() => {
    const seen = new Map<number, OrderItem>()
    for (const o of orders) if (o.status !== 'cancelled') for (const i of o.items) if (!seen.has(i.productId)) seen.set(i.productId, i)
    return [...seen.values()].filter(match)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, q])

  const count = tab === 'again' ? again.length : shown.length

  return (
    <main id="main" className="mx-auto w-full max-w-[960px] px-4 pb-12 pt-4">
      <nav aria-label="Breadcrumb" className="mb-2 text-[12px] text-muted">
        <Link to="/account" className="hover:text-link-hover hover:underline">Your Account</Link>
        <span aria-hidden="true"> › </span>
        <span className="text-link-hover">Your Orders</span>
      </nav>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-normal leading-9">Your Orders</h1>
        {orders.length ? (
          <form role="search" className="flex w-full gap-2 sm:w-auto" onSubmit={(e) => (e.preventDefault(), setQuery(draft))}>
            <div className="relative flex-1 sm:w-[300px]">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#565959" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="6.500" cy="6.500" r="5" /><path d="M10.500 10.500L15 15" /></svg>
              <input
                type="search"
                className="field !pl-8"
                placeholder="Search all orders"
                aria-label="Search all orders"
                value={draft}
                onChange={(e) => (setDraft(e.target.value), setQuery(e.target.value))}
              />
            </div>
            <button type="submit" className="btn !rounded-full !border-[#0f1111] bg-[#303333] text-white hover:bg-[#0f1111]">Search Orders</button>
          </form>
        ) : null}
      </div>

      <div role="tablist" aria-label="Order views" className="mb-4 flex gap-6 overflow-x-auto border-b border-line whitespace-nowrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="orders-panel"
            onClick={() => setTab(t.id)}
            className={`-mb-px cursor-pointer border-b-2 px-0.5 pb-2 pt-1 ${tab === t.id ? 'border-[#e47911] font-bold text-ink' : 'border-transparent text-link hover:text-link-hover hover:underline'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id="orders-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {orders.length === 0 ? (
          <EmptyState title="You have not placed any orders" body="When you do, you can track, cancel, and buy things again from here.">
            <Link to="/" className="btn btn-buy">Start shopping</Link>
            <Link to="/s" search={{ deals: true }} className="btn btn-plain">See today's deals</Link>
          </EmptyState>
        ) : (
          <>
            <p className="mb-3 text-[13px]" aria-live="polite">
              <b>{count} {tab === 'again' ? (count === 1 ? 'item' : 'items') : count === 1 ? 'order' : 'orders'}</b>
              {q ? <> matching "{query.trim()}" <button className="link ml-1" onClick={() => (setDraft(''), setQuery(''))}>Clear search</button></> : tab === 'orders' ? ' placed' : null}
            </p>
            {count === 0 ? (
              <div className="card p-6 text-center">
                {q
                  ? 'We could not find any items matching your search. Check the spelling or try a shorter term.'
                  : tab === 'cancelled'
                    ? 'You have no cancelled orders. We hope it stays that way.'
                    : tab === 'again'
                      ? 'Items from your orders show up here so you can reorder in one click.'
                      : <>All of your orders were cancelled. <Link to="/" className="link">Continue shopping</Link></>}
              </div>
            ) : tab === 'again' ? (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {again.map((i) => <AgainCard key={i.productId} item={i} />)}
              </ul>
            ) : (
              <ul className="grid gap-5">
                {shown.map((o) => <li key={o.id}><OrderCard order={o} /></li>)}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function AgainCard({ item }: { item: OrderItem }) {
  const { add, busy } = useAddToCart()
  const params = { id: String(item.productId) }
  return (
    <li className="card flex flex-col gap-2 p-3">
      <Link to="/dp/$id" params={params} className="img-well aspect-square rounded p-3" aria-label={item.title}><img src={item.thumbnail} alt="" loading="lazy" /></Link>
      <Link to="/dp/$id" params={params} className="link clamp-2 text-[13px] leading-[18px]">{item.title}</Link>
      <div className="text-[13px]">Last paid <span className="text-[#b12704]">{money(item.price)}</span></div>
      <button className="btn btn-buy btn-block mt-auto" disabled={busy} onClick={() => add({ id: item.productId, title: item.title, thumbnail: item.thumbnail })}>
        {busy ? 'Adding…' : 'Add to cart'}
      </button>
    </li>
  )
}

const head = 'text-[12px] uppercase leading-4 text-muted'

function OrderCard({ order }: { order: Order }) {
  const s = statusInfo(order)
  const first = order.items[0]
  return (
    <article className="card" aria-label={`Order ${order.id}`}>
      <header className="flex flex-wrap gap-x-8 gap-y-2 rounded-t-lg border-b border-line bg-[#f0f2f2] px-4 py-3 text-[13px] text-muted">
        <div>
          <div className={head}>Order placed</div>
          <div>{longDate(order.createdAt)}</div>
        </div>
        <div>
          <div className={head}>Total</div>
          <div>{money(order.total)}</div>
        </div>
        <div className="group relative">
          <div className={head}>Ship to</div>
          <button className="link flex items-center gap-1" aria-describedby={`ship-${order.id}`}>
            <span className="max-w-[140px] truncate">{order.address.fullName}</span>
            <svg width="9" height="6" viewBox="0 0 9 6" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M1 1l3.500 3.500L8 1" /></svg>
          </button>
          <div id={`ship-${order.id}`} role="tooltip" className="invisible absolute left-0 top-full z-20 w-[220px] rounded-lg border border-line bg-white p-3 text-ink opacity-0 shadow-[0_4px_14px_rgba(15,17,17,.25)] transition-opacity duration-100 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
            <div className="font-bold"><AddressLines a={order.address} /></div>
            {order.address.phone ? <div className="mt-1 text-[12px] text-muted">Phone: {order.address.phone}</div> : null}
          </div>
        </div>
        <div className="sm:ml-auto sm:text-right">
          <div className={head}>Order # {order.id}</div>
          <Link to="/orders/$id" params={{ id: order.id }} className="link">View order details</Link>
        </div>
      </header>

      <div className="flex flex-col gap-4 p-4 md:flex-row">
        <div className="min-w-0 flex-1">
          <h2 className={`text-[18px] font-bold leading-6 ${s.tone}`}>{s.title}</h2>
          <p className="mb-3 text-[13px]">{s.note}</p>
          <div className="grid gap-4">
            {order.items.map((i) => <OrderItemRow key={i.productId} item={i} />)}
          </div>
        </div>
        <div className="flex flex-none flex-col gap-2 md:w-[230px]">
          {order.status !== 'cancelled' ? <Link to="/orders/$id" params={{ id: order.id }} className="btn btn-buy btn-block">Track package</Link> : null}
          {first && order.status !== 'cancelled' ? (
            <Link to="/dp/$id" params={{ id: String(first.productId) }} hash="reviews" className="btn btn-plain btn-block">Write a product review</Link>
          ) : null}
          <CancelOrder order={order} />
        </div>
      </div>
    </article>
  )
}
