import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

interface CommentSectionProps {
  prevArticle?: { title: string; slug: string }
  nextArticle?: { title: string; slug: string }
}

export function CommentSection({ prevArticle, nextArticle }: CommentSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    el.innerHTML = ''
    const script = document.createElement('script')
    script.src = 'https://utteranc.es/client.js'
    script.setAttribute('repo', 'owner/repo')
    script.setAttribute('issue-term', 'pathname')
    script.setAttribute('theme', 'github-light')
    script.setAttribute('crossorigin', 'anonymous')
    script.async = true
    el.appendChild(script)
  }, [])

  return (
    <section className="px-30 py-8">
      {(prevArticle ?? nextArticle) && (
        <div className="flex items-center justify-between pb-5 border-b border-border mb-6">
          {prevArticle ? (
            <Link
              to={`/article/${prevArticle.slug}`}
              className="font-mono text-sm font-600 text-coral no-underline hover:underline"
            >
              ← {prevArticle.title}
            </Link>
          ) : (
            <span />
          )}
          {nextArticle ? (
            <Link
              to={`/article/${nextArticle.slug}`}
              className="font-mono text-sm font-600 text-coral no-underline hover:underline"
            >
              {nextArticle.title} →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}

      <div ref={containerRef} />
    </section>
  )
}
