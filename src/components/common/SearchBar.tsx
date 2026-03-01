interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  totalCount?: number
}

export function SearchBar({
  value,
  onChange,
  placeholder = '搜索文章标题、内容、标签...',
  totalCount,
}: SearchBarProps) {
  return (
    <div className="flex items-center gap-4 px-20 py-6 border-b border-border">
      <div className="flex-1 flex items-center gap-2 rounded-2 border border-border px-5 py-3">
        <span className="font-mono text-sm font-700 text-green-accent">$</span>
        <span className="font-mono text-sm font-600 text-coral">grep -r</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`"${placeholder}"`}
          className="flex-1 bg-transparent border-none outline-none font-mono text-sm text-text-primary placeholder:text-gray-400"
        />
      </div>
      {totalCount !== undefined && (
        <span className="font-mono text-13px text-text-secondary whitespace-nowrap">
          共 {totalCount} 篇文章
        </span>
      )}
    </div>
  )
}
