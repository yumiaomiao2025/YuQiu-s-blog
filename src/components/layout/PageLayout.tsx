import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'

interface PageLayoutProps {
  children: ReactNode
}

export function PageLayout({ children }: PageLayoutProps) {
  const { pathname } = useLocation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const hideTimerRef = useRef<number | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    const showScrollbar = () => {
      scrollEl.classList.add('is-scrolling')

      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current)
      }

      hideTimerRef.current = window.setTimeout(() => {
        scrollEl.classList.remove('is-scrolling')
      }, 1000)
    }

    scrollEl.addEventListener('scroll', showScrollbar, { passive: true })

    return () => {
      scrollEl.removeEventListener('scroll', showScrollbar)

      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current)
      }
    }
  }, [])

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto flex flex-col bg-white custom-scrollbar">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
