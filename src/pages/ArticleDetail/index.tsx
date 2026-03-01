import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { PageLayout } from '@/components/layout/PageLayout'
import { TagBadge } from '@/components/common/TagBadge'
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer'
import { CommentSection } from '@/components/sections/CommentSection'
import { useArticleStore } from '@/stores/useArticleStore'

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

const postModules = import.meta.glob<{ default: PostData }>('/src/data/posts/*.json', {
  eager: true,
})

function getPostBySlug(slug: string): PostData | undefined {
  const key = `/src/data/posts/${slug}.json`
  return postModules[key]?.default
}

export function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const articles = useArticleStore((s) => s.articles)
  const [post, setPost] = useState<PostData | undefined>()

  useEffect(() => {
    if (slug) {
      setPost(getPostBySlug(slug))
    }
  }, [slug])

  if (!post) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center py-24">
          <span className="font-mono text-text-secondary">
            {slug ? '文章加载中...' : '文章不存在'}
          </span>
        </div>
      </PageLayout>
    )
  }

  const currentIdx = articles.findIndex((a) => a.slug === slug)
  const prevArticle = currentIdx > 0 ? articles[currentIdx - 1] : undefined
  const nextArticle = currentIdx < articles.length - 1 ? articles[currentIdx + 1] : undefined

  const dateStr = new Date(post.meta.date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return (
    <PageLayout>
      <div className="flex items-center gap-1.5 px-12 py-4 border-b border-border bg-white">
        <span className="font-mono text-13px font-700 text-green-accent">$</span>
        <span className="font-mono text-13px text-text-secondary">pwd:</span>
        <span className="font-mono text-13px text-text-secondary">~</span>
        <span className="font-mono text-13px text-text-secondary">/</span>
        <Link to="/" className="font-mono text-13px text-green-accent no-underline hover:underline">
          博客
        </Link>
        <span className="font-mono text-13px text-text-secondary">/</span>
        <Link
          to="/articles"
          className="font-mono text-13px text-green-accent no-underline hover:underline"
        >
          {post.meta.category}
        </Link>
        <span className="font-mono text-13px text-text-secondary">/</span>
        <span className="font-mono text-13px font-600 text-text-primary">{post.meta.title}</span>
      </div>

      <div className="flex gap-10 p-12">
        <article className="flex-1 min-w-0">
          <div className="flex flex-col gap-4 mb-8">
            <h1 className="font-heading text-3xl font-700 text-text-primary m-0">
              {post.meta.title}
            </h1>
            <div className="flex items-center gap-3">
              <span className="font-mono text-13px text-text-secondary">YuQiu</span>
              <span className="font-mono text-13px text-text-secondary">·</span>
              <span className="font-mono text-13px text-text-secondary">{dateStr}</span>
              <span className="font-mono text-13px text-text-secondary">·</span>
              <span className="font-mono text-13px text-text-secondary">
                阅读 {post.meta.readTime}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <TagBadge label={post.meta.category} variant="category" />
              {post.meta.tags.map((tag) => (
                <TagBadge key={tag} label={tag} />
              ))}
            </div>
          </div>

          <hr className="border-none h-px bg-border w-full m-0 mb-8" />

          <MarkdownRenderer html={post.html} />
        </article>

        {post.headings.length > 0 && (
          <aside className="w-60 shrink-0">
            <div className="rounded-2 border border-border p-5 flex flex-col gap-3 sticky top-8">
              <div className="flex items-center gap-2">
                <span className="font-mono text-13px font-700 text-coral">//</span>
                <span className="font-mono text-13px font-600 text-text-primary">目录</span>
              </div>
              <hr className="border-none h-px bg-border w-full m-0" />
              {post.headings
                .filter((h) => h.level <= 3)
                .map((heading) => (
                  <a
                    key={heading.id}
                    href={`#${heading.id}`}
                    className={`font-mono text-13px text-text-secondary no-underline hover:text-coral transition-colors ${
                      heading.level === 3 ? 'ml-3' : ''
                    }`}
                  >
                    {heading.text}
                  </a>
                ))}
            </div>
          </aside>
        )}
      </div>

      <CommentSection
        prevArticle={
          prevArticle ? { title: prevArticle.title, slug: prevArticle.slug } : undefined
        }
        nextArticle={
          nextArticle ? { title: nextArticle.title, slug: nextArticle.slug } : undefined
        }
      />

      {articles.length > 1 && (
        <section className="px-12 py-8 border-t border-border">
          <div className="flex items-center gap-2 mb-5">
            <span className="font-mono text-lg font-700 text-coral">//</span>
            <h3 className="font-heading text-xl font-600 text-text-primary m-0">相关推荐</h3>
          </div>
          <div className="flex gap-4">
            {articles
              .filter((a) => a.slug !== slug)
              .slice(0, 3)
              .map((ra) => (
                <Link
                  key={ra.slug}
                  to={`/article/${ra.slug}`}
                  className="flex-1 rounded-2 border border-border p-4 no-underline hover:shadow-sm transition-shadow"
                >
                  <h4 className="font-heading text-base font-600 text-text-primary m-0">
                    {ra.title}
                  </h4>
                  <span className="font-mono text-11px text-text-secondary mt-2 block">
                    {new Date(ra.date).toLocaleDateString('zh-CN')} · {ra.category}
                  </span>
                </Link>
              ))}
          </div>
        </section>
      )}
    </PageLayout>
  )
}
