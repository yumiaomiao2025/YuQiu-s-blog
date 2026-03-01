import { Link } from 'react-router-dom'
import { TagBadge } from '../common/TagBadge'
import type { Article } from '@/types'

interface ArticleListItemProps {
  article: Article
}

export function ArticleListItem({ article }: ArticleListItemProps) {
  return (
    <Link
      to={`/article/${article.slug}`}
      className="block rounded-2 border border-border p-5 bg-white no-underline hover:shadow-sm transition-shadow"
    >
      <div className="flex items-center gap-2 mb-2.5">
        <TagBadge label={article.category} variant="category" />
        <span className="font-mono text-11px text-text-secondary">{article.date}</span>
        <span className="font-mono text-11px text-text-secondary">·</span>
        <span className="font-mono text-11px text-text-secondary">阅读 {article.readTime}</span>
      </div>

      <h3 className="font-heading text-xl font-700 text-text-primary m-0 mb-2.5">
        {article.title}
      </h3>

      <p className="font-mono text-13px text-text-secondary leading-relaxed m-0 mb-2.5">
        {article.excerpt}
      </p>

      <div className="flex items-center gap-1.5">
        {article.tags.map((tag) => (
          <TagBadge key={tag} label={tag} />
        ))}
      </div>
    </Link>
  )
}
