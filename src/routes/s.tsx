import { Link, createFileRoute, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { PrimeBadge, ProductCard, Stars } from '#/components/ui'
import { DEPARTMENTS, categoryName, departmentOf } from '#/lib/catalog'
import type { SearchParams } from '#/lib/types'
import { searchProducts } from '#/server/fns'

const SORTS = ['featured', 'price-asc', 'price-desc', 'rating', 'newest', 'bestsellers'] as const
const num = (v: unknown) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? undefined : Number(v))

export const Route = createFileRoute('/s')({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    q: typeof s.q === 'string' && s.q ? s.q : undefined,
    category: typeof s.category === 'string' && s.category ? s.category : undefined,
    min: num(s.min),
    max: num(s.max),
    rating: num(s.rating),
    prime: s.prime === true || s.prime === 'true' ? true : undefined,
    deals: s.deals === true || s.deals === 'true' ? true : undefined,
    sort: SORTS.includes(s.sort as never) ? (s.sort as SearchParams['sort']) : undefined,
    page: num(s.page),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => searchProducts({ data: deps }),
  head: ({ match }) => ({ meta: [{ title: `Demo store : ${headingFor(match.search)}` }] }),
  component: SearchPage,
})

const SORT_LABELS: Record<(typeof SORTS)[number], string> = {
  featured: 'Featured',
  'price-asc': 'Price: Low to High',
  'price-desc': 'Price: High to Low',
  rating: 'Avg. Customer Review',
  newest: 'Newest Arrivals',
  bestsellers: 'Best Sellers',
}

const PRICE_RANGES: { label: string; min?: number; max?: number }[] = [
  { label: 'Under $25', max: 25 },
  { label: '$25 to $50', min: 25, max: 50 },
  { label: '$50 to $100', min: 50, max: 100 },
  { label: '$100 to $200', min: 100, max: 200 },
  { label: '$200 & Above', min: 200 },
]

function headingFor(s: SearchParams) {
  if (s.q) return s.q
  if (s.category) return categoryName(s.category)
  if (s.deals) return "Today's Deals"
  if (s.sort === 'bestsellers') return 'Best Sellers'
  if (s.sort === 'newest') return 'New Releases'
  if (s.prime) return 'Prime Eligible'
  if (s.sort === 'rating') return 'Top Rated'
  return 'All Departments'
}

const priceLabel = (min?: number, max?: number) =>
  PRICE_RANGES.find((r) => r.min === min && r.max === max)?.label ??
  (min != null && max != null ? `$${min} to $${max}` : min != null ? `$${min} & Above` : `Under $${max}`)

/** Every filter is a real link so it works before hydration and can be opened in a new tab. */
function Filter({ patch, active, children, className = '' }: { patch: Partial<SearchParams>; active?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <Link
      from="/s"
      to="/s"
      search={(prev) => ({ ...prev, ...patch, page: undefined })}
      aria-current={active ? 'true' : undefined}
      className={`hover:text-link-hover ${active ? 'font-bold' : ''} ${className}`}
    >
      {children}
    </Link>
  )
}

function Group({ title, clear, children }: { title: string; clear?: Partial<SearchParams>; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="text-[14px] font-bold leading-5">{title}</h2>
        {clear ? <Filter patch={clear} className="link text-[12px]">Clear</Filter> : null}
      </div>
      {children}
    </section>
  )
}

const Check = ({ on }: { on: boolean }) => (
  <span aria-hidden="true" className={`flex size-4 flex-none items-center justify-center rounded-[3px] border ${on ? 'border-[#007185] bg-[#007185]' : 'border-[#888c8c] bg-white shadow-[inset_0_1px_2px_rgba(15,17,17,.15)]'}`}>
    {on ? <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l2.6 2.8L9 1" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
  </span>
)

function Sidebar() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { facets } = Route.useLoaderData()
  const [min, setMin] = useState(search.min?.toString() ?? '')
  const [max, setMax] = useState(search.max?.toString() ?? '')
  useEffect(() => {
    setMin(search.min?.toString() ?? '')
    setMax(search.max?.toString() ?? '')
  }, [search.min, search.max])

  const dept = search.category ? (DEPARTMENTS.find((d) => d.slug === search.category) ?? departmentOf(search.category)) : undefined
  const count = (slugs: string[]) => facets.categories.reduce((n, c) => (slugs.includes(c.slug) ? n + c.n : n), 0)
  const depts = DEPARTMENTS.map((d) => ({ ...d, n: count(d.categories) })).filter((d) => d.n > 0)
  const n = (v: number) => <span className="text-muted font-normal"> ({v})</span>

  return (
    <>
      <Group title="Department">
        <ul className="flex flex-col gap-1">
          {search.category ? (
            <>
              <li><Filter patch={{ category: undefined }}><span aria-hidden="true">‹ </span>Any Department</Filter></li>
              {dept ? <li className="pl-2"><Filter patch={{ category: dept.slug }} active={search.category === dept.slug}>{dept.name}</Filter></li> : null}
              {facets.categories.map((c) => (
                <li key={c.slug} className="pl-5"><Filter patch={{ category: c.slug }} active={search.category === c.slug}>{categoryName(c.slug)}{n(c.n)}</Filter></li>
              ))}
            </>
          ) : depts.length ? (
            depts.map((d) => <li key={d.slug}><Filter patch={{ category: d.slug }}>{d.name}{n(d.n)}</Filter></li>)
          ) : (
            <li className="text-muted">No departments match</li>
          )}
        </ul>
      </Group>

      <Group title="Customer Reviews" clear={search.rating ? { rating: undefined } : undefined}>
        <ul className="flex flex-col gap-1">
          {[4, 3, 2, 1].map((r) => (
            <li key={r}>
              <Filter patch={{ rating: r }} active={search.rating === r} className="inline-flex items-center gap-1.5">
                <Stars value={r} size={17} /> <span>& Up</span>
              </Filter>
            </li>
          ))}
        </ul>
      </Group>

      <Group title="Price" clear={search.min != null || search.max != null ? { min: undefined, max: undefined } : undefined}>
        <ul className="flex flex-col gap-1">
          {PRICE_RANGES.map((r) => (
            <li key={r.label}><Filter patch={{ min: r.min, max: r.max }} active={search.min === r.min && search.max === r.max && (r.min != null || r.max != null)}>{r.label}</Filter></li>
          ))}
        </ul>
        <form
          className="mt-2 flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            let lo = num(min)
            let hi = num(max)
            if (lo != null && hi != null && lo > hi) [lo, hi] = [hi, lo]
            navigate({ search: (prev) => ({ ...prev, min: lo != null && lo >= 0 ? lo : undefined, max: hi != null && hi >= 0 ? hi : undefined, page: undefined }) })
          }}
        >
          <label className="sr-only" htmlFor="price-min">Minimum price</label>
          <input id="price-min" className="field !w-[68px] !px-1.5 !py-1 text-[13px]" inputMode="decimal" placeholder="$ Min" value={min} onChange={(e) => setMin(e.target.value.replace(/[^\d.]/g, ''))} />
          <label className="sr-only" htmlFor="price-max">Maximum price</label>
          <input id="price-max" className="field !w-[68px] !px-1.5 !py-1 text-[13px]" inputMode="decimal" placeholder="$ Max" value={max} onChange={(e) => setMax(e.target.value.replace(/[^\d.]/g, ''))} />
          <button type="submit" className="btn btn-plain !px-3 !py-1 text-[13px]" disabled={!min && !max}>Go</button>
        </form>
      </Group>

      <Group title="Delivery" clear={search.prime ? { prime: undefined } : undefined}>
        <Filter patch={{ prime: search.prime ? undefined : true }} className="inline-flex items-center gap-2">
          <span role="checkbox" aria-checked={!!search.prime} className="inline-flex items-center gap-2"><Check on={!!search.prime} /><PrimeBadge /></span>
        </Filter>
      </Group>

      <Group title="Deals & Discounts" clear={search.deals ? { deals: undefined } : undefined}>
        <Filter patch={{ deals: search.deals ? undefined : true }} className="inline-flex items-center gap-2">
          <span role="checkbox" aria-checked={!!search.deals} className="inline-flex items-center gap-2"><Check on={!!search.deals} />Today's Deals</span>
        </Filter>
      </Group>

      {facets.brands.length ? (
        <Group title="Brands" clear={facets.brands.some((b) => b.brand.toLowerCase() === search.q?.toLowerCase()) ? { q: undefined } : undefined}>
          <ul className="flex flex-col gap-1">
            {facets.brands.map((b) => (
              <li key={b.brand}><Filter patch={{ q: b.brand }} active={b.brand.toLowerCase() === search.q?.toLowerCase()}>{b.brand}{n(b.n)}</Filter></li>
            ))}
          </ul>
        </Group>
      ) : null}
    </>
  )
}

function Chips() {
  const s = Route.useSearch()
  const chips: { label: string; patch: Partial<SearchParams> }[] = []
  if (s.q && s.category) chips.push({ label: categoryName(s.category), patch: { category: undefined } })
  if (s.rating) chips.push({ label: `${s.rating} Stars & Up`, patch: { rating: undefined } })
  if (s.min != null || s.max != null) chips.push({ label: priceLabel(s.min, s.max), patch: { min: undefined, max: undefined } })
  if (s.prime) chips.push({ label: 'Prime', patch: { prime: undefined } })
  if (s.deals && (s.q || s.category)) chips.push({ label: "Today's Deals", patch: { deals: undefined } })
  if (!chips.length) return null
  return (
    <ul className="mb-3 flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((c) => (
        <li key={c.label}>
          <Filter patch={c.patch} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-[#f0f2f2] px-3 py-1 text-[13px] hover:!text-ink hover:bg-[#e3e6e6]">
            {c.label}
            <span aria-hidden="true" className="text-[15px] leading-none text-muted">×</span>
            <span className="sr-only">Remove filter</span>
          </Filter>
        </li>
      ))}
      {chips.length > 1 ? (
        <li><Filter patch={{ category: s.q ? undefined : s.category, rating: undefined, min: undefined, max: undefined, prime: undefined, deals: s.q || s.category ? undefined : s.deals }} className="link text-[13px]">Clear all</Filter></li>
      ) : null}
    </ul>
  )
}

function Pagination({ page, pages }: { page: number; pages: number }) {
  if (pages <= 1) return null
  const nums = [...new Set([1, page - 1, page, page + 1, pages])].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b)
  const cell = 'flex h-[46px] min-w-[46px] items-center justify-center px-3 text-[14px]'
  const go = (p: number, label: React.ReactNode, aria?: string) => (
    <Link from="/s" to="/s" search={(prev) => ({ ...prev, page: p > 1 ? p : undefined })} aria-label={aria} className={`${cell} rounded-sm hover:bg-[#f7fafa] hover:shadow-[inset_0_0_0_1px_#d5d9d9]`}>{label}</Link>
  )
  const off = (label: string) => <span aria-disabled="true" className={`${cell} cursor-not-allowed text-[#6f7373]/60`}>{label}</span>
  return (
    <nav aria-label="Pagination" className="mt-8 flex justify-center">
      <ul className="flex flex-wrap items-center rounded-lg border border-line bg-white px-1 shadow-[0_2px_5px_rgba(213,217,217,.5)]">
        <li>{page > 1 ? go(page - 1, '‹ Previous', 'Go to previous page') : off('‹ Previous')}</li>
        {nums.map((p, i) => (
          <li key={p} className="flex items-center">
            {i > 0 && p - nums[i - 1] > 1 ? <span aria-hidden="true" className="px-1 text-muted">…</span> : null}
            {p === page ? (
              <span aria-current="page" aria-label={`Current page, page ${p}`} className={`${cell} rounded-sm border border-ink font-medium`}>{p}</span>
            ) : (
              go(p, p, `Go to page ${p}`)
            )}
          </li>
        ))}
        <li>{page < pages ? go(page + 1, 'Next ›', 'Go to next page') : off('Next ›')}</li>
      </ul>
    </nav>
  )
}

function SearchPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { items, total, page, pages, pageSize } = Route.useLoaderData()
  const loading = useRouterState({ select: (s) => s.isLoading })
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [page])

  const from = total ? (page - 1) * pageSize + 1 : 0
  const to = Math.min(total, page * pageSize)
  const filtered = search.rating || search.min != null || search.max != null || search.prime || search.deals || (search.q && search.category)

  return (
    <main id="main" className="bg-white">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-3 py-2 shadow-[0_1px_3px_rgba(15,17,17,.08)] sm:px-5">
        <h1 className="min-w-0 text-[14px] leading-5" aria-live="polite">
          {total ? <>{from}-{to} of {total.toLocaleString('en-US')} results{search.q ? ' for ' : ' in '}</> : <>No results{search.q ? ' for ' : ' in '}</>}
          <span className="font-bold text-[#c45500]">{search.q ? `"${search.q}"` : headingFor(search)}</span>
        </h1>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-plain !py-1 text-[12px] md:hidden" aria-expanded={filtersOpen} aria-controls="filters" onClick={() => setFiltersOpen((o) => !o)}>
            Filters{filtered ? ' •' : ''}
          </button>
          <label className="flex items-center gap-1 rounded-lg border border-line bg-[#f0f2f2] py-1 pl-2.5 pr-1 text-[12px] shadow-[0_2px_5px_rgba(15,17,17,.15)] hover:bg-[#e3e6e6] focus-within:border-[#007185] focus-within:shadow-[0_0_0_3px_#c8f3fa]">
            <span>Sort by:</span>
            <select
              className="cursor-pointer bg-transparent outline-none"
              value={search.sort ?? 'featured'}
              onChange={(e) => {
                const sort = e.target.value as (typeof SORTS)[number]
                navigate({ search: (prev) => ({ ...prev, sort: sort === 'featured' ? undefined : sort, page: undefined }) })
              }}
            >
              {SORTS.map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1800px] flex-col gap-x-6 px-3 py-4 sm:px-5 md:flex-row">
        <aside id="filters" aria-label="Filters" className={`${filtersOpen ? 'block' : 'hidden'} mb-4 w-full flex-none border-b border-line pb-2 text-[14px] leading-5 md:mb-0 md:block md:w-[220px] md:border-b-0 md:border-r md:pb-0 md:pr-4`}>
          <Sidebar />
        </aside>

        <div className={`min-w-0 flex-1 transition-opacity duration-150 ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
          <Chips />
          {items.length ? (
            <>
              <h2 className="text-[20px] font-bold leading-7">Results</h2>
              <p className="mb-3 text-[14px] text-muted">Check each product page for other buying options.</p>
              <ul className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((p) => (
                  <li key={p.id} className="min-w-0 rounded-sm border border-[#f0f2f2] bg-white p-2 hover:border-line sm:p-3">
                    <ProductCard p={p} />
                  </li>
                ))}
              </ul>
              <Pagination page={page} pages={pages} />
            </>
          ) : (
            <div className="py-6">
              <h2 className="text-[20px] leading-7">
                No results for <span className="font-bold">{search.q ? `"${search.q}"` : headingFor(search)}</span>{filtered ? ' with the selected filters' : ''}.
              </h2>
              <p className="mt-1 text-[14px] text-muted">Try checking your spelling or use more general terms</p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-[14px]">
                {filtered ? (
                  <Link to="/s" search={{ q: search.q, category: search.q ? undefined : search.category }} className="btn btn-plain">Clear filters</Link>
                ) : null}
                <Link to="/s" search={{ sort: 'bestsellers' }} className="link">Shop Best Sellers</Link>
                <Link to="/s" search={{ deals: true }} className="link">See Today's Deals</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
