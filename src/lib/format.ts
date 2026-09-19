export const money = (n: number) => `$${n.toFixed(2)}`

export const splitPrice = (n: number) => {
  const [whole, cents] = n.toFixed(2).split('.')
  return { whole: Number(whole).toLocaleString('en-US'), cents }
}

export const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}K` : String(n)

export const boughtLabel = (sold: number) => {
  const step = sold >= 1000 ? Math.floor(sold / 1000) * 1000 : Math.floor(sold / 100) * 100
  return step >= 100 ? `${compact(step)}+ bought in past month` : null
}

export const discountPct = (price: number, list: number) =>
  list > price ? Math.round((1 - price / list) * 100) : 0

const day = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })

/** Delivery promise shown on cards: free in 4 days, fastest in 1. */
export const deliveryDates = (from = new Date()) => {
  const at = (n: number) => day(new Date(from.getTime() + n * 86400000))
  return { free: at(4), fast: at(1) }
}

export const longDate = (iso: string) =>
  new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
