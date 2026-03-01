/// <reference types="vite/client" />

declare module '@/data/meta.generated.json' {
  interface ArticleMeta {
    id: string
    title: string
    date: string
    category: string
    tags: string[]
    readTime: string
    slug: string
    excerpt: string
  }
  interface CategoryCount {
    name: string
    count: number
  }
  interface ArchiveMonth {
    label: string
    count: number
  }
  const data: {
    articles: ArticleMeta[]
    categories: CategoryCount[]
    tags: string[]
    archives: ArchiveMonth[]
  }
  export default data
}

declare module '@/data/posts/*.json' {
  interface PostData {
    meta: {
      id: string
      title: string
      date: string
      category: string
      tags: string[]
      readTime: string
      slug: string
      excerpt: string
    }
    headings: { level: number; text: string; id: string }[]
    html: string
  }
  const data: PostData
  export default data
}
