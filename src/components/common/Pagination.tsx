import { useEffect } from 'react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  pageSize?: number
  onPageSizeChange?: (size: number) => void
}

const PAGE_SIZE_OPTIONS = [5, 10, 20]

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize = 10,
  onPageSizeChange,
}: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return

      if (e.key === 'ArrowLeft' && currentPage > 1) {
        onPageChange(currentPage - 1)
      } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        onPageChange(currentPage + 1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPage, totalPages, onPageChange])

  return (
    <div className="flex items-center justify-center gap-4 pt-6">
      <span className="font-mono text-12px text-text-secondary">快捷键：← / →</span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="w-8 h-8 flex items-center justify-center rounded-1 border border-border font-mono text-13px text-text-secondary cursor-pointer bg-white hover:bg-gray-50 disabled:opacity-40"
        >
          &lt;
        </button>
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`w-8 h-8 flex items-center justify-center rounded-1 font-mono text-13px cursor-pointer ${
              page === currentPage
                ? 'bg-coral text-white font-600 border-none'
                : 'bg-white border border-border text-text-secondary hover:bg-gray-50'
            }`}
          >
            {page}
          </button>
        ))}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="w-8 h-8 flex items-center justify-center rounded-1 border border-border font-mono text-13px text-text-secondary cursor-pointer bg-white hover:bg-gray-50 disabled:opacity-40"
        >
          &gt;
        </button>
      </div>

      <div className="flex items-center gap-1 rounded-1 px-3 py-1.5 border border-border">
        <span className="font-mono text-12px font-600 text-green-accent">$</span>
        <span className="font-mono text-12px text-text-secondary">show</span>
        {onPageSizeChange ? (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="font-mono text-12px text-text-primary bg-transparent border-none outline-none cursor-pointer"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        ) : (
          <span className="font-mono text-12px text-text-secondary">{pageSize}</span>
        )}
        <span className="font-mono text-12px text-text-secondary">条/页</span>
      </div>
    </div>
  )
}
