import { Link, createFileRoute } from '@tanstack/react-router'
import { Hero, type HeroSlide } from '#/components/browse/Hero'
import { RecentlyViewed } from '#/components/browse/RecentlyViewed'
import { Rail } from '#/components/ui'
import { categoryName } from '#/lib/catalog'
import { discountPct } from '#/lib/format'
import type { ProductCard, SearchParams } from '#/lib/types'
import { getHome } from '#/server/fns'

export const Route = createFileRoute('/')({
  loader: () => getHome(),
  head: () => ({ meta: [{ title: 'Demo store - hiring assignment rebuild (not Amazon)' }] }),
  component: Home,
})

function QuadCard({ title, items, search, label, cta = 'See more' }: {
  title: string
  items: ProductCard[]
  search: SearchParams
  label?: (p: ProductCard) => React.ReactNode
  cta?: string
}) {
  if (!items.length) return null
  return (
    <section className="flex flex-col bg-white p-5">
      <h2 className="mb-3 text-[21px] font-bold leading-7">{title}</h2>
      <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3">
        {items.slice(0, 4).map((p) => (
          <Link key={p.id} to="/dp/$id" params={{ id: String(p.id) }} className="group block min-w-0" aria-label={p.title}>
            <div className="img-well aspect-square p-2">
              <img src={p.thumbnail} alt="" loading="lazy" className="transition-transform duration-200 group-hover:scale-[1.04] motion-reduce:transition-none" />
            </div>
            <div className="mt-1 truncate text-[12px] leading-4 text-ink">{label ? label(p) : categoryName(p.category)}</div>
          </Link>
        ))}
      </div>
      <Link to="/s" search={search} className="link mt-4 text-[13px]">{cta}</Link>
    </section>
  )
}

function AccountCard() {
  const { user } = Route.useRouteContext()
  if (user) {
    const links = [
      { to: '/orders', label: 'Your Orders', body: 'Track, return, or buy things again' },
      { to: '/wishlist', label: 'Your List', body: 'Items you saved for later' },
      { to: '/account', label: 'Your Account', body: 'Addresses, sign-in and security' },
    ] as const
    return (
      <section className="flex flex-col bg-white p-5">
        <h2 className="mb-3 text-[21px] font-bold leading-7">Welcome back, {user.name.split(' ')[0]}</h2>
        <ul className="flex flex-1 flex-col gap-2">
          {links.map((l) => (
            <li key={l.to}>
              <Link to={l.to} className="block rounded-lg border border-line px-4 py-3 hover:bg-[#f7fafa]">
                <span className="block text-[15px] font-medium">{l.label}</span>
                <span className="block text-[13px] text-muted">{l.body}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link to="/s" search={{ deals: true }} className="link mt-4 text-[13px]">Shop today's deals</Link>
      </section>
    )
  }
  return (
    <section className="flex flex-col bg-white p-5">
      <h2 className="mb-3 text-[21px] font-bold leading-7">Sign in for the best experience</h2>
      <Link to="/signin" search={{ redirect: '/' } as never} className="btn btn-buy btn-block">Sign in securely</Link>
      <p className="mt-3 text-[12px]">
        New customer? <Link to="/register" search={{ redirect: '/' } as never} className="link">Start here.</Link>
      </p>
      <div className="mt-5 flex-1 rounded-lg bg-[#232f3e] p-5 text-white">
        <p className="text-[18px] font-bold leading-6">FREE delivery on Prime eligible items</p>
        <p className="mt-1 text-[13px] text-white/80">Fast, free shipping on thousands of products.</p>
        <Link to="/s" search={{ prime: true }} className="mt-3 inline-block text-[13px] text-[#8fd7e2] hover:underline">Shop Prime eligible</Link>
      </div>
    </section>
  )
}

function Home() {
  const { deals, bestsellers, topRated, quads } = Route.useLoaderData()

  const slides: HeroSlide[] = [
    { eyebrow: 'Limited time', headline: "Today's Deals are here", sub: 'Save up to 40% on top-rated picks', cta: 'Shop all deals', search: { deals: true }, bg: '#e2701a', fg: '#fff', items: deals },
    { eyebrow: 'Phones, laptops, tablets and more', headline: 'Upgrade your everyday tech', sub: 'Best-selling electronics at low prices', cta: 'Shop Electronics', search: { category: 'electronics' }, bg: '#1d4fd8', fg: '#fff', items: quads.electronics },
    { eyebrow: 'New season', headline: 'Fashion finds for fall', sub: 'Dresses, shirts, shoes and handbags', cta: 'Shop Fashion', search: { category: 'fashion' }, bg: '#f3d9c4', fg: '#0f1111', items: quads.fashion },
    { eyebrow: 'Fast, free delivery', headline: 'Prime eligible favorites', sub: 'Get it in as little as one day', cta: 'Shop Prime', search: { prime: true }, bg: '#0a6e7c', fg: '#fff', items: bestsellers.filter((p) => p.prime) },
  ]

  const pctOff = (p: ProductCard) => (
    <span className="inline-flex items-center gap-1.5">
      <span className="rounded-sm bg-deal px-1.5 py-0.5 font-medium text-white">{discountPct(p.price, p.listPrice)}% off</span>
      <span className="truncate font-bold text-deal">Limited time deal</span>
    </span>
  )
  const grid = 'grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4'

  return (
    <main id="main" className="bg-page pb-8">
      <div className="mx-auto max-w-[1500px]">
        <h1 className="sr-only">Amazon.clone home</h1>
        <Hero slides={slides} />
        <div className="relative z-10 -mt-[100px] flex flex-col gap-5 px-3 sm:-mt-[130px] sm:px-5 md:-mt-[230px]">
          <div className={grid}>
            <QuadCard title="Top picks in Electronics" items={quads.electronics} search={{ category: 'electronics' }} />
            <QuadCard title="Refresh your wardrobe" items={quads.fashion} search={{ category: 'fashion' }} />
            <QuadCard title="Home & Kitchen essentials" items={quads.home} search={{ category: 'home' }} />
            <AccountCard />
          </div>
          <Rail title="Today's Deals" items={deals} to={{ search: { deals: true } }} />
          <div className={grid}>
            <QuadCard title="Deals you'll love" items={deals.slice(4)} search={{ deals: true }} label={pctOff} cta="See all deals" />
            <QuadCard title="Beauty & Personal Care" items={quads.beauty} search={{ category: 'beauty' }} />
            <QuadCard title="Stock up on groceries" items={quads.grocery} search={{ category: 'grocery' }} />
            <QuadCard title="Customers' most-loved" items={topRated.slice(4)} search={{ sort: 'rating' }} label={(p) => p.brand ?? categoryName(p.category)} />
          </div>
          <Rail title="Best Sellers" items={bestsellers} to={{ search: { sort: 'bestsellers' } }} />
          <Rail title="Top rated" items={topRated} to={{ search: { sort: 'rating' } }} />
          <RecentlyViewed />
        </div>
      </div>
    </main>
  )
}
