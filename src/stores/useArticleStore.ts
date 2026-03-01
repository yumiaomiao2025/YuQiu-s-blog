import { create } from 'zustand'
import generatedMeta from '@/data/meta.generated.json'
import type { Article, CategoryCount, ArchiveMonth } from '@/types'

interface ArticleState {
  articles: Article[]
  searchQuery: string
  currentPage: number
  pageSize: number
  sortBy: 'latest' | 'popular' | 'recommended'
  categories: CategoryCount[]
  tags: string[]
  archives: ArchiveMonth[]
  setSearchQuery: (query: string) => void
  setCurrentPage: (page: number) => void
  setSortBy: (sort: 'latest' | 'popular' | 'recommended') => void
  filteredArticles: () => Article[]
  totalPages: () => number
  paginatedArticles: () => Article[]
}

export const useArticleStore = create<ArticleState>((set, get) => ({
  articles: generatedMeta.articles as Article[],
  categories: generatedMeta.categories,
  tags: generatedMeta.tags,
  archives: generatedMeta.archives,
  searchQuery: '',
  currentPage: 1,
  pageSize: 10,
  sortBy: 'latest',

  setSearchQuery: (query) => set({ searchQuery: query, currentPage: 1 }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setSortBy: (sort) => set({ sortBy: sort, currentPage: 1 }),

  filteredArticles: () => {
    const { articles, searchQuery } = get()
    if (!searchQuery) return articles
    const q = searchQuery.toLowerCase()
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.excerpt.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q)),
    )
  },

  totalPages: () => {
    const { pageSize } = get()
    return Math.max(1, Math.ceil(get().filteredArticles().length / pageSize))
  },

  paginatedArticles: () => {
    const { currentPage, pageSize } = get()
    const filtered = get().filteredArticles()
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  },
}))
