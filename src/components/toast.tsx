import { Link } from '@tanstack/react-router'
import { createContext, useCallback, useContext, useRef, useState } from 'react'

type Toast = { title: string; body?: string; image?: string; href?: string; cta?: string }
const Ctx = createContext<(t: Toast) => void>(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<(Toast & { key: number }) | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const show = useCallback((t: Toast) => {
    clearTimeout(timer.current)
    setToast({ ...t, key: Date.now() })
    timer.current = setTimeout(() => setToast(null), 4000)
  }, [])
  return (
    <Ctx.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 sm:justify-end sm:pr-6">
        {toast ? (
          <div key={toast.key} className="toast-in pointer-events-auto flex w-full max-w-[380px] items-center gap-3 rounded-lg border border-line bg-white p-3 shadow-[0_8px_24px_rgba(15,17,17,.25)]">
            {toast.image ? <div className="img-well h-14 w-14 flex-none rounded"><img src={toast.image} alt="" /></div> : null}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 font-bold text-ok">
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#007600" /><path d="M4.5 8.2l2.3 2.3 4.7-4.9" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
                {toast.title}
              </div>
              {toast.body ? <div className="truncate text-[13px] text-muted">{toast.body}</div> : null}
            </div>
            {toast.href ? <Link to={toast.href} className="btn btn-buy flex-none" onClick={() => setToast(null)}>{toast.cta ?? 'View'}</Link> : null}
          </div>
        ) : null}
      </div>
    </Ctx.Provider>
  )
}
