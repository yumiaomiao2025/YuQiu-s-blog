import type { TimelineEntry } from '@/types'

interface TimelineItemProps {
  entry: TimelineEntry
}

export function TimelineItem({ entry }: TimelineItemProps) {
  return (
    <div className="flex gap-4">
      <span className="font-mono text-13px font-600 text-coral shrink-0">{entry.hash}</span>
      <div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-600 text-text-primary">{entry.year}</span>
          <span className="font-mono text-sm text-text-primary">-</span>
          <span className="font-mono text-sm font-600 text-text-primary">{entry.title}</span>
        </div>
        <p className="font-mono text-13px text-text-secondary m-0 mt-1">{entry.description}</p>
      </div>
    </div>
  )
}
