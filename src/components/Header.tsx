import { Link, useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { DEPARTMENTS, categoryName } from '#/lib/catalog'
import type { User } from '#/lib/types'
import { signOut, suggest } from '#/server/fns'

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className={`relative inline-flex items-baseline font-bold tracking-tight text-[24px] leading-none ${dark ? 'text-ink' : 'text-white'}`}>
      amazon
      <span className="ml-0.5 text-[11px] font-normal text-now">.clone</span>
      <svg className="absolute -bottom-2 left-[18px]" width="56" height="10" viewBox="0 0 56 10" aria-hidden="true">
        <path d="M1 1.5c16 8 36 8 52 1" fill="none" stroke="#ff9900" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M47 .5l7 1.6-3.4 5.6" fill="none" stroke="#ff9900" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

type Suggestion = { id: number; title: string; thumbnail: string }

function SearchBar() {
  const navigate = useNavigate()
  const search = useRouterState({ select: (s) => s.location.search as { q?: string; category?: string } })
  const [q, setQ] = useState(search.q ?? '')
  const [dept, setDept] = useState(DEPARTMENTS.some((d) => d.slug === search.category) ? search.category! : '')
  const [items, setItems] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const box = useRef<HTMLFormElement>(null)

  useEffect(() => setQ(search.q ?? ''), [search.q])

  useEffect(() => {
    if (q.trim().length < 2) return setItems([])
    let live = true
    const t = setTimeout(async () => {
      const res = await suggest({ data: { q } }).catch(() => [])
      if (live) (setItems(res), setActive(-1))
    }, 120)
    return () => ((live = false), clearTimeout(t))
  }, [q])

  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const go = (term: string) => {
    setOpen(false)
    navigate({ to: '/s', search: { q: term.trim() || undefined, category: dept || undefined } })
  }

  return (
    <form
      ref={box}
      role="search"
      className="relative flex h-10 min-w-0 flex-1 rounded-md focus-within:ring-[3px] focus-within:ring-[#f90]"
      onSubmit={(e) => (e.preventDefault(), active >= 0 && items[active] ? navigate({ to: '/dp/$id', params: { id: String(items[active].id) } }).then(() => setOpen(false)) : go(q))}
    >
      <select
        aria-label="Search in department"
        value={dept}
        onChange={(e) => setDept(e.target.value)}
        className="hidden max-w-[150px] cursor-pointer rounded-l-md border-r border-[#cdcdcd] bg-[#e6e6e6] px-2 text-[12px] text-[#555] hover:bg-[#d4d4d4] md:block"
      >
        <option value="">All</option>
        {DEPARTMENTS.map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
      </select>
      <input
        value={q}
        onChange={(e) => (setQ(e.target.value), setOpen(true))}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(items.length - 1, a + 1)))
          if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(-1, a - 1)))
          if (e.key === 'Escape') setOpen(false)
        }}
        placeholder="Search Amazon"
        aria-label="Search Amazon"
        autoComplete="off"
        className="min-w-0 flex-1 rounded-l-md bg-white px-3 text-[15px] text-ink outline-none md:rounded-none"
      />
      <button aria-label="Go" className="flex w-[45px] cursor-pointer items-center justify-center rounded-r-md bg-search hover:bg-[#f3a847]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#131921" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="7" /><path d="M16 16l5.5 5.5" /></svg>
      </button>
      {open && items.length ? (
        <ul role="listbox" className="pop-in absolute left-0 right-0 top-[42px] z-50 overflow-hidden rounded-b-md border border-line bg-white py-1 shadow-[0_6px_18px_rgba(15,17,17,.3)]">
          {items.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === active}>
              <Link
                to="/dp/$id"
                params={{ id: String(s.id) }}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-1.5 text-[15px] font-bold text-ink ${i === active ? 'bg-[#f0f2f2]' : 'hover:bg-[#f0f2f2]'}`}
              >
                <span className="img-well h-9 w-9 flex-none rounded"><img src={s.thumbnail} alt="" /></span>
                <span className="truncate">{s.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  )
}

function AccountMenu({ user }: { user: User | null }) {
  const router = useRouter()
  const navigate = useNavigate()
  const path = useRouterState({ select: (s) => s.location.href })
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const hover = (v: boolean) => (clearTimeout(timer.current), (timer.current = setTimeout(() => setOpen(v), v ? 80 : 180)))
  useEffect(() => setOpen(false), [path])

  const links: [string, string][] = [['/account', 'Account'], ['/orders', 'Orders'], ['/wishlist', 'Your List'], ['/addresses', 'Your Addresses']]
  return (
    <div className="relative" onMouseEnter={() => hover(true)} onMouseLeave={() => hover(false)}>
      <Link to={user ? '/account' : '/signin'} className="nav-hit block leading-[14px]" aria-haspopup="true" aria-expanded={open} onFocus={() => setOpen(true)}>
        <span className="block text-[12px]">Hello, {user ? user.name.split(' ')[0] : 'sign in'}</span>
        <span className="block text-[14px] font-bold">Account &amp; Lists <span className="text-[10px] text-[#a7acb2]">▾</span></span>
      </Link>
      {open ? (
        <div className="pop-in absolute right-0 top-full z-50 w-[260px] rounded-md border border-line bg-white p-4 text-ink shadow-[0_6px_18px_rgba(15,17,17,.3)]">
          {!user ? (
            <div className="mb-3 border-b border-line pb-3 text-center">
              <Link to="/signin" className="btn btn-buy btn-block">Sign in</Link>
              <p className="mt-2 text-[12px]">New customer? <Link to="/register" className="link">Start here.</Link></p>
            </div>
          ) : null}
          <h3 className="mb-1 text-[16px] font-bold">Your Account</h3>
          <ul className="space-y-1 text-[13px]">
            {links.map(([to, label]) => <li key={to}><Link to={to} className="hover:text-link-hover hover:underline">{label}</Link></li>)}
            {user ? (
              <li>
                <button className="cursor-pointer hover:text-link-hover hover:underline" onClick={async () => (await signOut(), await router.invalidate(), navigate({ to: '/' }))}>Sign Out</button>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function Drawer({ user, onClose }: { user: User | null; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => (document.removeEventListener('keydown', esc), void (document.body.style.overflow = ''))
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="All departments">
      <div className="fade-in absolute inset-0 bg-black/70" onClick={onClose} />
      <aside className="slide-in absolute inset-y-0 left-0 flex w-[min(365px,85vw)] flex-col overflow-y-auto bg-white text-ink">
        <Link to={user ? '/account' : '/signin'} onClick={onClose} className="flex items-center gap-3 bg-subnav px-9 py-3 text-[19px] font-bold text-white">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><circle cx="12" cy="8" r="4.5" /><path d="M3 21c1-5 5-7 9-7s8 2 9 7z" /></svg>
          Hello, {user ? user.name.split(' ')[0] : 'sign in'}
        </Link>
        <h3 className="px-9 pb-1 pt-4 text-[18px] font-bold">Trending</h3>
        <DrawerLink onClose={onClose} search={{ sort: 'bestsellers' }}>Best Sellers</DrawerLink>
        <DrawerLink onClose={onClose} search={{ deals: true }}>Today's Deals</DrawerLink>
        <DrawerLink onClose={onClose} search={{ sort: 'newest' }}>New Releases</DrawerLink>
        {DEPARTMENTS.map((d) => (
          <div key={d.slug} className="border-t border-line">
            <h3 className="px-9 pb-1 pt-4 text-[18px] font-bold">{d.name}</h3>
            {d.categories.length > 1 ? <DrawerLink onClose={onClose} search={{ category: d.slug }}>All {d.name}</DrawerLink> : null}
            {d.categories.map((c) => <DrawerLink key={c} onClose={onClose} search={{ category: c }}>{categoryName(c)}</DrawerLink>)}
          </div>
        ))}
        <div className="h-8 flex-none" />
      </aside>
      <button onClick={onClose} aria-label="Close menu" className="fade-in absolute left-[min(375px,87vw)] top-3 cursor-pointer text-[30px] leading-none text-white">×</button>
    </div>
  )
}

function DrawerLink({ children, search, onClose }: { children: React.ReactNode; search: Record<string, unknown>; onClose: () => void }) {
  return <Link to="/s" search={search as never} onClick={onClose} className="block px-9 py-3 text-[14px] hover:bg-[#eaeded]">{children}</Link>
}

export default function Header({ user, cartCount }: { user: User | null; cartCount: number }) {
  const [drawer, setDrawer] = useState(false)
  const sub: [string, Record<string, unknown>][] = [
    ["Today's Deals", { deals: true }],
    ['Best Sellers', { sort: 'bestsellers' }],
    ['New Releases', { sort: 'newest' }],
    ['Prime', { prime: true }],
    ...DEPARTMENTS.map((d) => [d.name, { category: d.slug }] as [string, Record<string, unknown>]),
  ]
  return (
    <header className="text-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-[80] focus:bg-white focus:p-2 focus:text-ink">Skip to main content</a>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-nav px-2 py-2 md:flex-nowrap md:px-3">
        <Link to="/" className="nav-hit order-1 pb-3 pt-2" aria-label="Amazon clone home"><Logo /></Link>
        <div className="nav-hit order-2 hidden items-end gap-1 leading-[14px] lg:flex">
          <svg width="15" height="18" viewBox="0 0 15 18" fill="none" stroke="#fff" strokeWidth="1.6" aria-hidden="true"><path d="M7.5 17s6-5.6 6-10a6 6 0 10-12 0c0 4.400 6 10 6 10z" /><circle cx="7.500" cy="7" r="2" /></svg>
          <span><span className="block text-[12px] text-[#ccc]">Deliver to</span><span className="block text-[14px] font-bold">{user ? user.name.split(' ')[0] : 'United States'}</span></span>
        </div>
        <div className="order-4 w-full md:order-3 md:w-auto md:flex-1"><div className="flex"><SearchBar /></div></div>
        <div className="order-3 ml-auto flex items-center md:order-4 md:ml-0">
          <AccountMenu user={user} />
          <Link to="/orders" className="nav-hit hidden leading-[14px] sm:block">
            <span className="block text-[12px]">Returns</span>
            <span className="block text-[14px] font-bold">&amp; Orders</span>
          </Link>
          <Link to="/cart" className="nav-hit flex items-end gap-0.5" aria-label={`Cart, ${cartCount} items`}>
            <span className="relative">
              <svg width="40" height="30" viewBox="0 0 40 30" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 3h5l5 17h18l4-12" /><circle cx="15" cy="25.500" r="2" fill="#fff" /><circle cx="28" cy="25.500" r="2" fill="#fff" /></svg>
              <span key={cartCount} className="pop-in absolute left-[17px] top-[-7px] min-w-[18px] text-center text-[16px] font-bold text-now">{cartCount > 99 ? '99+' : cartCount}</span>
            </span>
            <span className="hidden text-[14px] font-bold sm:block">Cart</span>
          </Link>
        </div>
      </div>
      <nav aria-label="Departments" className="flex items-center gap-0.5 overflow-x-auto whitespace-nowrap bg-subnav px-2 py-0.5 text-[14px] [scrollbar-width:none] md:px-3">
        <button className="nav-hit flex flex-none items-center gap-1 font-bold" onClick={() => setDrawer(true)} aria-haspopup="dialog">
          <svg width="18" height="14" viewBox="0 0 18 14" stroke="#fff" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M1 1h16M1 7h16M1 13h16" /></svg>
          All
        </button>
        {sub.map(([label, search]) => (
          <Link key={label} to="/s" search={search as never} className="nav-hit flex-none">{label}</Link>
        ))}
      </nav>
      {drawer ? <Drawer user={user} onClose={() => setDrawer(false)} /> : null}
    </header>
  )
}
