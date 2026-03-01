interface TagBadgeProps {
  label: string
  variant?: 'default' | 'category'
  className?: string
}

export function TagBadge({ label, variant = 'default', className = '' }: TagBadgeProps) {
  const baseClass = 'rounded-1 px-2 py-0.5 border border-border font-mono text-11px inline-block'
  const colorClass = variant === 'category' ? 'text-coral' : 'text-text-secondary'

  return <span className={`${baseClass} ${colorClass} ${className}`}>{label}</span>
}
