export interface Article {
  id: string
  title: string
  excerpt: string
  category: string
  tags: string[]
  date: string
  readTime: string
  slug: string
}

export interface Project {
  id: string
  name: string
  description: string
  tags: string[]
  imageUrl: string
}

export interface TimelineEntry {
  hash: string
  year: string
  title: string
  description: string
}

export interface CategoryCount {
  name: string
  count: number
}

export interface ArchiveMonth {
  label: string
  count: number
}

export type NavRoute = '/' | '/articles' | '/article/:slug' | '/projects' | '/about'
