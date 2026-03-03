import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageLayout } from '@/components/layout/PageLayout'
import { HeroSection } from '@/components/sections/HeroSection'
import { ArticleListItem } from '@/components/sections/ArticleListItem'
import { Sidebar } from '@/components/sections/Sidebar'
import { SearchBar } from '@/components/common/SearchBar'
import { Pagination } from '@/components/common/Pagination'
import { useArticleStore } from '@/stores/useArticleStore'

const sortOptions = [
  { key: 'newest' as const, label: '最新优先' },
  { key: 'oldest' as const, label: '最早优先' },
]

export function ArticlesPage() {
  const [searchParams] = useSearchParams()
  const searchQuery = useArticleStore((s) => s.searchQuery)
  const setSearchQuery = useArticleStore((s) => s.setSearchQuery)
  const setSelectedCategory = useArticleStore((s) => s.setSelectedCategory)
  const setSelectedTag = useArticleStore((s) => s.setSelectedTag)
  const setSelectedArchive = useArticleStore((s) => s.setSelectedArchive)
  const sortBy = useArticleStore((s) => s.sortBy)
  const setSortBy = useArticleStore((s) => s.setSortBy)
  const currentPage = useArticleStore((s) => s.currentPage)
  const setCurrentPage = useArticleStore((s) => s.setCurrentPage)
  const pageSize = useArticleStore((s) => s.pageSize)
  const setPageSize = useArticleStore((s) => s.setPageSize)
  const paginatedArticles = useArticleStore((s) => s.paginatedArticles)
  const totalPages = useArticleStore((s) => s.totalPages)
  const filteredArticles = useArticleStore((s) => s.filteredArticles)
  const categories = useArticleStore((s) => s.categories)
  const tags = useArticleStore((s) => s.tags)
  const archives = useArticleStore((s) => s.archives)
  const selectedCategory = useArticleStore((s) => s.selectedCategory)
  const selectedTag = useArticleStore((s) => s.selectedTag)
  const selectedArchive = useArticleStore((s) => s.selectedArchive)

  useEffect(() => {
    setSelectedCategory(searchParams.get('category') ?? '')
    setSelectedTag(searchParams.get('tag') ?? '')
    setSelectedArchive(searchParams.get('archive') ?? '')
  }, [searchParams, setSelectedCategory, setSelectedTag, setSelectedArchive])

  const activeFilter = selectedCategory || selectedTag || selectedArchive

  return (
    <PageLayout>
      <HeroSection
        comment="// articles.ts"
        title={
          <div className="flex items-center gap-3">
            <span className="font-mono text-3xl font-700 text-green-accent">$</span>
            <h1 className="font-heading text-4xl font-700 text-text-primary m-0">
              find ~/blog/posts
            </h1>
          </div>
        }
        subtitle="> 浏览所有文章——搜索、筛选、发现感兴趣的内容"
      />

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        totalCount={filteredArticles().length}
      />

      <div className="flex gap-8 p-12">
        <div className="flex-1 flex flex-col gap-0">
          <div className="flex items-center gap-3 pb-4 border-b border-border mb-4">
            <span className="font-mono text-12px font-600 text-coral">$ sort --by</span>
            {sortOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={`rounded-1 px-3 py-1 border border-border font-mono text-12px cursor-pointer transition-colors ${
                  sortBy === opt.key
                    ? 'text-text-primary bg-white font-600'
                    : 'text-text-secondary bg-white hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}

            {activeFilter && (
              <>
                <span className="font-mono text-12px text-text-secondary ml-2">|</span>
                <span className="font-mono text-12px font-600 text-coral">$ filter</span>
                <span className="rounded-1 px-3 py-1 border border-border font-mono text-12px text-text-primary bg-white">
                  {selectedCategory || selectedTag || selectedArchive}
                </span>
                <a
                  href="/articles"
                  className="font-mono text-12px text-text-secondary hover:text-coral transition-colors no-underline"
                >
                  清除 ×
                </a>
              </>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {paginatedArticles().map((article) => (
              <ArticleListItem key={article.id} article={article} />
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages()}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
          />
        </div>

        <Sidebar categories={categories} tags={tags} archives={archives} />
      </div>
    </PageLayout>
  )
}
