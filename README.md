# amazon.clone

A 24-hour rebuild of amazon.com. Live at **https://not-amz-hiring-clone.karngyan.com**.

This is a hiring-assignment demo. It is not Amazon and is not affiliated with Amazon.com, Inc.
Every page says so, the sign-in pages warn against reusing a real password, and the site is `noindex`.

Browse, search and filter a 194-product catalogue, read and write reviews, add to cart as a
guest, sign up, check out, track and cancel orders. No real payment is taken and nothing ships.

## What is in it

| Flow | Notes |
|---|---|
| Home | Hero carousel, department quad cards, deal / best seller / top rated rails, recently viewed |
| Search | Keyword search with typeahead, department scope, facets (department, rating, price, Prime, deals, brand), sort, pagination, removable filter chips |
| Product page | Gallery with hover zoom and lightbox, buy box, stock states, Add to List, related rails, review histogram with filtering, write a review ("Verified Purchase" if you bought it) |
| Cart | Guest cart that merges into the account on sign-in, quantity stepper, save for later, free-shipping progress |
| Auth | Email + password (PBKDF2 via WebCrypto, httpOnly session cookie), one-click demo account for reviewers |
| Checkout | Address book, demo payment methods (no card data is ever collected), delivery speed, tax and shipping totals |
| Orders | Order confirmation, order history with search and tabs, tracking timeline, buy again, cancel (restocks inventory) |
| Account | Addresses, wish list |

Left out on purpose: seller marketplace, real payments, Prime Video/Music, ads, multi-variant
listings, returns workflow. They are either out of reach for a day or do nothing for the core
shop-to-order loop.

## Stack

- TanStack Start (React 19, file routes, server functions, SSR) on Cloudflare Workers
- Cloudflare D1 (SQLite) for everything: catalogue, sessions, carts, orders, rate limits
- Tailwind CSS v4
- Product data and images from the open [dummyjson.com](https://dummyjson.com) dataset, vendored into `public/p` and `migrations/0002_seed.sql`

There are no API keys or secrets in this project. Auth is self-contained and the only binding is D1.

## Abuse protection

The site is public with open sign-up, so every write path is rate limited in D1 (`src/server/core.ts#allow`):
total accounts are capped, sign-ups and sign-ins are limited per IP, guest sessions per IP,
orders and reviews per user per day, addresses per user, and every text field has a length cap.

## Run it

```sh
pnpm install
pnpm db:migrate:local   # creates and seeds the local D1 database
pnpm dev                # http://localhost:3000
```

Deploy:

```sh
pnpm db:migrate:remote
pnpm run deploy
```

## Process

- `recon/` has screenshots of the real site taken before any code was written.
- `.agent-logs/` has every prompt and final response from the build, captured by hooks
  (see `CAPTURE-TEST.md`).
