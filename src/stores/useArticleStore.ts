import { create } from 'zustand'
import type { Article, CategoryCount, ArchiveMonth } from '@/types'

interface ArticleState {
  articles: Article[]
  searchQuery: string
  currentPage: number
  pageSize: number
  sortBy: 'latest' | 'popular' | 'recommended'
  setSearchQuery: (query: string) => void
  setCurrentPage: (page: number) => void
  setSortBy: (sort: 'latest' | 'popular' | 'recommended') => void
  filteredArticles: () => Article[]
  totalPages: () => number
  paginatedArticles: () => Article[]
  categories: () => CategoryCount[]
  allTags: () => string[]
  archives: () => ArchiveMonth[]
}

const mockArticles: Article[] = [
  {
    id: '1',
    title: 'React Hooks 深度解析：从原理到实战',
    excerpt:
      '从 useState 和 useEffect 的底层原理出发，结合实际项目案例，带你全面掌握 React Hooks 的高级用法与最佳实践。',
    category: '前端',
    tags: ['React', 'Hooks', '性能优化'],
    date: '2026-02-25',
    readTime: '8 min',
    slug: 'react-hooks-deep-dive',
  },
  {
    id: '2',
    title: 'Docker 与 Kubernetes 实战指南',
    excerpt:
      '从容器基础到集群编排，一步步带你构建企业级的容器化部署流程。包含实战案例与常见踩坑总结。',
    category: 'DevOps',
    tags: ['Docker', 'K8s', 'CI/CD'],
    date: '2026-02-18',
    readTime: '12 min',
    slug: 'docker-kubernetes-guide',
  },
  {
    id: '3',
    title: 'TypeScript 高级类型模式与设计范式',
    excerpt:
      '深入探索 TypeScript 的条件类型、映射类型与 infer 关键字，掌握类型体操的核心技巧。',
    category: '前端',
    tags: ['TypeScript', '类型系统'],
    date: '2026-01-30',
    readTime: '10 min',
    slug: 'typescript-advanced-types',
  },
  {
    id: '4',
    title: 'Node.js 高并发架构设计与实践',
    excerpt:
      '探讨 Node.js 在高并发场景下的架构设计模式，包括集群模式、负载均衡、消息队列以及数据库连接池优化策略。',
    category: '后端',
    tags: ['Node.js', '架构', '高并发'],
    date: '2026-02-10',
    readTime: '15 min',
    slug: 'nodejs-high-concurrency',
  },
  {
    id: '5',
    title: '用 Vite 构建现代化前端工程',
    excerpt:
      '从零搭建基于 Vite 的项目模板，集成 ESLint、Prettier、Husky 和 Vitest，打造高效开发体验。',
    category: '工具',
    tags: ['Vite', '工程化'],
    date: '2026-01-20',
    readTime: '6 min',
    slug: 'vite-modern-frontend',
  },
]

export const useArticleStore = create<ArticleState>((set, get) => ({
  articles: mockArticles,
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

  categories: () => {
    const counts = new Map<string, number>()
    get().articles.forEach((a) => {
      counts.set(a.category, (counts.get(a.category) ?? 0) + 1)
    })
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  },

  allTags: () => {
    const tagSet = new Set<string>()
    get().articles.forEach((a) => a.tags.forEach((t) => tagSet.add(t)))
    return Array.from(tagSet)
  },

  archives: () => [
    { label: '2026 年 2 月', count: 8 },
    { label: '2026 年 1 月', count: 12 },
    { label: '2025 年 12 月', count: 6 },
    { label: '2025 年 11 月', count: 9 },
    { label: '2025 年 10 月', count: 7 },
  ],
}))
