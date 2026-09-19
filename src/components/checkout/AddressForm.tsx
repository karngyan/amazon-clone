import { useState } from 'react'
import { saveAddress } from '#/server/fns'

const REQUIRED = ['fullName', 'line1', 'city', 'state', 'zip'] as const

export function AddressForm({ onSaved, onCancel }: { onSaved: (id: number) => Promise<void> | void; onCancel?: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState<string[]>([])

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const get = (k: string) => String(f.get(k) ?? '').trim()
    const empty = REQUIRED.filter((k) => !get(k))
    setMissing(empty)
    if (empty.length) {
      setError('Please fill in all required fields.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await saveAddress({
        data: {
          fullName: get('fullName'),
          phone: get('phone') || null,
          line1: get('line1'),
          line2: get('line2') || null,
          city: get('city'),
          state: get('state'),
          zip: get('zip'),
          country: get('country') || 'United States',
          isDefault: f.get('isDefault') === 'on',
        },
      })
      if ('error' in res && res.error) setError(res.error)
      else if ('id' in res) await onSaved(res.id)
    } catch {
      setError('We could not save this address. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const input = (name: string, label: string, opts: { autoComplete?: string; placeholder?: string; type?: string; defaultValue?: string } = {}) => {
    const bad = missing.includes(name)
    return (
      <div>
        <label htmlFor={`addr-${name}`} className="mb-0.5 block text-[13px] font-bold">{label}</label>
        <input
          id={`addr-${name}`}
          name={name}
          className={`field ${bad ? '!border-[#c40000] !shadow-[0_0_0_3px_#fde0e0_inset]' : ''}`}
          aria-invalid={bad || undefined}
          {...opts}
        />
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="fade-in flex max-w-[520px] flex-col gap-3">
      <h3 className="text-[18px] font-bold leading-6">Add a new address</h3>
      {error ? (
        <div role="alert" className="rounded-lg border border-[#c40000] bg-white p-3 shadow-[0_0_0_4px_#fcf4f4_inset]">
          <div className="text-[15px] font-bold text-[#c40000]">There was a problem</div>
          <div className="text-[13px]">{error}</div>
        </div>
      ) : null}
      <div>
        <label htmlFor="addr-country" className="mb-0.5 block text-[13px] font-bold">Country/Region</label>
        <select id="addr-country" name="country" defaultValue="United States" className="field" autoComplete="country-name">
          {['United States', 'Canada', 'United Kingdom', 'Australia', 'India', 'Germany'].map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      {input('fullName', 'Full name (First and Last name)', { autoComplete: 'name' })}
      {input('phone', 'Phone number', { autoComplete: 'tel', type: 'tel' })}
      {input('line1', 'Address', { autoComplete: 'address-line1', placeholder: 'Street address or P.O. Box' })}
      <div>
        <label htmlFor="addr-line2" className="sr-only">Address line 2</label>
        <input id="addr-line2" name="line2" className="field" autoComplete="address-line2" placeholder="Apt, suite, unit, building, floor, etc." />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {input('city', 'City', { autoComplete: 'address-level2' })}
        {input('state', 'State', { autoComplete: 'address-level1' })}
        {input('zip', 'ZIP Code', { autoComplete: 'postal-code' })}
      </div>
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" name="isDefault" className="h-4 w-4 accent-[#007185]" />
        Make this my default address
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-buy" disabled={busy}>{busy ? 'Saving…' : 'Use this address'}</button>
        {onCancel ? <button type="button" className="btn btn-plain" onClick={onCancel} disabled={busy}>Cancel</button> : null}
      </div>
    </form>
  )
}
