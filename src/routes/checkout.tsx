import { Link, createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { AddressForm } from '#/components/checkout/AddressForm'
import { Logo } from '#/components/Header'
import { deliveryDates, money } from '#/lib/format'
import type { Address } from '#/lib/types'
import { getCheckout, placeOrder } from '#/server/fns'

export const Route = createFileRoute('/checkout')({
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: '/signin', search: { redirect: '/checkout' } as never })
  },
  loader: async () => {
    const data = await getCheckout()
    if (!data.lines.length) throw redirect({ to: '/cart' })
    return data
  },
  head: () => ({ meta: [{ title: 'Checkout - Amazon.clone' }] }),
  component: CheckoutPage,
})

const PAYMENTS = [
  { label: 'Demo Visa ending in 4242', note: 'Test card, never charged', mark: 'VISA', color: '#1a1f71' },
  { label: 'Demo Mastercard ending in 4444', note: 'Test card, never charged', mark: 'MC', color: '#eb001b' },
  { label: 'Amazon.clone gift card balance', note: 'Unlimited demo balance', mark: 'GIFT', color: '#ff9900' },
]

type Delivery = 'free' | 'fast'

function CheckoutPage() {
  const { lines, addresses, totals } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [addressId, setAddressId] = useState<number | null>((addresses.find((a) => a.isDefault) ?? addresses[0])?.id ?? null)
  const [addressDone, setAddressDone] = useState(false)
  const [adding, setAdding] = useState(false)
  const [payment, setPayment] = useState(PAYMENTS[0].label)
  const [paymentDone, setPaymentDone] = useState(false)
  const [delivery, setDelivery] = useState<Delivery>('free')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorBox = useRef<HTMLDivElement>(null)

  const address = addresses.find((a) => a.id === addressId) ?? null
  const t = totals[delivery]
  const dates = deliveryDates()
  const count = lines.reduce((n, l) => n + l.qty, 0)
  const ready = addressDone && paymentDone && !!address

  useEffect(() => {
    if (error) errorBox.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [error])

  const place = async () => {
    if (!ready || placing || !address) return
    setPlacing(true)
    setError(null)
    try {
      const res = await placeOrder({ data: { addressId: address.id, delivery, paymentLabel: payment } })
      if ('orderId' in res && res.orderId) {
        // Leave first: invalidating while still on /checkout would re-run this loader with an
        // empty cart and bounce the shopper to /cart before the confirmation page.
        await navigate({ to: '/orders/$id', params: { id: res.orderId }, search: { placed: true } as never })
        await router.invalidate()
        return
      }
      setError(('error' in res && res.error) || 'We could not place your order. Please try again.')
    } catch {
      setError('We could not place your order. Check your connection and try again.')
    }
    setPlacing(false)
  }

  const placeButton = (
    <button className="btn btn-buy btn-block" disabled={!ready || placing} onClick={place}>
      {placing ? 'Placing order…' : 'Place your order'}
    </button>
  )

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-white">
      <header className="border-b border-line bg-gradient-to-b from-white to-[#f3f3f3]">
        <div className="mx-auto flex max-w-[1150px] items-center justify-between gap-3 px-4 py-4">
          <Link to="/" aria-label="Amazon clone home" className="pb-2"><Logo dark /></Link>
          <h1 className="flex items-center gap-2 text-[20px] font-normal leading-7 sm:text-[28px] sm:leading-9">
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none" aria-hidden="true"><rect x="1" y="8" width="14" height="11" rx="2" fill="#565959" /><path d="M4 8V5.5a4 4 0 018 0V8" stroke="#565959" strokeWidth="2" /></svg>
            Secure checkout
          </h1>
          <Link to="/cart" aria-label={`Back to cart, ${count} items`} className="rounded p-1 hover:bg-[#e9e9e9]">
            <svg width="36" height="28" viewBox="0 0 40 30" fill="none" stroke="#0f1111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 3h5l5 17h18l4-12" /><circle cx="15" cy="25.5" r="2" fill="#0f1111" /><circle cx="28" cy="25.5" r="2" fill="#0f1111" /></svg>
          </Link>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[1150px] flex-1 px-4 py-5">
        <div ref={errorBox} aria-live="assertive">
          {error ? (
            <div role="alert" className="fade-in mb-4 flex gap-3 rounded-lg border border-[#c40000] bg-white p-4 shadow-[0_0_0_4px_#fcf4f4_inset]">
              <svg className="flex-none" width="28" height="26" viewBox="0 0 28 26" aria-hidden="true"><path d="M14 2l12 22H2z" fill="#c40000" /><path d="M14 10v7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /><circle cx="14" cy="20.5" r="1.4" fill="#fff" /></svg>
              <div>
                <h2 className="text-[17px] font-normal leading-6 text-[#c40000]">There was a problem</h2>
                <p className="text-[13px]">{error} <Link to="/cart" className="link">Go to Cart</Link></p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-start gap-6 lg:flex-row">
          <div className="w-full min-w-0 flex-1">
            <Step
              n={1}
              title="Delivery address"
              open={step === 1}
              onChange={addressDone ? () => setStep(1) : undefined}
              summary={address && addressDone ? <AddressLines a={address} /> : null}
            >
              {addresses.length > 0 && !adding ? (
                <div className="rounded-lg border border-line p-4">
                  <h3 className="border-b border-line pb-2 text-[18px] font-bold leading-6">Your addresses</h3>
                  <fieldset className="flex flex-col gap-1 py-3">
                    <legend className="sr-only">Choose a delivery address</legend>
                    {addresses.map((a) => (
                      <label key={a.id} className={`flex cursor-pointer items-start gap-2 rounded-md border p-2.5 ${a.id === addressId ? 'border-[#fbd8b4] bg-[#fcf5ee]' : 'border-transparent hover:bg-[#f7fafa]'}`}>
                        <input type="radio" name="address" className="mt-0.5 h-4 w-4 flex-none accent-[#007185]" checked={a.id === addressId} onChange={() => setAddressId(a.id)} />
                        <span className="min-w-0 text-[14px]">
                          <b>{a.fullName}</b> {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state}, {a.zip}, {a.country}
                          {a.isDefault ? <span className="ml-2 text-[12px] text-muted">Default</span> : null}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  <button className="link flex items-center gap-1.5 text-[14px]" onClick={() => setAdding(true)}>
                    <svg width="14" height="14" viewBox="0 0 14 14" stroke="#565959" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M7 2v10M2 7h10" /></svg>
                    Add a new delivery address
                  </button>
                  <div className="-mx-4 -mb-4 mt-4 rounded-b-lg border-t border-line bg-[#f0f2f2] p-3">
                    <button className="btn btn-buy" disabled={!address} onClick={() => { setAddressDone(true); setStep(paymentDone ? 3 : 2) }}>
                      Deliver to this address
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-line p-4">
                  <AddressForm
                    onCancel={addresses.length ? () => setAdding(false) : undefined}
                    onSaved={async (id) => {
                      await router.invalidate()
                      setAddressId(id)
                      setAdding(false)
                      setAddressDone(true)
                      setStep(paymentDone ? 3 : 2)
                    }}
                  />
                </div>
              )}
            </Step>

            <Step
              n={2}
              title="Payment method"
              open={step === 2}
              locked={!addressDone}
              onChange={paymentDone ? () => setStep(2) : undefined}
              summary={paymentDone ? <div>{payment}<div className="text-[12px] text-muted">Billing address: same as delivery address</div></div> : null}
            >
              <div className="rounded-lg border border-line p-4">
                <h3 className="border-b border-line pb-2 text-[18px] font-bold leading-6">Your payment methods</h3>
                <fieldset className="flex flex-col gap-1 py-3">
                  <legend className="sr-only">Choose a payment method</legend>
                  {PAYMENTS.map((p) => (
                    <label key={p.label} className={`flex cursor-pointer items-center gap-3 rounded-md border p-2.5 ${p.label === payment ? 'border-[#fbd8b4] bg-[#fcf5ee]' : 'border-transparent hover:bg-[#f7fafa]'}`}>
                      <input type="radio" name="payment" className="h-4 w-4 flex-none accent-[#007185]" checked={p.label === payment} onChange={() => setPayment(p.label)} />
                      <span className="flex h-7 w-11 flex-none items-center justify-center rounded border border-line bg-white text-[10px] font-bold italic" style={{ color: p.color }} aria-hidden="true">{p.mark}</span>
                      <span className="min-w-0">
                        <span className="block font-bold">{p.label}</span>
                        <span className="block text-[12px] text-muted">{p.note}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <p className="flex items-start gap-2 rounded-md border border-[#bfe3ea] bg-[#f3fafb] p-3 text-[13px]">
                  <svg className="mt-0.5 flex-none" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#007185" /><path d="M8 7v5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /><circle cx="8" cy="4.4" r="1.1" fill="#fff" /></svg>
                  This is a demo store. No real payment is taken.
                </p>
                <div className="-mx-4 -mb-4 mt-4 rounded-b-lg border-t border-line bg-[#f0f2f2] p-3">
                  <button className="btn btn-buy" onClick={() => { setPaymentDone(true); setStep(3) }}>Use this payment method</button>
                </div>
              </div>
            </Step>

            <Step n={3} title="Review items and shipping" open={step === 3} locked={!ready} last>
              <div className="rounded-lg border border-line p-4">
                <h3 className="text-[18px] font-bold leading-6 text-ok">Arriving {dates[delivery]}</h3>
                <p className="text-[12px] text-muted">Items shipped from Amazon.clone</p>
                <div className="mt-3 flex flex-col gap-5 md:flex-row">
                  <ul className="flex min-w-0 flex-1 flex-col gap-4">
                    {lines.map((l) => (
                      <li key={l.id} className="flex gap-3">
                        <Link to="/dp/$id" params={{ id: String(l.id) }} className="img-well h-[84px] w-[84px] flex-none rounded-sm p-1.5" aria-label={l.title}>
                          <img src={l.thumbnail} alt="" loading="lazy" />
                        </Link>
                        <div className="min-w-0 text-[13px]">
                          <div className="clamp-2 text-[14px] font-bold leading-5">{l.title}</div>
                          <div className="font-bold text-[#b12704]">{money(l.price)}</div>
                          <div>Qty: {l.qty} <Link to="/cart" className="link ml-2 text-[12px]">Change</Link></div>
                          <div className="text-[12px] text-muted">Sold by: Amazon.clone</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <fieldset className="flex-1 md:max-w-[340px]">
                    <legend className="mb-1 font-bold">Choose a delivery option:</legend>
                    {(['free', 'fast'] as const).map((d) => (
                      <label key={d} className="flex cursor-pointer items-start gap-2 py-1.5">
                        <input type="radio" name="delivery" className="mt-0.5 h-4 w-4 flex-none accent-[#007185]" checked={delivery === d} onChange={() => setDelivery(d)} />
                        <span>
                          <span className="block font-bold text-ok">{dates[d]}</span>
                          <span className="block text-[13px] text-muted">
                            {d === 'free' ? (totals.free.shipping === 0 ? 'FREE delivery' : `${money(totals.free.shipping)} - Standard delivery`) : `${money(totals.fast.shipping)} - Fastest delivery`}
                          </span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3 rounded-lg border border-line p-4 sm:flex-row sm:items-center">
                <div className="sm:w-[200px] sm:flex-none">{placeButton}</div>
                <div>
                  <div className="text-[18px] font-bold leading-6 text-[#b12704]">Order total: {money(t.total)}</div>
                  <p className="text-[12px] text-muted">By placing your order, you agree to Amazon.clone's privacy notice and conditions of use.</p>
                </div>
              </div>
            </Step>
          </div>

          <aside className="card w-full flex-none p-4 lg:sticky lg:top-4 lg:w-[300px]" aria-label="Order Summary">
            {placeButton}
            <p className="mt-2 border-b border-line pb-3 text-center text-[12px] leading-4 text-muted">
              {ready
                ? "By placing your order, you agree to Amazon.clone's privacy notice and conditions of use."
                : 'Choose a delivery address and payment method to continue.'}
            </p>
            <h2 className="mt-3 text-[18px] font-bold leading-6">Order Summary</h2>
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1 text-[13px] tabular-nums" aria-live="polite">
              <dt>Items ({count}):</dt><dd className="text-right">{money(t.subtotal)}</dd>
              <dt>Shipping &amp; handling:</dt><dd className="text-right">{money(t.shipping)}</dd>
              <dt className="pt-1">Total before tax:</dt><dd className="border-t border-line pt-1 text-right">{money(t.subtotal + t.shipping)}</dd>
              <dt>Estimated tax to be collected:</dt><dd className="text-right">{money(t.tax)}</dd>
              <dt className="mt-2 border-t border-line pt-2 text-[18px] font-bold leading-6 text-[#b12704]">Order total:</dt>
              <dd className="mt-2 border-t border-line pt-2 text-right text-[18px] font-bold leading-6 text-[#b12704]">{money(t.total)}</dd>
            </dl>
            <p className="-mx-4 -mb-4 mt-3 rounded-b-lg border-t border-line bg-[#f0f2f2] p-3 text-[12px] text-muted">
              This is a demo store. No real payment is taken.
            </p>
          </aside>
        </div>
      </main>

      <footer className="border-t border-line bg-gradient-to-b from-[#fafafa] to-white py-5 text-center text-[11px] text-muted">
        Need help? Check our <Link to="/" className="link">help pages</Link>. This is a demo project and is not affiliated with Amazon.
      </footer>
    </div>
  )
}

function AddressLines({ a }: { a: Address }) {
  return (
    <div>
      <div>{a.fullName}</div>
      <div>{a.line1}{a.line2 ? `, ${a.line2}` : ''}</div>
      <div>{a.city}, {a.state} {a.zip}</div>
    </div>
  )
}

function Step({ n, title, open, locked, last, summary, onChange, children }: {
  n: number
  title: string
  open: boolean
  locked?: boolean
  last?: boolean
  summary?: React.ReactNode
  onChange?: () => void
  children: React.ReactNode
}) {
  return (
    <section className={`py-3 ${last ? '' : 'border-b border-line'}`} aria-labelledby={`step-${n}`}>
      <div className="flex items-start gap-3">
        <h2 id={`step-${n}`} className={`flex flex-none gap-3 text-[18px] font-bold leading-6 sm:w-[220px] ${open ? 'text-[#c45500]' : locked ? 'text-muted' : ''}`}>
          <span className="w-4">{n}</span>
          {title}
        </h2>
        {!open && summary ? <div className="hidden min-w-0 flex-1 text-[13px] sm:block">{summary}</div> : <div className="flex-1" />}
        {!open && onChange ? <button className="link flex-none text-[13px]" onClick={onChange} aria-label={`Change ${title.toLowerCase()}`}>Change</button> : null}
      </div>
      {!open && summary ? <div className="pl-7 pt-1 text-[13px] sm:hidden">{summary}</div> : null}
      {open ? <div className="fade-in pt-3 sm:pl-7">{children}</div> : null}
    </section>
  )
}
