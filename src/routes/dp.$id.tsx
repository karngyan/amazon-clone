import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { useEffect } from 'react'
import { BuyBox } from '#/components/product/BuyBox'
import { Gallery } from '#/components/product/Gallery'
import { Reviews } from '#/components/product/Reviews'
import { Breadcrumbs, DealBadge, Price, PrimeBadge, Rail, Rating } from '#/components/ui'
import { categoryName, departmentOf } from '#/lib/catalog'
import { boughtLabel, discountPct, money } from '#/lib/format'
import { getProduct } from '#/server/fns'

export const Route = createFileRoute('/dp/$id')({
  loader: async ({ params }) => {
    const id = Number(params.id)
    if (!Number.isInteger(id) || id < 1) throw notFound()
    const data = await getProduct({ data: { id } })
    if (!data) throw notFound()
    return data
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `Amazon.clone: ${loaderData.product.title}` }] : [],
  }),
  component: ProductPage,
})

function ProductPage() {
  const { id } = Route.useParams()
  // Keyed so gallery selection, qty and review form state reset between products.
  return <ProductView key={id} />
}

function ProductView() {
  const { product, reviews, histogram, related, alsoBought, inList } = Route.useLoaderData()
  const { user } = Route.useRouteContext()

  useEffect(() => {
    try {
      const prev: unknown = JSON.parse(localStorage.getItem('recentlyViewed') ?? '[]')
      const ids = Array.isArray(prev) ? prev.filter((n): n is number => Number.isInteger(n)) : []
      localStorage.setItem('recentlyViewed', JSON.stringify([product.id, ...ids.filter((n) => n !== product.id)].slice(0, 12)))
    } catch {
      // Storage can be blocked (private mode); recently viewed is a nicety.
    }
  }, [product.id])

  const dept = departmentOf(product.category)
  const pct = discountPct(product.price, product.listPrice)
  const bought = boughtLabel(product.sold)
  const images = product.images.length ? product.images : [product.thumbnail]
  const specs = [
    ['Brand', product.brand],
    ['Category', categoryName(product.category)],
    ['Warranty', product.warranty],
    ['Shipping', product.shipping],
    ['Return policy', product.returnPolicy],
  ].filter((s): s is [string, string] => Boolean(s[1]))

  return (
    <main id="main" className="bg-white">
      <div className="mx-auto max-w-[1500px] px-4 pb-8 pt-3 sm:px-5">
        <Breadcrumbs
          items={[
            ...(dept ? [{ label: dept.name, search: { category: dept.slug } }] : []),
            { label: categoryName(product.category), search: { category: product.category } },
          ]}
        />

        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 md:grid-rows-[auto_1fr] md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)_244px]">
          <div className="order-2 md:order-none md:row-span-2 lg:row-span-2">
            <div className="md:sticky md:top-4"><Gallery images={images} title={product.title} /></div>
          </div>

          <div className="order-1 md:order-none">
            <h1 className="text-[20px] font-normal leading-7 sm:text-[24px] sm:leading-8">{product.title}</h1>
            {product.brand ? (
              <Link to="/s" search={{ q: product.brand } as never} className="link text-[14px]">Visit the {product.brand} Store</Link>
            ) : null}
            <div className="mt-1">
              <a href="#reviews" className="inline-flex rounded-sm hover:[&_.text-link]:text-link-hover hover:[&_.text-link]:underline" aria-label={`${product.rating.toFixed(1)} out of 5 stars, ${product.reviewCount} ratings. Jump to reviews`}>
                <Rating value={product.rating} count={product.reviewCount} size={18} />
              </a>
            </div>
            {bought ? <p className="mt-1 text-[14px]"><b>{bought.split(' ')[0]}</b> {bought.split(' ').slice(1).join(' ')}</p> : null}
          </div>

          <div className="order-3 md:order-none md:col-start-2 lg:col-start-3 lg:row-span-2 lg:row-start-1">
            <div className="lg:sticky lg:top-4"><BuyBox product={product} inList={inList} user={user} /></div>
          </div>

          <div className="order-4 md:order-none md:col-span-2 lg:col-span-1 lg:col-start-2 lg:row-start-2">
            <hr className="mb-3 border-line" />
            <DealBadge price={product.price} list={product.listPrice} />
            <div className="mt-1.5 flex items-start gap-2">
              {pct > 0 ? <span className="text-[28px] font-light leading-none text-deal">-{pct}%</span> : null}
              <Price value={product.price} size="lg" />
            </div>
            {pct > 0 ? <p className="mt-1 text-[12px] text-muted">List Price: <s>{money(product.listPrice)}</s></p> : null}
            <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[14px]">
              {product.prime ? <PrimeBadge /> : null}
              <span className="text-link">FREE Returns</span>
            </p>

            {specs.length ? (
              <table className="mt-4 w-full max-w-[520px] text-[14px] leading-5">
                <tbody>
                  {specs.map(([k, v]) => (
                    <tr key={k}>
                      <th scope="row" className="w-[130px] py-1 pr-3 text-left align-top font-bold">{k}</th>
                      <td className="py-1">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            <hr className="my-4 border-line" />
            <h2 className="text-[16px] font-bold">About this item</h2>
            {product.bullets.length ? (
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] leading-5">
                {product.bullets.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            ) : (
              <p className="mt-2 text-[14px] leading-5">{product.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1500px] divide-y divide-line border-t border-line">
        <Rail title="Products related to this item" items={related} to={{ search: { category: product.category } }} />
        <Rail title="Customers who viewed this item also viewed" items={alsoBought} />
        <Reviews product={product} reviews={reviews} histogram={histogram} signedIn={Boolean(user)} />
      </div>
    </main>
  )
}
