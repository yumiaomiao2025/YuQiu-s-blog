import type { ReactNode } from 'react'
import { TerminalBlock } from './TerminalBlock'

interface SidebarCardProps {
  command: string
  children: ReactNode
  className?: string
}

export function SidebarCard({ command, children, className = '' }: SidebarCardProps) {
  return (
    <div className={`rounded-2 border border-border p-5 ${className}`}>
      <TerminalBlock command={command} className="mb-4" />
      {children}
    </div>
  )
}
