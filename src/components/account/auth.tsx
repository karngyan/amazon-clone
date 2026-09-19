import { Link, useRouter } from '@tanstack/react-router'
import { Logo } from '#/components/Header'

/** Only same-site paths survive: "//evil.com" and absolute URLs are dropped. */
export const safeRedirect = (v: unknown): string | undefined =>
  typeof v === 'string' && /^\/(?![/\\])/.test(v) && !/[\r\n]/.test(v) ? v : undefined

// The key is always returned: validated search is merged over the raw query, so
// omitting it would let an unsafe value through untouched.
export const validateAuthSearch = (s: Record<string, unknown>): { redirect?: string } => ({
  redirect: safeRedirect(s.redirect),
})

/** After sign-in the root context is stale, so refresh it before leaving the page. */
export function useFinishAuth(target?: string) {
  const router = useRouter()
  return async () => {
    await router.invalidate()
    router.history.push(safeRedirect(target) ?? '/')
  }
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-white px-4 pb-10 pt-5">
      <Link to="/" aria-label="Amazon clone home" className="mb-6 px-2 pb-3 pt-1"><Logo dark /></Link>
      <main id="main" className="w-full max-w-[350px]">{children}</main>
      <footer className="mt-8 w-full">
        <div className="h-[44px] border-t border-[#e7e7e7] bg-[linear-gradient(to_bottom,rgba(0,0,0,.06),rgba(0,0,0,0)_6px)]" aria-hidden="true" />
        <div className="-mt-5 flex flex-wrap justify-center gap-x-8 gap-y-1 text-[11px] text-link">
          <span>Conditions of Use</span>
          <span>Privacy Notice</span>
          <span>Help</span>
        </div>
        <p className="mt-3 text-center text-[11px] text-muted">© 2026 Amazon.clone demo</p>
      </footer>
    </div>
  )
}

export function AlertIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" className="flex-none">
      <path d="M14 3L26.500 25h-25z" fill="none" stroke="#c40000" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M14 11v7" stroke="#c40000" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="14" cy="21.300" r="1.400" fill="#c40000" />
    </svg>
  )
}

/** Amazon's page-level error box. Always mounted so screen readers hear updates. */
export function ProblemBox({ message, className = '' }: { message: string | null; className?: string }) {
  return (
    <div role="alert" aria-live="assertive" className={message ? className : undefined}>
      {message ? (
        <div className="flex gap-3 rounded-lg border border-[#c40000] bg-white p-3.5 shadow-[0_0_0_4px_#fcf4f4_inset]">
          <AlertIcon />
          <div>
            <h2 className="text-[17px] leading-6 text-[#c40000]">There was a problem</h2>
            <p className="text-[13px] leading-[18px]">{message}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="mt-1 flex items-center gap-1.5 text-[12px] leading-4 text-[#c40000]">
      <span aria-hidden="true" className="font-bold italic">!</span>
      {message}
    </p>
  )
}

export function AuthDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-2 text-[12px] text-[#767676]">
      <span className="h-px flex-1 bg-[#e7e7e7]" />
      {children}
      <span className="h-px flex-1 bg-[#e7e7e7]" />
    </div>
  )
}
