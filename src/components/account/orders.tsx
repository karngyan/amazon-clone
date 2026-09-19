import { Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useToast } from '#/components/toast'
import { useAddToCart } from '#/components/ui'
import { money } from '#/lib/format'
import type { Order, OrderItem } from '#/lib/types'
import { cancelOrder } from '#/server/fns'

const parse = (iso: string) => new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')

export const dayDate = (iso: string) =>
  parse(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })

export const canCancel = (o: Order) => o.status === 'placed' || o.status === 'shipped'

export function statusInfo(o: Order) {
  if (o.status === 'cancelled') return { title: 'Cancelled', note: 'You were not charged for this order.', tone: 'text-[#c40000]' }
  if (o.status === 'delivered') return { title: `Delivered ${dayDate(o.eta)}`, note: 'Your package was left near the front door or porch.', tone: 'text-ink' }
  return {
    title: `Arriving ${dayDate(o.eta)}`,
    note: o.status === 'shipped' ? 'Shipped. Your package is on the way.' : 'Not yet shipped. We are preparing your order.',
    tone: 'text-ok',
  }
}

export function AddressLines({ a }: { a: Order['address'] }) {
  return (
    <address className="not-italic leading-5">
      <div>{a.fullName}</div>
      <div>{a.line1}</div>
      {a.line2 ? <div>{a.line2}</div> : null}
      <div>{a.city}, {a.state} {a.zip}</div>
      <div>{a.country}</div>
    </address>
  )
}

export function OrderItemRow({ item, showPrice = false }: { item: OrderItem; showPrice?: boolean }) {
  const { add, busy } = useAddToCart()
  const params = { id: String(item.productId) }
  return (
    <div className="flex gap-4">
      <Link to="/dp/$id" params={params} className="img-well relative h-[90px] w-[90px] flex-none rounded p-1.5" aria-label={item.title}>
        <img src={item.thumbnail} alt="" loading="lazy" />
        {item.qty > 1 ? (
          <span className="absolute bottom-1 right-1 rounded-full border border-line bg-white px-1.5 text-[12px] leading-[18px]" aria-label={`Quantity ${item.qty}`}>{item.qty}</span>
        ) : null}
      </Link>
      <div className="min-w-0">
        <Link to="/dp/$id" params={params} className="link clamp-2">{item.title}</Link>
        {showPrice ? (
          <div className="mt-0.5 text-[13px]"><span className="text-[#b12704]">{money(item.price)}</span>{item.qty > 1 ? <span className="text-muted"> · Qty: {item.qty}</span> : null}</div>
        ) : (
          <div className="mt-0.5 text-[12px] text-muted">Return or replace items: eligible through 30 days after delivery</div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="btn btn-buy !px-3 !py-1" disabled={busy} onClick={() => add({ id: item.productId, title: item.title, thumbnail: item.thumbnail })}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#0f1111" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13.500 8A5.500 5.500 0 118 2.500c1.700 0 3.200.8 4.200 2" /><path d="M12.500 1.500v3.200H9.300" /></svg>
            {busy ? 'Adding…' : 'Buy it again'}
          </button>
          <Link to="/dp/$id" params={params} className="btn btn-plain !px-3 !py-1">View your item</Link>
        </div>
      </div>
    </div>
  )
}

/** Two-step cancel: Amazon never cancels on a single click, and neither should we. */
export function CancelOrder({ order, block = true }: { order: Order; block?: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [step, setStep] = useState<'idle' | 'confirm' | 'pending'>('idle')
  const [error, setError] = useState<string | null>(null)
  if (!canCancel(order)) return null
  const width = block ? 'btn-block' : ''

  const run = async () => {
    setStep('pending')
    setError(null)
    try {
      const res = await cancelOrder({ data: { id: order.id } })
      if ('error' in res && res.error) {
        setError(res.error)
        setStep('idle')
        await router.invalidate()
        return
      }
      await router.invalidate()
      toast({ title: 'Order cancelled', body: `Order # ${order.id}` })
    } catch {
      setError('We could not cancel this order. Please try again.')
      setStep('idle')
    }
  }

  return (
    <div>
      {step === 'idle' ? (
        <button className={`btn btn-plain ${width}`} onClick={() => setStep('confirm')}>Cancel items</button>
      ) : (
        <div className="pop-in rounded-lg border border-line bg-[#f7fafa] p-3" role="group" aria-label="Confirm cancellation">
          <p className="mb-2 text-[13px] leading-[18px]"><b>Cancel this order?</b> All {order.items.length > 1 ? `${order.items.length} items` : 'items'} will be cancelled and you will not be charged.</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-buy !px-3 !py-1" disabled={step === 'pending'} onClick={run} autoFocus>{step === 'pending' ? 'Cancelling…' : 'Yes, cancel order'}</button>
            <button className="btn btn-plain !px-3 !py-1" disabled={step === 'pending'} onClick={() => setStep('idle')}>Keep order</button>
          </div>
        </div>
      )}
      <p role="alert" aria-live="assertive" className={error ? 'mt-2 rounded border border-[#c40000] p-2 text-[12px] leading-4 text-[#c40000]' : undefined}>
        {error ? <><b className="block">There was a problem</b>{error}</> : null}
      </p>
    </div>
  )
}
