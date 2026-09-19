import { Link, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { ProblemBox } from '#/components/account/auth'
import { useToast } from '#/components/toast'
import type { Address } from '#/lib/types'
import { getAddresses, saveAddress, updateAddress } from '#/server/fns'

export const Route = createFileRoute('/addresses')({
  beforeLoad: ({ context, location }) => {
    if (!context.user) throw redirect({ to: '/signin', search: { redirect: location.href } })
  },
  loader: () => getAddresses(),
  head: () => ({ meta: [{ title: 'Your Addresses' }] }),
  component: Addresses,
})

const BLANK = { fullName: '', phone: '', line1: '', line2: '', city: '', state: '', zip: '', country: 'United States', isDefault: false }
type Form = typeof BLANK
type TextKey = Exclude<keyof Form, 'isDefault'>

const REQUIRED: [TextKey, string][] = [
  ['fullName', 'Enter a name'],
  ['line1', 'Enter an address'],
  ['city', 'Enter a city'],
  ['state', 'Enter a state'],
  ['zip', 'Enter a ZIP code'],
]

function Addresses() {
  const addresses = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)

  const mutate = async (a: Address, action: 'delete' | 'default') => {
    setBusyId(a.id)
    try {
      await updateAddress({ data: { id: a.id, action } })
      await router.invalidate()
      toast({ title: action === 'delete' ? 'Address removed' : 'Default address updated', body: `${a.fullName}, ${a.line1}` })
    } catch {
      toast({ title: 'There was a problem', body: 'We could not update that address. Please try again.' })
    } finally {
      setBusyId(null)
      setConfirmId(null)
    }
  }

  return (
    <main id="main" className="mx-auto w-full max-w-[1000px] px-4 pb-12 pt-4">
      <nav aria-label="Breadcrumb" className="mb-2 text-[12px] text-muted">
        <Link to="/account" className="hover:text-link-hover hover:underline">Your Account</Link>
        <span aria-hidden="true"> › </span>
        <span className="text-link-hover">Your Addresses</span>
      </nav>
      <h1 className="mb-4 text-[28px] font-normal leading-9">Your Addresses</h1>

      {addresses.length === 0 && !open ? (
        <p className="mb-4 text-muted">You have no saved addresses yet. Add one now and checkout takes a single click.</p>
      ) : null}

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <li>
          <button
            className="flex h-full min-h-[266px] w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-[#c7c7c7] text-muted transition-colors hover:border-[#888c8c] hover:bg-[#f7fafa]"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
          >
            <svg width="44" height="44" viewBox="0 0 44 44" stroke="#c7c7c7" strokeWidth="4" strokeLinecap="round" aria-hidden="true"><path d="M22 6v32M6 22h32" /></svg>
            <span className="text-[22px] font-bold leading-7 text-[#565959]">Add address</span>
          </button>
        </li>
        {addresses.map((a) => (
          <li key={a.id} className={`card flex min-h-[266px] flex-col overflow-hidden transition-opacity ${busyId === a.id ? 'opacity-60' : ''}`}>
            {a.isDefault ? (
              <div className="border-b border-line px-5 py-2 text-[12px] text-muted">Default: <span className="font-bold text-ink">amazon<span className="font-normal text-now">.clone</span></span></div>
            ) : null}
            <address className="flex-1 px-5 py-4 not-italic leading-5">
              <div className="font-bold">{a.fullName}</div>
              <div>{a.line1}</div>
              {a.line2 ? <div>{a.line2}</div> : null}
              <div>{a.city}, {a.state} {a.zip}</div>
              <div>{a.country}</div>
              {a.phone ? <div>Phone number: {a.phone}</div> : null}
            </address>
            <div className="px-5 pb-4 text-[13px]">
              {confirmId === a.id ? (
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Remove address for ${a.fullName}`}>
                  <span>Remove this address?</span>
                  <button className="btn btn-buy !px-3 !py-1" disabled={busyId === a.id} onClick={() => mutate(a, 'delete')}>{busyId === a.id ? 'Removing…' : 'Yes'}</button>
                  <button className="btn btn-plain !px-3 !py-1" disabled={busyId === a.id} onClick={() => setConfirmId(null)}>No</button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-2">
                  <button className="link disabled:opacity-50" disabled={busyId === a.id} onClick={() => setConfirmId(a.id)}>Remove</button>
                  {!a.isDefault ? (
                    <>
                      <span aria-hidden="true" className="text-line">|</span>
                      <button className="link disabled:opacity-50" disabled={busyId === a.id} onClick={() => mutate(a, 'default')}>
                        {busyId === a.id ? 'Saving…' : 'Set as Default'}
                      </button>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {open ? <AddressDialog defaultName={addresses.length ? '' : (user?.name ?? '')} first={addresses.length === 0} onClose={() => setOpen(false)} /> : null}
    </main>
  )
}

function AddressDialog({ defaultName, first, onClose }: { defaultName: string; first: boolean; onClose: () => void }) {
  const router = useRouter()
  const toast = useToast()
  const panel = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState<Form>({ ...BLANK, fullName: defaultName })
  const [errors, setErrors] = useState<Partial<Record<TextKey, string>>>({})
  const [pending, setPending] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // Kept in a ref so a parent re-render cannot re-run the focus trap and steal focus.
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current()
      if (e.key !== 'Tab' || !panel.current) return
      const nodes = panel.current.querySelectorAll<HTMLElement>('input, select, button')
      const [head, tail] = [nodes[0], nodes[nodes.length - 1]]
      if (e.shiftKey && document.activeElement === head) (e.preventDefault(), tail.focus())
      else if (!e.shiftKey && document.activeElement === tail) (e.preventDefault(), head.focus())
    }
    document.addEventListener('keydown', key)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', key)
      document.body.style.overflow = ''
      back?.focus()
    }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const found: typeof errors = {}
    for (const [k, msg] of REQUIRED) if (!form[k].trim()) found[k] = msg
    setErrors(found)
    const bad = REQUIRED.find(([k]) => found[k])
    if (bad) return panel.current?.querySelector<HTMLInputElement>(`#addr-${bad[0]}`)?.focus()
    setPending(true)
    setProblem(null)
    try {
      const res = await saveAddress({ data: form })
      if ('error' in res && res.error) {
        setProblem(res.error)
        setPending(false)
        return
      }
      await router.invalidate()
      toast({ title: 'Address saved', body: `${form.fullName}, ${form.line1}` })
      onClose()
    } catch {
      setProblem('We could not save your address. Please try again.')
      setPending(false)
    }
  }

  const input = (k: TextKey, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`addr-${k}`} className="mb-0.5 block text-[13px] font-bold">{label}</label>
      <input
        id={`addr-${k}`}
        className={`field ${errors[k] ? '!border-[#c40000]' : ''}`}
        value={form[k]}
        onChange={(e) => (setForm({ ...form, [k]: e.target.value }), errors[k] && setErrors({ ...errors, [k]: undefined }))}
        aria-invalid={!!errors[k]}
        aria-describedby={errors[k] ? `addr-${k}-error` : undefined}
        {...extra}
      />
      {errors[k] ? (
        <p id={`addr-${k}-error`} className="mt-1 flex gap-1.5 text-[12px] leading-4 text-[#c40000]"><span aria-hidden="true" className="font-bold italic">!</span>{errors[k]}</p>
      ) : null}
    </div>
  )

  return (
    <div className="fade-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(15,17,17,.6)] p-3 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="addr-title" className="pop-in w-full max-w-[520px] overflow-hidden rounded-lg bg-white shadow-[0_8px_32px_rgba(15,17,17,.4)]">
        <div className="flex items-center justify-between border-b border-line bg-[#f0f2f2] px-5 py-3">
          <h2 id="addr-title" className="text-[16px] font-bold">Add a new address</h2>
          <button type="button" className="-mr-2 cursor-pointer rounded p-2 hover:bg-[#e3e6e6]" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" stroke="#0f1111" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" /></svg>
          </button>
        </div>
        <form onSubmit={submit} noValidate className="grid gap-3.5 px-5 py-4">
          <ProblemBox message={problem} />
          <div>
            <label htmlFor="addr-country" className="mb-0.5 block text-[13px] font-bold">Country/Region</label>
            <select id="addr-country" className="field cursor-pointer" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
              {['United States', 'Canada', 'United Kingdom', 'India', 'Australia', 'Germany'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          {input('fullName', 'Full name (First and Last name)', { autoComplete: 'name', autoFocus: true })}
          {input('phone', 'Phone number', { type: 'tel', autoComplete: 'tel', inputMode: 'tel' })}
          {input('line1', 'Address', { autoComplete: 'address-line1', placeholder: 'Street address or P.O. Box' })}
          {input('line2', 'Apt, suite, unit, building, floor, etc. (optional)', { autoComplete: 'address-line2' })}
          <div className="grid gap-3.5 sm:grid-cols-[1.4fr_1fr_1fr]">
            {input('city', 'City', { autoComplete: 'address-level2' })}
            {input('state', 'State', { autoComplete: 'address-level1' })}
            {input('zip', 'ZIP Code', { autoComplete: 'postal-code', inputMode: 'numeric' })}
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-[#007185]" checked={first || form.isDefault} disabled={first} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            Make this my default address
            {first ? <span className="text-[12px] text-muted">(your first address is always the default)</span> : null}
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="submit" className="btn btn-buy" disabled={pending}>{pending ? 'Saving…' : 'Add address'}</button>
            <button type="button" className="btn btn-plain" onClick={onClose} disabled={pending}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
