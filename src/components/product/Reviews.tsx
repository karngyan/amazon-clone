import { useNavigate, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Stars } from '#/components/ui'
import { useToast } from '#/components/toast'
import { longDate } from '#/lib/format'
import type { Product, Review } from '#/lib/types'
import { addReview } from '#/server/fns'

type Props = {
  product: Product
  reviews: Review[]
  histogram: { rating: number; n: number }[]
  signedIn: boolean
}

export function Reviews({ product, reviews, histogram, signedIn }: Props) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<number | null>(null)
  const [sort, setSort] = useState<'top' | 'recent'>('top')
  const [writing, setWriting] = useState(false)
  const total = histogram.reduce((s, h) => s + h.n, 0)

  const shown = useMemo(() => {
    const list = filter ? reviews.filter((r) => r.rating === filter) : [...reviews]
    const byDate = (a: Review, b: Review) => b.createdAt.localeCompare(a.createdAt)
    return list.sort(sort === 'recent' ? byDate : (a, b) => Number(b.verified) - Number(a.verified) || b.rating - a.rating || byDate(a, b))
  }, [reviews, filter, sort])

  const startWriting = () => {
    if (!signedIn) {
      navigate({ to: '/signin', search: { redirect: `/dp/${product.id}#reviews` } as never })
      return
    }
    setWriting(true)
  }

  return (
    <section id="reviews" className="scroll-mt-4 bg-white p-5" aria-labelledby="reviews-h">
      <div className="grid gap-8 md:grid-cols-[300px_minmax(0,1fr)] lg:gap-14">
        <div>
          <h2 id="reviews-h" className="text-[24px] font-bold leading-8">Customer reviews</h2>
          <div className="mt-1 flex items-center gap-2">
            <Stars value={product.rating} size={20} />
            <span className="text-[18px]">{product.rating.toFixed(1)} out of 5</span>
          </div>
          <p className="mt-1 text-muted">{product.reviewCount.toLocaleString('en-US')} global ratings</p>

          <ul className="mt-4 space-y-3">
            {histogram.map((h) => {
              const pct = total ? Math.round((h.n / total) * 100) : 0
              const on = filter === h.rating
              return (
                <li key={h.rating}>
                  <button
                    type="button"
                    disabled={!h.n}
                    aria-pressed={on}
                    aria-label={`${h.rating} star: ${pct}% of reviews. ${on ? 'Remove filter' : 'Show only these reviews'}`}
                    onClick={() => setFilter(on ? null : h.rating)}
                    className="group flex w-full items-center gap-3 text-[14px] text-link enabled:hover:text-link-hover disabled:cursor-default disabled:text-muted"
                  >
                    <span className={`w-11 flex-none whitespace-nowrap text-left group-enabled:group-hover:underline ${on ? 'font-bold' : ''}`}>{h.rating} star</span>
                    <span className={`h-5 flex-1 overflow-hidden rounded-[4px] bg-[#f0f2f2] shadow-[inset_0_0_0_1px_#888c8c] ${on ? 'ring-2 ring-[#007185] ring-offset-1' : ''}`}>
                      <span className="block h-full rounded-l-[4px] bg-[#de7921] transition-[width] duration-300" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-9 flex-none text-right tabular-nums">{pct}%</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {filter ? (
            <button type="button" className="link mt-3 text-[13px]" onClick={() => setFilter(null)}>Clear filter</button>
          ) : null}

          <hr className="my-6 border-line" />
          <h3 className="text-[18px] font-bold">Review this product</h3>
          <p className="mt-1">Share your thoughts with other customers</p>
          <button type="button" className="btn btn-plain btn-block mt-4" onClick={startWriting} aria-expanded={writing} disabled={writing}>
            Write a customer review
          </button>
        </div>

        <div className="min-w-0">
          {writing ? <ReviewForm product={product} onDone={() => setWriting(false)} /> : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-[18px] font-bold">{filter ? `${filter} star reviews` : sort === 'top' ? 'Top reviews' : 'Most recent reviews'}</h3>
            <label className="inline-flex items-center gap-1 rounded-lg border border-line bg-[#f0f2f2] px-2 py-1 text-[13px] shadow-[0_2px_5px_rgba(15,17,17,.15)] hover:bg-[#e3e6e6]">
              <span className="sr-only">Sort reviews by</span>
              <select className="cursor-pointer bg-transparent outline-none" value={sort} onChange={(e) => setSort(e.target.value as 'top' | 'recent')}>
                <option value="top">Top reviews</option>
                <option value="recent">Most recent</option>
              </select>
            </label>
          </div>

          {shown.length ? (
            <ul className="mt-4 space-y-7">
              {shown.map((r) => <ReviewItem key={r.id} r={r} />)}
            </ul>
          ) : (
            <div className="mt-4 rounded-lg border border-line p-5">
              <p className="font-bold">{filter ? `No ${filter} star reviews yet` : 'No customer reviews yet'}</p>
              <p className="mt-1 text-muted">
                {filter ? 'Try another rating, or clear the filter to see all reviews.' : 'Be the first to share what you think of this item.'}
              </p>
              {filter ? <button type="button" className="link mt-2 text-[13px]" onClick={() => setFilter(null)}>Clear filter</button> : null}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function ReviewItem({ r }: { r: Review }) {
  const [helpful, setHelpful] = useState(false)
  return (
    <li>
      <div className="flex items-center gap-2.5">
        <span className="flex h-[34px] w-[34px] flex-none items-end justify-center overflow-hidden rounded-full bg-[#d5d9d9]" aria-hidden="true">
          <svg width="26" height="28" viewBox="0 0 26 28"><circle cx="13" cy="10" r="6" fill="#fff" /><path d="M1 30c0-8 5-13 12-13s12 5 12 13z" fill="#fff" /></svg>
        </span>
        <span className="text-[13px]">{r.name}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2">
        <Stars value={r.rating} />
        <span className="font-bold">{r.title}</span>
      </div>
      <p className="mt-0.5 text-[13px] text-muted">Reviewed on {longDate(r.createdAt)}</p>
      {r.verified ? <p className="text-[12px] font-bold text-[#c45500]">Verified Purchase</p> : null}
      <p className="mt-1.5 whitespace-pre-line leading-5">{r.body}</p>
      <div className="mt-2.5 flex items-center gap-3 text-[13px]">
        {helpful ? (
          <span className="flex items-center gap-1.5 text-ok" role="status">
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#007600" /><path d="M4.5 8.2l2.3 2.3 4.7-4.9" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
            Thank you for your feedback.
          </span>
        ) : (
          <button type="button" className="btn btn-plain !px-6 !py-1 text-[13px]" onClick={() => setHelpful(true)}>Helpful</button>
        )}
        <span className="h-4 w-px bg-line" aria-hidden="true" />
        <button type="button" className="text-muted hover:text-link-hover hover:underline">Report</button>
      </div>
    </li>
  )
}

const LABELS = ['', 'I hate it', "I don't like it", "It's okay", 'I like it', 'I love it']

function ReviewForm({ product, onDone }: { product: Product; onDone: () => void }) {
  const router = useRouter()
  const toast = useToast()
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating) return setError('Please select a star rating.')
    if (!title.trim() || !body.trim()) return setError('Please add a headline and a written review.')
    setBusy(true)
    setError(null)
    try {
      await addReview({ data: { productId: product.id, rating, title, body } })
      await router.invalidate()
      toast({ title: 'Review submitted', body: 'Thanks for helping other customers.', image: product.thumbnail })
      onDone()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(msg && msg.length < 160 ? msg : 'We could not submit your review. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const lit = hover || rating
  return (
    <form onSubmit={submit} className="pop-in mb-8 rounded-lg border border-line p-5" aria-labelledby="review-form-h">
      <div className="flex items-start justify-between gap-3">
        <h3 id="review-form-h" className="text-[21px] font-bold leading-7">Create Review</h3>
        <button type="button" className="link text-[13px]" onClick={onDone}>Cancel</button>
      </div>
      <div className="mt-3 flex items-center gap-3 border-b border-line pb-4">
        <div className="img-well h-12 w-12 flex-none rounded-sm p-1"><img src={product.thumbnail} alt="" /></div>
        <span className="clamp-2 text-[13px] leading-[18px]">{product.title}</span>
      </div>

      <div aria-live="assertive">
        {error ? (
          <div className="mt-4 flex gap-3 rounded-lg border border-[#c40000] p-3.5 shadow-[inset_0_0_0_2px_#fcf4f4]">
            <svg width="22" height="22" viewBox="0 0 24 24" className="flex-none" aria-hidden="true"><path d="M12 2l11 20H1z" fill="#c40000" /><path d="M12 9v6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" /><circle cx="12" cy="18.2" r="1.3" fill="#fff" /></svg>
            <div>
              <p className="text-[17px] leading-6 text-[#c40000]">There was a problem</p>
              <p className="text-[13px]">{error}</p>
            </div>
          </div>
        ) : null}
      </div>

      <fieldset className="mt-4">
        <legend className="text-[17px] font-bold">Overall rating</legend>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex" role="radiogroup" aria-label="Overall rating" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="cursor-pointer rounded p-0.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#007185]" onMouseEnter={() => setHover(n)}>
                <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only" aria-label={`${n} star${n > 1 ? 's' : ''}: ${LABELS[n]}`} />
                <svg width="34" height="34" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M10 1.5l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9L4.7 18l1.1-6L1.4 7.8l6-.8z" fill={n <= lit ? '#de7921' : '#fff'} stroke="#de7921" strokeWidth="1" strokeLinejoin="round" />
                </svg>
              </label>
            ))}
          </div>
          <span className="text-[13px] text-muted">{LABELS[lit]}</span>
        </div>
      </fieldset>

      <label className="mt-5 block">
        <span className="text-[17px] font-bold">Add a headline</span>
        <input className="field mt-2 w-full" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="What's most important to know?" />
      </label>
      <label className="mt-5 block">
        <span className="text-[17px] font-bold">Add a written review</span>
        <textarea className="field mt-2 min-h-[120px] w-full" value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} placeholder="What did you like or dislike? What did you use this product for?" />
      </label>
      <div className="mt-4 flex justify-end">
        <button type="submit" className="btn btn-buy min-w-[120px]" disabled={busy}>{busy ? 'Submitting…' : 'Submit'}</button>
      </div>
    </form>
  )
}
