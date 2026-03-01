interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  pageSize?: number
}

export function Pagination({ currentPage, totalPages, onPageChange, pageSize = 10 }: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

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
        <span className="font-mono text-12px text-text-secondary">show {pageSize} 条/页</span>
      </div>
    </div>
  )
}
