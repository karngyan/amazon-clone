import { useEffect, useRef, useState } from 'react'

export function Gallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0)
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null)
  const [open, setOpen] = useState(false)
  const src = images[active] ?? images[0]

  const onMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Touch devices fire synthetic mouse events; zoom there just gets stuck.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const r = e.currentTarget.getBoundingClientRect()
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
  }

  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row">
      {images.length > 1 ? (
        <Thumbs images={images} active={active} onPick={setActive} title={title} className="flex gap-2 overflow-x-auto p-1 sm:flex-col sm:overflow-visible" />
      ) : null}
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className="img-well block aspect-square w-full cursor-zoom-in rounded-sm p-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007185]"
          onMouseMove={onMove}
          onMouseLeave={() => setZoom(null)}
          onClick={() => setOpen(true)}
          aria-label="Open full view of product image"
        >
          <img
            src={src}
            alt={title}
            className="transition-transform duration-150 ease-out"
            style={zoom ? { transform: 'scale(2.2)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          />
        </button>
        <p className="mt-2 hidden text-center text-[13px] text-muted sm:block">{zoom ? 'Click to see full view' : 'Roll over image to zoom in'}</p>
      </div>
      {open ? <Lightbox images={images} title={title} start={active} onClose={() => setOpen(false)} /> : null}
    </div>
  )
}

function Thumbs({ images, active, onPick, title, className }: { images: string[]; active: number; onPick: (i: number) => void; title: string; className: string }) {
  return (
    <div className={className} role="group" aria-label="Product images">
      {images.map((img, i) => (
        <button
          key={img}
          type="button"
          onMouseEnter={() => onPick(i)}
          onFocus={() => onPick(i)}
          onClick={() => onPick(i)}
          aria-label={`Show image ${i + 1} of ${images.length}`}
          aria-pressed={i === active}
          className={`img-well h-12 w-12 flex-none rounded-md border p-1 outline-none transition-shadow ${
            i === active ? 'border-[#007185] shadow-[0_0_0_3px_#c8f3fa]' : 'border-[#888c8c] hover:border-[#007185] focus-visible:border-[#007185]'
          }`}
        >
          <img src={img} alt="" />
          <span className="sr-only">{title}</span>
        </button>
      ))}
    </div>
  )
}

function Lightbox({ images, title, start, onClose }: { images: string[]; title: string; start: number; onClose: () => void }) {
  const [active, setActive] = useState(start)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setActive((a) => (a + 1) % images.length)
      if (e.key === 'ArrowLeft') setActive((a) => (a - 1 + images.length) % images.length)
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus()
    }
  }, [images.length, onClose])

  return (
    <div className="fade-in fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(15,17,17,.7)] p-3 sm:p-8" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Images of ${title}`}
        className="pop-in flex max-h-full w-full max-w-[1100px] flex-col overflow-hidden rounded-lg bg-white shadow-[0_8px_32px_rgba(0,0,0,.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line bg-[#f0f2f2] px-4 py-2">
          <span className="font-bold">Images</span>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="rounded p-1.5 hover:bg-[#e3e6e6] focus-visible:outline-2 focus-visible:outline-[#007185]">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2l12 12M14 2L2 14" stroke="#0f1111" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4 md:flex-row">
          <div className="img-well aspect-square min-w-0 flex-1 rounded-sm p-4 md:max-h-[75vh]">
            <img src={images[active]} alt={title} />
          </div>
          <div className="md:w-[260px] md:flex-none">
            <p className="clamp-3 mb-3 text-[14px] leading-5">{title}</p>
            {images.length > 1 ? (
              <Thumbs images={images} active={active} onPick={setActive} title={title} className="flex flex-wrap gap-2 p-1" />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
