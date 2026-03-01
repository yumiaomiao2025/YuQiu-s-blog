import type { ReactNode } from 'react'
import { TerminalComment } from '../common/TerminalBlock'

interface HeroSectionProps {
  comment: string
  title: ReactNode
  subtitle: string
  children?: ReactNode
}

export function HeroSection({ comment, title, subtitle, children }: HeroSectionProps) {
  return (
    <section className="px-20 py-12 border-b border-border bg-white">
      <TerminalComment text={comment} />
      <div className="mt-4">{title}</div>
      <p className="font-mono text-sm text-text-secondary leading-relaxed mt-4 max-w-[700px]">
        {subtitle}
      </p>
      {children && <div className="mt-6">{children}</div>}
    </section>
  )
}
