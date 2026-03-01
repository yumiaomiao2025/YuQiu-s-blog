import { Link } from 'react-router-dom'
import { TagBadge } from '../common/TagBadge'
import type { Article } from '@/types'

interface ArticleCardProps {
  article: Article
}

export function ArticleCard({ article }: ArticleCardProps) {
  return (
    <Link
      to={`/article/${article.slug}`}
      className="block rounded-2 border border-border overflow-hidden bg-white no-underline hover:shadow-sm transition-shadow"
    >
      <div className="flex items-center gap-2 px-5 py-2.5 bg-[#F7F7F5]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        <span className="ml-2 font-mono text-12px text-text-secondary">
          {article.slug}.md
        </span>
      </div>

      <div className="p-5 flex flex-col gap-3">
        <h3 className="font-heading text-lg font-700 text-text-primary m-0">{article.title}</h3>
        <p className="font-mono text-13px text-text-secondary leading-relaxed m-0">
          {article.excerpt}
        </p>
        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-1.5">
            {article.tags.map((tag) => (
              <TagBadge key={tag} label={tag} />
            ))}
          </div>
          <span className="font-mono text-11px text-text-secondary">
            发布于 · {article.date}
          </span>
        </div>
      </div>
    </Link>
  )
}
