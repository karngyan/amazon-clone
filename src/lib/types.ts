export type Product = {
  id: number
  title: string
  description: string
  category: string
  brand: string | null
  price: number
  listPrice: number
  rating: number
  reviewCount: number
  stock: number
  sold: number
  prime: boolean
  thumbnail: string
  images: string[]
  tags: string[]
  bullets: string[]
  shipping: string | null
  warranty: string | null
  returnPolicy: string | null
}

export type ProductCard = Pick<
  Product,
  'id' | 'title' | 'category' | 'brand' | 'price' | 'listPrice' | 'rating' | 'reviewCount' | 'prime' | 'thumbnail' | 'stock' | 'sold'
>

export type Review = {
  id: number
  name: string
  rating: number
  title: string
  body: string
  verified: boolean
  createdAt: string
}

export type CartLine = ProductCard & { qty: number; saved: boolean }

export type Address = {
  id: number
  fullName: string
  line1: string
  line2: string | null
  city: string
  state: string
  zip: string
  country: string
  phone: string | null
  isDefault: boolean
}

export type OrderItem = { productId: number; title: string; thumbnail: string; price: number; qty: number }

export type Order = {
  id: string
  status: 'placed' | 'shipped' | 'delivered' | 'cancelled'
  subtotal: number
  shipping: number
  tax: number
  total: number
  address: Omit<Address, 'id' | 'isDefault'>
  paymentLabel: string
  deliveryOption: string
  eta: string
  createdAt: string
  items: OrderItem[]
}

export type User = { id: number; name: string; email: string }

export type SearchParams = {
  q?: string
  category?: string
  min?: number
  max?: number
  rating?: number
  prime?: boolean
  deals?: boolean
  sort?: 'featured' | 'price-asc' | 'price-desc' | 'rating' | 'newest' | 'bestsellers'
  page?: number
}
