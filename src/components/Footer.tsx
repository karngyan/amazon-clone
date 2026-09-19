import { Link } from '@tanstack/react-router'
import { DEPARTMENTS } from '#/lib/catalog'
import { Logo } from './Header'

export default function Footer() {
  const cols: [string, [string, string, Record<string, unknown>?][]][] = [
    ['Shop', DEPARTMENTS.slice(0, 5).map((d) => [d.name, '/s', { category: d.slug }])],
    ['Discover', [["Today's Deals", '/s', { deals: true }], ['Best Sellers', '/s', { sort: 'bestsellers' }], ['New Releases', '/s', { sort: 'newest' }], ['Prime eligible', '/s', { prime: true }]]],
    ['Your Account', [['Your Account', '/account'], ['Your Orders', '/orders'], ['Your List', '/wishlist'], ['Your Addresses', '/addresses']]],
    ['About this build', [['Source on GitHub', 'https://github.com/karngyan/amazon-clone'], ['Product data: dummyjson.com', 'https://dummyjson.com']]],
  ]
  return (
    <footer className="mt-auto text-white">
      <button className="block w-full cursor-pointer bg-footer py-4 text-center text-[13px] hover:bg-[#485769]" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Back to top</button>
      <div className="bg-subnav px-6 py-10">
        <div className="mx-auto grid max-w-[1000px] grid-cols-2 gap-8 md:grid-cols-4">
          {cols.map(([title, links]) => (
            <div key={title}>
              <h3 className="mb-2 text-[16px] font-bold">{title}</h3>
              <ul className="space-y-1.5 text-[14px] text-[#ddd]">
                {links.map(([label, to, search]) => (
                  <li key={label}>
                    {to.startsWith('http') ? <a href={to} target="_blank" rel="noreferrer" className="hover:underline">{label}</a> : <Link to={to} search={search as never} className="hover:underline">{label}</Link>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-nav px-6 py-8 text-center text-[12px] text-[#ddd]">
        <Logo />
        <p className="mx-auto mt-5 max-w-[640px]">A 24-hour rebuild for a hiring assignment. Not affiliated with Amazon.com, Inc. No real payments are taken and nothing ships.</p>
      </div>
    </footer>
  )
}
