import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthDivider, AuthShell, ProblemBox, safeRedirect, useFinishAuth, validateAuthSearch } from '#/components/account/auth'
import { signIn, signUp } from '#/server/fns'

export const Route = createFileRoute('/signin')({
  validateSearch: validateAuthSearch,
  beforeLoad: ({ context, search }) => {
    if (context.user) throw redirect({ href: safeRedirect(search.redirect) ?? '/' })
  },
  head: () => ({ meta: [{ title: 'Amazon.clone Sign-In' }] }),
  component: SignIn,
})

const token = () => Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => b.toString(36)).join('')

function SignIn() {
  const search = Route.useSearch()
  const finish = useFinishAuth(search.redirect)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [pending, setPending] = useState<'signin' | 'demo' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (kind: 'signin' | 'demo', call: () => Promise<{ error?: string; ok?: boolean }>) => {
    setPending(kind)
    setError(null)
    try {
      const res = await call()
      if (res.error) {
        setError(res.error)
        setPending(null)
        return
      }
      await finish()
    } catch {
      setError('Something went wrong on our end. Please try again.')
      setPending(null)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return setError('Enter your email address')
    if (!password) return setError('Enter your password')
    run('signin', () => signIn({ data: { email, password } }))
  }

  const demo = () =>
    run('demo', () =>
      signUp({ data: { name: 'Demo Shopper', email: `demo-${token().slice(0, 10)}@example.com`, password: token() } }),
    )

  return (
    <AuthShell>
      <ProblemBox message={error} className="mb-4" />
      <div className="rounded-lg border border-[#ddd] px-[26px] py-5">
        <h1 className="mb-3 text-[28px] font-normal leading-9">Sign in</h1>
        <form onSubmit={submit} noValidate>
          <label htmlFor="email" className="mb-0.5 block text-[13px] font-bold">Email</label>
          <input id="email" type="email" autoComplete="email" autoFocus className="field" value={email} onChange={(e) => setEmail(e.target.value)} />

          <div className="mb-0.5 mt-3.5 flex items-baseline justify-between">
            <label htmlFor="password" className="text-[13px] font-bold">Password</label>
            <button type="button" className="link text-[13px]" aria-pressed={show} aria-controls="password" onClick={() => setShow((s) => !s)}>
              {show ? 'Hide' : 'Show'} password
            </button>
          </div>
          <input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />

          <button type="submit" className="btn btn-buy btn-block mt-4" disabled={pending !== null}>
            {pending === 'signin' ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-[12px] leading-[18px]">
          By continuing, you agree to Amazon.clone's <span className="text-link">Conditions of Use</span> and <span className="text-link">Privacy Notice</span>.
        </p>

        <div className="mt-5 border-t border-[#e7e7e7] pt-4">
          <h2 className="text-[13px] font-bold">Reviewing this demo?</h2>
          <p className="mb-2 text-[12px] leading-[18px] text-muted">Skip the form. We create a throwaway account and sign you in, and anything in your cart comes along.</p>
          <button type="button" className="btn btn-plain btn-block" onClick={demo} disabled={pending !== null}>
            {pending === 'demo' ? 'Creating demo account…' : 'Continue with a demo account'}
          </button>
        </div>
      </div>

      <AuthDivider>New to Amazon?</AuthDivider>
      <Link to="/register" search={search} className="btn btn-plain btn-block">Create your Amazon account</Link>
    </AuthShell>
  )
}
