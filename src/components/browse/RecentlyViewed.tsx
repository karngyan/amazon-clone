import { useEffect, useState } from 'react'
import { Rail } from '#/components/ui'
import type { ProductCard } from '#/lib/types'
import { getProductsByIds } from '#/server/fns'

const readIds = (): number[] => {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem('recentlyViewed') ?? '[]')
    return Array.isArray(raw) ? raw.map(Number).filter(Number.isInteger).slice(0, 14) : []
  } catch {
    return []
  }
}

export function RecentlyViewed() {
  const [items, setItems] = useState<ProductCard[]>([])

  useEffect(() => {
    const ids = readIds()
    if (!ids.length) return
    let live = true
    getProductsByIds({ data: { ids } })
      .then((rows) => live && setItems(rows))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  if (!items.length) return null
  return <Rail title="Your recently viewed items" items={items} />
}
