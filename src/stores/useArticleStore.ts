import { create } from 'zustand'
import generatedMeta from '@/data/meta.generated.json'
import type { Article, CategoryCount, ArchiveMonth } from '@/types'

interface ArticleState {
  articles: Article[]
  searchQuery: string
  selectedCategory: string
  selectedTag: string
  selectedArchive: string
  sortBy: 'newest' | 'oldest'
  currentPage: number
  pageSize: number
  categories: CategoryCount[]
  tags: string[]
  archives: ArchiveMonth[]
  setSearchQuery: (query: string) => void
  setSelectedCategory: (category: string) => void
  setSelectedTag: (tag: string) => void
  setSelectedArchive: (archive: string) => void
  setSortBy: (sort: 'newest' | 'oldest') => void
  setCurrentPage: (page: number) => void
  setPageSize: (size: number) => void
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
  selectedCategory: '',
  selectedTag: '',
  selectedArchive: '',
  sortBy: 'newest',
  currentPage: 1,
  pageSize: 10,

  setSearchQuery: (query) => set({ searchQuery: query, currentPage: 1 }),
  setSelectedCategory: (category) => set({ selectedCategory: category, currentPage: 1 }),
  setSelectedTag: (tag) => set({ selectedTag: tag, currentPage: 1 }),
  setSelectedArchive: (archive) => set({ selectedArchive: archive, currentPage: 1 }),
  setSortBy: (sort) => set({ sortBy: sort, currentPage: 1 }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setPageSize: (size) => set({ pageSize: size, currentPage: 1 }),

  filteredArticles: () => {
    const { articles, searchQuery, selectedCategory, selectedTag, selectedArchive, sortBy } = get()
    let result = articles

    if (selectedCategory) {
      result = result.filter((a) => a.category === selectedCategory)
    }

    if (selectedTag) {
      result = result.filter((a) => a.tags.includes(selectedTag))
    }

    if (selectedArchive) {
      result = result.filter((a) => {
        const d = new Date(a.date)
        const label = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`
        return label === selectedArchive
      })
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.excerpt.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q)),
      )
    }

    if (sortBy === 'oldest') {
      result = [...result].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }

    return result
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
