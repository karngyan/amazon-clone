import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { ProductCard, SearchParams } from '#/lib/types'

export type HeroSlide = {
  eyebrow: string
  headline: string
  sub: string
  cta: string
  search: SearchParams
  bg: string
  fg: string
  items: ProductCard[]
}

const Arrow = ({ dir }: { dir: 'prev' | 'next' }) => (
  <svg width="22" height="40" viewBox="0 0 22 40" aria-hidden="true" className={dir === 'prev' ? 'rotate-180' : ''}>
    <path d="M4 3l14 17L4 37" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export function Hero({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const n = slides.length
  const go = (d: number) => setIndex((i) => (i + d + n) % n)

  useEffect(() => {
    if (paused || n < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setIndex((i) => (i + 1) % n), 6000)
    return () => clearInterval(t)
  }, [paused, n])

  const arrow =
    'absolute top-0 z-10 hidden h-[55%] w-16 items-center justify-center rounded-sm text-ink/80 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#007185] sm:flex'

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured promotions"
      className="relative h-[300px] overflow-hidden sm:h-[380px] md:h-[520px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className="flex h-full transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((s, i) => (
          <div
            key={s.headline}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${n}`}
            inert={i !== index}
            className="h-full w-full flex-none"
            style={{ background: s.bg, color: s.fg }}
          >
            <div className="mx-auto flex h-[62%] max-w-[1500px] items-center justify-between gap-6 px-5 sm:px-20">
              <div className="min-w-0 max-w-[560px]">
                <p className="text-[14px] font-medium opacity-90 sm:text-[17px]">{s.eyebrow}</p>
                <h2 className="mt-1 text-[28px] font-bold leading-[1.1] tracking-[-0.01em] sm:text-[40px] md:text-[48px]">{s.headline}</h2>
                <p className="mt-2 text-[15px] sm:text-[19px]">{s.sub}</p>
                <Link
                  to="/s"
                  search={s.search}
                  className="mt-4 inline-block rounded-full bg-white px-5 py-2 text-[14px] font-medium text-ink shadow-[0_2px_5px_rgba(15,17,17,.25)] hover:bg-[#f7fafa] active:bg-[#edfdff]"
                >
                  {s.cta}
                </Link>
              </div>
              <div className="hidden flex-none items-center gap-3 md:flex">
                {s.items.slice(0, 3).map((p, j) => (
                  <Link
                    key={p.id}
                    to="/dp/$id"
                    params={{ id: String(p.id) }}
                    aria-label={p.title}
                    className={`flex-none rounded-lg bg-white p-3 shadow-[0_6px_18px_rgba(15,17,17,.25)] transition-transform duration-200 hover:-translate-y-1 motion-reduce:transition-none ${j === 1 ? 'size-[200px]' : 'size-[160px]'} ${j === 2 ? 'hidden lg:block' : ''}`}
                  >
                    <img src={p.thumbnail} alt="" className="size-full object-contain" loading={i === 0 ? 'eager' : 'lazy'} />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Amazon's hero dissolves into the page grey so the card grid can sit on top of it. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-linear-to-b from-transparent to-[#e3e6e6]" />

      <button type="button" className={`${arrow} left-0`} onClick={() => go(-1)} aria-label="Previous slide"><Arrow dir="prev" /></button>
      <button type="button" className={`${arrow} right-0`} onClick={() => go(1)} aria-label="Next slide"><Arrow dir="next" /></button>

      <div className="absolute inset-x-0 top-[calc(62%-8px)] z-10 flex justify-center gap-0.5 sm:hidden">
        {slides.map((s, i) => (
          <button key={s.headline} type="button" onClick={() => setIndex(i)} aria-label={`Go to slide ${i + 1}`} aria-current={i === index} className="p-1.5">
            <span className={`block size-2 rounded-full ${i === index ? 'bg-ink' : 'bg-ink/30'}`} />
          </button>
        ))}
      </div>
    </section>
  )
}
