// Turns data/dummyjson-products.json (open dataset, dummyjson.com) into a D1 seed migration.
import { readFileSync, writeFileSync } from 'node:fs'

const { products } = JSON.parse(readFileSync('data/dummyjson-products.json', 'utf8'))
const q = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
const img = (u) =>
  '/p/' + u.split('product-images/')[1].replace(/\//g, '__').replace(/[^A-Za-z0-9_.-]/g, '-')
// Small deterministic PRNG so reseeding gives the same catalogue.
const rand = (seed) => {
  let x = (seed * 2654435761) % 4294967296
  return () => ((x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296)
}
const titles = {
  5: ['Exactly what I needed', 'Five stars', 'Exceeded expectations', 'Would buy again'],
  4: ['Good value', 'Solid purchase', 'Pretty happy with it'],
  3: ['It is okay', 'Average', 'Does the job'],
  2: ['Not great', 'Disappointed'],
  1: ['Would not recommend', 'Returned it'],
}

const out = []
for (const p of products) {
  const r = rand(p.id)
  const price = p.price
  const listPrice = +(price / (1 - p.discountPercentage / 100)).toFixed(2)
  const rating = +Math.min(5, Math.max(3.1, p.rating * 0.35 + 3 + r() * 0.6)).toFixed(1)
  const reviewCount = Math.floor(20 + r() * r() * 24000)
  const sold = Math.floor(50 + r() * 9000)
  const prime = r() > 0.25 ? 1 : 0
  const dims = p.dimensions
  const bullets = [
    ...p.description.split(/(?<=[.!?])\s+/).filter(Boolean),
    p.brand ? `From ${p.brand}, sold and shipped with care` : null,
    p.warrantyInformation,
    p.returnPolicy,
    dims ? `Dimensions: ${dims.width} x ${dims.height} x ${dims.depth} cm, weight ${p.weight} kg` : null,
  ].filter(Boolean)
  out.push(
    `INSERT INTO products (id,title,description,category,brand,price,list_price,rating,review_count,stock,sold,prime,thumbnail,images,tags,bullets,shipping,warranty,return_policy) VALUES (${[
      p.id, q(p.title), q(p.description), q(p.category), q(p.brand ?? null), price, listPrice, rating,
      reviewCount, p.stock, sold, prime, q(img(p.thumbnail)), q(JSON.stringify(p.images.map(img))),
      q(JSON.stringify(p.tags)), q(JSON.stringify(bullets)), q(p.shippingInformation),
      q(p.warrantyInformation), q(p.returnPolicy),
    ].join(',')});`,
  )
  for (const rv of p.reviews) {
    const t = titles[rv.rating][Math.floor(r() * titles[rv.rating].length)]
    out.push(
      `INSERT INTO reviews (product_id,name,rating,title,body,verified,created_at) VALUES (${p.id},${q(rv.reviewerName)},${rv.rating},${q(t)},${q(rv.comment)},${r() > 0.3 ? 1 : 0},${q(rv.date)});`,
    )
  }
}
writeFileSync('migrations/0002_seed.sql', out.join('\n') + '\n')
console.log(`seeded ${products.length} products`)
