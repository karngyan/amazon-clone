import { useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Price, PrimeBadge, QtySelect, useAddToCart } from '#/components/ui'
import { useToast } from '#/components/toast'
import { deliveryDates } from '#/lib/format'
import type { Product, User } from '#/lib/types'
import { addToCart, toggleList } from '#/server/fns'

export function BuyBox({ product, inList, user }: { product: Product; inList: boolean; user: User | null }) {
  const router = useRouter()
  const navigate = useNavigate()
  const toast = useToast()
  const { add, busy } = useAddToCart()
  const [qty, setQty] = useState(1)
  const [buying, setBuying] = useState(false)
  const [listed, setListed] = useState(inList)
  const [listBusy, setListBusy] = useState(false)
  const dates = deliveryDates()
  const out = product.stock === 0

  useEffect(() => setListed(inList), [inList])

  const buyNow = async () => {
    setBuying(true)
    try {
      await addToCart({ data: { productId: product.id, qty } })
      await router.invalidate()
      await navigate({ to: '/checkout' })
    } catch {
      toast({ title: 'Could not start checkout', body: 'Please try again.' })
      setBuying(false)
    }
  }

  const onList = async () => {
    if (!user) {
      navigate({ to: '/signin', search: { redirect: `/dp/${product.id}` } as never })
      return
    }
    const next = !listed
    setListed(next)
    setListBusy(true)
    try {
      await toggleList({ data: { productId: product.id, on: next } })
      await router.invalidate()
      toast(
        next
          ? { title: 'Added to your List', body: product.title, image: product.thumbnail, href: '/wishlist', cta: 'View List' }
          : { title: 'Removed from your List', body: product.title, image: product.thumbnail },
      )
    } catch {
      setListed(!next)
      toast({ title: 'Could not update your List', body: 'Please try again.' })
    } finally {
      setListBusy(false)
    }
  }

  return (
    <aside className="card p-[18px] text-[14px] leading-5" aria-label="Purchase options">
      <Price value={product.price} size="lg" />
      {!out ? (
        <div className="mt-2 space-y-2">
          {product.prime ? <div><PrimeBadge /></div> : null}
          <p>FREE delivery <b>{dates.free}</b></p>
          <p>Or fastest delivery <b>{dates.fast}</b></p>
        </div>
      ) : null}
      <p className="mt-2 flex items-center gap-1 text-[12px] text-link">
        <svg width="12" height="15" viewBox="0 0 12 15" aria-hidden="true"><path d="M6 .8A5 5 0 001 5.9C1 9.6 6 14.2 6 14.2s5-4.6 5-8.3A5 5 0 006 .8zm0 7a2 2 0 110-4 2 2 0 010 4z" fill="none" stroke="#0f1111" strokeWidth="1.2" /></svg>
        {user ? `Deliver to ${user.name.split(' ')[0]}` : 'Sign in to update your delivery location'}
      </p>

      <p className="mt-3 text-[18px] leading-6" role="status">
        {out ? (
          <span className="text-deal">Currently unavailable</span>
        ) : product.stock <= 10 ? (
          <span className="text-deal">Only {product.stock} left in stock - order soon.</span>
        ) : (
          <span className="text-ok">In Stock</span>
        )}
      </p>
      {out ? <p className="mt-1 text-[13px] text-muted">We don't know when or if this item will be back in stock.</p> : null}

      <div className="mt-3">
        <QtySelect value={qty} onChange={setQty} max={product.stock} disabled={out} />
      </div>
      <div className="mt-3 space-y-2">
        <button type="button" className="btn btn-buy btn-block" disabled={out || busy || buying} onClick={() => add(product, qty)}>
          {busy ? 'Adding…' : 'Add to cart'}
        </button>
        <button type="button" className="btn btn-now btn-block" disabled={out || busy || buying} onClick={buyNow}>
          {buying ? 'One moment…' : 'Buy Now'}
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[12px] leading-4">
        <dt className="text-muted">Ships from</dt><dd>Amazon.clone</dd>
        <dt className="text-muted">Sold by</dt><dd className="truncate">{product.brand ?? 'Amazon.clone'}</dd>
        <dt className="text-muted">Returns</dt><dd className="text-link">{product.returnPolicy ?? 'FREE 30-day refund/replacement'}</dd>
        <dt className="text-muted">Payment</dt><dd className="text-link">Secure transaction</dd>
      </dl>

      <hr className="my-4 border-line" />
      <button type="button" className="btn btn-plain btn-block" onClick={onList} disabled={listBusy} aria-pressed={listed}>
        {listed ? 'Remove from List' : 'Add to List'}
      </button>
    </aside>
  )
}
