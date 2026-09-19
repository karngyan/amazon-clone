import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthShell, FieldError, ProblemBox, useFinishAuth, validateAuthSearch } from '#/components/account/auth'
import { signUp } from '#/server/fns'

export const Route = createFileRoute('/register')({
  validateSearch: validateAuthSearch,
  beforeLoad: ({ context, search }) => {
    if (context.user) throw redirect({ href: search.redirect ?? '/' })
  },
  head: () => ({ meta: [{ title: 'Amazon.clone Registration' }] }),
  component: Register,
})

type Values = { name: string; email: string; password: string; confirm: string }
type Errors = Partial<Record<keyof Values, string>>

const validate = (v: Values): Errors => {
  const e: Errors = {}
  if (!v.name.trim()) e.name = 'Enter your name'
  if (!v.email.trim()) e.email = 'Enter your email'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = 'Wrong or invalid email address. Please correct and try again.'
  if (!v.password) e.password = 'Enter your password'
  else if (v.password.length < 6) e.password = 'Minimum 6 characters required'
  if (!v.confirm) e.confirm = 'Type your password again'
  else if (v.password && v.confirm !== v.password) e.confirm = 'Passwords must match'
  return e
}

const FIELDS: { key: keyof Values; label: string; type: string; autoComplete: string; placeholder?: string }[] = [
  { key: 'name', label: 'Your name', type: 'text', autoComplete: 'name', placeholder: 'First and last name' },
  { key: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { key: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', placeholder: 'At least 6 characters' },
  { key: 'confirm', label: 'Re-enter password', type: 'password', autoComplete: 'new-password' },
]

function Register() {
  const search = Route.useSearch()
  const finish = useFinishAuth(search.redirect)
  const [values, setValues] = useState<Values>({ name: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const set = (key: keyof Values, value: string) => {
    const next = { ...values, [key]: value }
    setValues(next)
    // Only nag after the first submit; from then on errors clear as they are fixed.
    if (submitted) setErrors(validate(next))
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitted(true)
    setProblem(null)
    const found = validate(values)
    setErrors(found)
    const first = FIELDS.find((f) => found[f.key])
    if (first) {
      e.currentTarget.querySelector<HTMLInputElement>(`#${first.key}`)?.focus()
      return
    }
    setPending(true)
    try {
      const res = await signUp({ data: { name: values.name, email: values.email, password: values.password } })
      if ('error' in res && res.error) {
        setProblem(res.error)
        setPending(false)
        return
      }
      await finish()
    } catch {
      setProblem('Something went wrong on our end. Please try again.')
      setPending(false)
    }
  }

  return (
    <AuthShell>
      <ProblemBox message={problem} className="mb-4" />
      <div className="rounded-lg border border-[#ddd] px-[26px] py-5">
        <h1 className="mb-3 text-[28px] font-normal leading-9">Create account</h1>
        <form onSubmit={submit} noValidate>
          {FIELDS.map((f) => {
            const bad = !!errors[f.key]
            const hint = f.key === 'password' && !bad
            return (
              <div key={f.key} className="mb-3.5">
                <label htmlFor={f.key} className="mb-0.5 block text-[13px] font-bold">{f.label}</label>
                <input
                  id={f.key}
                  type={f.type}
                  autoComplete={f.autoComplete}
                  placeholder={f.placeholder}
                  autoFocus={f.key === 'name'}
                  className={`field ${bad ? '!border-[#c40000] !shadow-[0_0_0_3px_rgba(221,0,0,.1)_inset]' : ''}`}
                  value={values[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                  aria-invalid={bad}
                  aria-describedby={bad ? `${f.key}-error` : hint ? 'password-hint' : undefined}
                />
                {hint ? (
                  <p id="password-hint" className="mt-1 flex items-center gap-1.5 text-[12px] leading-4 text-[#2b2b2b]">
                    <span aria-hidden="true" className="font-serif font-bold italic text-[#2f7bbf]">i</span>
                    Passwords must be at least 6 characters.
                  </p>
                ) : null}
                <FieldError id={`${f.key}-error`} message={errors[f.key]} />
              </div>
            )
          })}
          <button type="submit" className="btn btn-buy btn-block mt-1" disabled={pending}>
            {pending ? 'Creating your account…' : 'Create your Amazon account'}
          </button>
        </form>
        <p className="mt-4 text-[12px] leading-[18px]">
          By creating an account, you agree to Amazon.clone's <span className="text-link">Conditions of Use</span> and <span className="text-link">Privacy Notice</span>. This is a demo: use a made-up email and a password you do not use elsewhere.
        </p>
        <div className="mt-5 border-t border-[#e7e7e7] pt-4 text-[13px]">
          Already have an account? <Link to="/signin" search={search} className="link">Sign in <span aria-hidden="true">›</span></Link>
        </div>
      </div>
    </AuthShell>
  )
}
