import { Link, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useToast } from '#/components/toast'
import { DealBadge, EmptyState, Price, PrimeBadge, Rating, useAddToCart } from '#/components/ui'
import type { ProductCard } from '#/lib/types'
import { getList, toggleList } from '#/server/fns'

export const Route = createFileRoute('/wishlist')({
  beforeLoad: ({ context, location }) => {
    if (!context.user) throw redirect({ to: '/signin', search: { redirect: location.href } })
  },
  loader: () => getList(),
  head: () => ({ meta: [{ title: 'Your List' }] }),
  component: Wishlist,
})

function Wishlist() {
  const loaded = Route.useLoaderData()
  const router = useRouter()
  const toast = useToast()
  const [items, setItems] = useState(loaded)
  useEffect(() => setItems(loaded), [loaded])

  const remove = async (p: ProductCard) => {
    const before = items
    setItems((list) => list.filter((i) => i.id !== p.id))
    try {
      await toggleList({ data: { productId: p.id, on: false } })
      await router.invalidate()
    } catch {
      setItems(before)
      toast({ title: 'There was a problem', body: 'We could not remove that item. Please try again.' })
    }
  }

  return (
    <main id="main" className="mx-auto w-full max-w-[1000px] px-4 pb-12 pt-4">
      <nav aria-label="Breadcrumb" className="mb-2 text-[12px] text-muted">
        <Link to="/account" className="hover:text-link-hover hover:underline">Your Account</Link>
        <span aria-hidden="true"> › </span>
        <span className="text-link-hover">Your List</span>
      </nav>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-[28px] font-normal leading-9">Your List</h1>
        {items.length ? <span className="text-muted">{items.length} {items.length === 1 ? 'item' : 'items'} · Private</span> : null}
      </div>

      {items.length === 0 ? (
        <EmptyState title="Your List is empty" body="Tap the heart on any product page to save it here, then come back when you are ready to buy.">
          <Link to="/s" search={{ deals: true }} className="btn btn-buy">Shop today's deals</Link>
          <Link to="/" className="btn btn-plain">Continue shopping</Link>
        </EmptyState>
      ) : (
        <ul className="card divide-y divide-line">
          {items.map((p) => <Row key={p.id} p={p} onRemove={() => remove(p)} />)}
        </ul>
      )}
    </main>
  )
}

function Row({ p, onRemove }: { p: ProductCard; onRemove: () => void }) {
  const { add, busy } = useAddToCart()
  const out = p.stock === 0
  return (
    <li className="flex flex-col gap-4 p-4 sm:flex-row">
      <div className="flex min-w-0 flex-1 gap-4">
        <Link to="/dp/$id" params={{ id: String(p.id) }} className="img-well h-[110px] w-[110px] flex-none rounded p-2 sm:h-[135px] sm:w-[135px]" aria-label={p.title}>
          <img src={p.thumbnail} alt="" loading="lazy" />
        </Link>
        <div className="flex min-w-0 flex-col items-start gap-1">
          <Link to="/dp/$id" params={{ id: String(p.id) }} className="link clamp-2 text-[16px] leading-[22px]">{p.title}</Link>
          {p.brand ? <span className="text-[12px] text-muted">by {p.brand}</span> : null}
          <Rating value={p.rating} count={p.reviewCount} />
          <DealBadge price={p.price} list={p.listPrice} />
          <div className="flex items-baseline gap-2">
            <Price value={p.price} />
            {p.listPrice > p.price ? <span className="text-[12px] text-muted">List: <s>${p.listPrice.toFixed(2)}</s></span> : null}
          </div>
          {p.prime ? <PrimeBadge /> : null}
          {out ? <span className="text-[12px] text-deal">Currently unavailable</span> : p.stock <= 10 ? <span className="text-[12px] text-deal">Only {p.stock} left in stock - order soon.</span> : <span className="text-[12px] text-ok">In Stock</span>}
        </div>
      </div>
      <div className="flex flex-none flex-row gap-2 sm:w-[190px] sm:flex-col">
        <button className="btn btn-buy flex-1 sm:flex-none" disabled={busy || out} onClick={() => add(p)}>
          {out ? 'Out of stock' : busy ? 'Adding…' : 'Add to Cart'}
        </button>
        <button className="btn btn-plain flex-1 sm:flex-none" onClick={onRemove} aria-label={`Remove ${p.title} from Your List`}>Remove</button>
      </div>
    </li>
  )
}
