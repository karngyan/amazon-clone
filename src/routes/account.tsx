import { Link, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useToast } from '#/components/toast'
import { signOut } from '#/server/fns'

export const Route = createFileRoute('/account')({
  beforeLoad: ({ context, location }) => {
    if (!context.user) throw redirect({ to: '/signin', search: { redirect: location.href } })
  },
  head: () => ({ meta: [{ title: 'Your Account' }] }),
  component: Account,
})

const icon = (children: React.ReactNode) => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="#232f3e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
    {children}
  </svg>
)

const ICONS = {
  orders: icon(
    <>
      <path d="M8 18l20-9 20 9v21l-20 9-20-9z" fill="#fff" />
      <path d="M8 18l20 9 20-9M28 27v21" />
      <path d="M18 13.500l20 9" stroke="#ff9900" />
    </>,
  ),
  addresses: icon(
    <>
      <path d="M28 49s15-13.500 15-25a15 15 0 10-30 0c0 11.500 15 25 15 25z" fill="#fff" />
      <circle cx="28" cy="24" r="5.500" stroke="#ff9900" />
    </>,
  ),
  list: icon(
    <>
      <rect x="11" y="8" width="34" height="40" rx="3" fill="#fff" />
      <path d="M28 36.500s-8-5-8-10.200a4.300 4.300 0 018-2.300 4.300 4.300 0 018 2.300c0 5.200-8 10.200-8 10.200z" stroke="#ff9900" />
      <path d="M19 16h18" />
    </>,
  ),
  security: icon(
    <>
      <path d="M28 7l17 6v13c0 11-7.500 19-17 23-9.500-4-17-12-17-23V13z" fill="#fff" />
      <rect x="21" y="25" width="14" height="11" rx="1.500" stroke="#ff9900" />
      <path d="M23.500 25v-3a4.500 4.500 0 019 0v3" stroke="#ff9900" />
    </>,
  ),
  deals: icon(
    <>
      <path d="M9 9h19l19 19-19 19L9 28z" fill="#fff" />
      <circle cx="19" cy="19" r="3" />
      <path d="M24 33l9-9" stroke="#ff9900" />
    </>,
  ),
}

const tile = 'card flex min-h-[110px] items-start gap-4 rounded-lg p-4 transition-colors'

function Account() {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const toast = useToast()
  const [leaving, setLeaving] = useState(false)

  const leave = async () => {
    setLeaving(true)
    try {
      await signOut()
      await router.invalidate()
      await router.navigate({ to: '/' })
    } catch {
      toast({ title: 'Could not sign out', body: 'Please try again.' })
      setLeaving(false)
    }
  }

  const links = [
    { to: '/orders', icon: ICONS.orders, title: 'Your Orders', body: 'Track, cancel, or buy things again' },
    { to: '/addresses', icon: ICONS.addresses, title: 'Your Addresses', body: 'Edit addresses for orders and gifts' },
    { to: '/wishlist', icon: ICONS.list, title: 'Your List', body: 'View and shop the items you saved for later' },
  ] as const

  return (
    <main id="main" className="mx-auto w-full max-w-[1000px] px-4 pb-12 pt-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-normal leading-9">Your Account</h1>
        <button className="btn btn-plain" onClick={leave} disabled={leaving}>{leaving ? 'Signing out…' : 'Sign out'}</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className={`${tile} hover:bg-[#f7fafa]`}>
            {l.icon}
            <span>
              <span className="block text-[17px] leading-6">{l.title}</span>
              <span className="block text-muted">{l.body}</span>
            </span>
          </Link>
        ))}
        <section className={tile} aria-labelledby="security-title">
          {ICONS.security}
          <div className="min-w-0">
            <h2 id="security-title" className="text-[17px] font-normal leading-6">Login &amp; security</h2>
            <dl className="text-muted">
              <div className="flex gap-1"><dt>Name:</dt><dd className="truncate text-ink">{user?.name}</dd></div>
              <div className="flex gap-1"><dt>Email:</dt><dd className="truncate text-ink">{user?.email}</dd></div>
            </dl>
          </div>
        </section>
        <Link to="/s" search={{ deals: true }} className={`${tile} hover:bg-[#f7fafa]`}>
          {ICONS.deals}
          <span>
            <span className="block text-[17px] leading-6">Browse deals</span>
            <span className="block text-muted">Limited-time savings across every department</span>
          </span>
        </Link>
      </div>
    </main>
  )
}
