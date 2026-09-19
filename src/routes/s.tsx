import { createFileRoute } from '@tanstack/react-router'
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
  component: () => <main id="main" className="p-8">TODO /s</main>,
})
