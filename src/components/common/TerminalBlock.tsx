import type { ReactNode } from 'react'

interface TerminalBlockProps {
  command: string
  dollar?: boolean
  children?: ReactNode
  className?: string
}

export function TerminalBlock({ command, dollar = true, children, className = '' }: TerminalBlockProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {dollar && <span className="font-mono font-700 text-green-accent">$</span>}
      <span className="font-mono text-sm font-600 text-text-primary">{command}</span>
      {children}
    </div>
  )
}

interface TerminalCommentProps {
  text: string
  className?: string
}

export function TerminalComment({ text, className = '' }: TerminalCommentProps) {
  return (
    <span className={`font-mono text-13px text-text-secondary ${className}`}>{text}</span>
  )
}
