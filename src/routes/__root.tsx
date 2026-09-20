import { HeadContent, Link, Outlet, Scripts, createRootRoute, useRouterState } from '@tanstack/react-router'
import Footer from '../components/Footer'
import Header from '../components/Header'
import { ToastProvider } from '../components/toast'
import { getShell } from '../server/fns'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  // Re-runs on router.invalidate(), which is how the cart badge and greeting stay fresh.
  beforeLoad: async () => getShell(),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Demo store - hiring assignment rebuild (not Amazon)' },
      // Keep the demo out of search results and away from anyone looking for the real thing.
      { name: 'robots', content: 'noindex, nofollow' },
      { name: 'description', content: 'A hiring-assignment rebuild of an e-commerce store. Not Amazon, not affiliated with Amazon. No real payments.' },
      { name: 'theme-color', content: '#131921' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
  notFoundComponent: () => (
    <main id="main" className="mx-auto max-w-[700px] px-4 py-16 text-center">
      <h1 className="text-[28px] font-bold">Looking for something?</h1>
      <p className="mt-2 text-muted">We're sorry. The page you entered is not a functioning page on our site.</p>
      <Link to="/" className="btn btn-buy mt-5">Go to the home page</Link>
    </main>
  ),
})

// Sign-in and checkout use Amazon's stripped-down chrome: no nav, no distractions.
const BARE = ['/signin', '/register', '/checkout']

function RootLayout() {
  const { user, cartCount } = Route.useRouteContext()
  const path = useRouterState({ select: (s) => s.location.pathname })
  if (BARE.some((p) => path.startsWith(p)))
    return (
      <>
        <DemoBanner />
        <Outlet />
      </>
    )
  return (
    <>
      <DemoBanner />
      <Header user={user} cartCount={cartCount} />
      <Outlet />
      <Footer />
    </>
  )
}

// Shown on every page, including sign-in: the look is deliberately close to the
// original, so the page has to say plainly that it is not the original.
function DemoBanner() {
  return (
    <div role="note" className="bg-[#fff8e1] px-3 py-1.5 text-center text-[12px] leading-4 text-ink border-b border-[#f0c14b]">
      <b>This is not Amazon.</b> It is a hiring-assignment demo, not affiliated with Amazon.com, Inc. Never enter your real Amazon password or card details here.
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="font-sans">
        <ToastProvider>{children}</ToastProvider>
        <Scripts />
      </body>
    </html>
  )
}
