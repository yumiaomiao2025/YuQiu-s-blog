import type { ReactNode } from 'react'

interface CodeBlockProps {
  fileName?: string
  children: ReactNode
  className?: string
}

export function CodeBlock({ fileName, children, className = '' }: CodeBlockProps) {
  return (
    <div className={`rounded-2 border border-border overflow-hidden ${className}`}>
      {fileName && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#EEEEEE]">
          <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
          <span className="w-3 h-3 rounded-full bg-[#28C840]" />
          <span className="ml-2 font-mono text-12px text-text-secondary">{fileName}</span>
        </div>
      )}
      <div className="bg-code-bg p-4 px-5 flex flex-col gap-1">{children}</div>
    </div>
  )
}

interface CodeLineProps {
  children: string
  color?: 'default' | 'coral' | 'green' | 'muted'
}

export function CodeLine({ children, color = 'default' }: CodeLineProps) {
  const colorMap = {
    default: 'text-text-primary',
    coral: 'text-coral',
    green: 'text-green-accent',
    muted: 'text-text-secondary',
  }

  return (
    <span className={`font-mono text-13px ${colorMap[color]}`}>{children}</span>
  )
}
