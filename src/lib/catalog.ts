// Departments group the raw dataset categories the way Amazon's nav does.
export const DEPARTMENTS: { slug: string; name: string; categories: string[] }[] = [
  { slug: 'electronics', name: 'Electronics', categories: ['smartphones', 'laptops', 'tablets', 'mobile-accessories'] },
  { slug: 'fashion', name: 'Fashion', categories: ['mens-shirts', 'mens-shoes', 'mens-watches', 'tops', 'womens-dresses', 'womens-shoes', 'womens-bags', 'womens-watches', 'womens-jewellery', 'sunglasses'] },
  { slug: 'beauty', name: 'Beauty & Personal Care', categories: ['beauty', 'fragrances', 'skin-care'] },
  { slug: 'home', name: 'Home & Kitchen', categories: ['furniture', 'home-decoration', 'kitchen-accessories'] },
  { slug: 'grocery', name: 'Grocery', categories: ['groceries'] },
  { slug: 'sports', name: 'Sports & Outdoors', categories: ['sports-accessories'] },
  { slug: 'automotive', name: 'Automotive', categories: ['motorcycle', 'vehicle'] },
]

const NAMES: Record<string, string> = {
  beauty: 'Makeup',
  fragrances: 'Fragrances',
  furniture: 'Furniture',
  groceries: 'Grocery & Gourmet Food',
  'home-decoration': 'Home Décor',
  'kitchen-accessories': 'Kitchen & Dining',
  laptops: 'Laptops',
  'mens-shirts': "Men's Shirts",
  'mens-shoes': "Men's Shoes",
  'mens-watches': "Men's Watches",
  'mobile-accessories': 'Cell Phone Accessories',
  motorcycle: 'Motorcycles',
  'skin-care': 'Skin Care',
  smartphones: 'Cell Phones',
  'sports-accessories': 'Sports & Fitness',
  sunglasses: 'Sunglasses',
  tablets: 'Tablets',
  tops: "Women's Tops",
  vehicle: 'Vehicles',
  'womens-bags': 'Handbags',
  'womens-dresses': 'Dresses',
  'womens-jewellery': 'Jewelry',
  'womens-shoes': "Women's Shoes",
  'womens-watches': "Women's Watches",
}

export const categoryName = (slug: string) =>
  NAMES[slug] ?? DEPARTMENTS.find((d) => d.slug === slug)?.name ?? slug

export const departmentOf = (category: string) => DEPARTMENTS.find((d) => d.categories.includes(category))

/** A search "category" param may be a department or a leaf category. */
export const expandCategory = (slug: string): string[] =>
  DEPARTMENTS.find((d) => d.slug === slug)?.categories ?? [slug]

export const ALL_CATEGORIES = Object.keys(NAMES)
