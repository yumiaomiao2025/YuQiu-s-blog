import { Link } from 'react-router-dom'
import { SidebarCard } from '../common/SidebarCard'
import type { CategoryCount, ArchiveMonth } from '@/types'

interface SidebarProps {
  categories: CategoryCount[]
  tags: string[]
  archives?: ArchiveMonth[]
  recentProjects?: { name: string; description: string }[]
}

export function Sidebar({ categories, tags, archives, recentProjects }: SidebarProps) {
  return (
    <aside className="w-80 flex flex-col gap-6 shrink-0">
      <SidebarCard command="ls /categories">
        <div className="flex flex-col gap-2">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              to={`/articles?category=${encodeURIComponent(cat.name)}`}
              className="flex items-center justify-between no-underline hover:opacity-75 transition-opacity"
            >
              <span className="font-mono text-13px text-text-primary">{cat.name}</span>
              <span className="font-mono text-12px text-coral">{cat.count}</span>
            </Link>
          ))}
        </div>
      </SidebarCard>

      <SidebarCard command="cat tags.json">
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Link
              key={tag}
              to={`/articles?tag=${encodeURIComponent(tag)}`}
              className="rounded-1 px-2.5 py-1 border border-border font-mono text-11px text-text-secondary no-underline hover:text-coral hover:border-coral transition-colors"
            >
              {tag}
            </Link>
          ))}
        </div>
      </SidebarCard>

      {archives && (
        <SidebarCard command="ls -t ~/archive">
          <div className="flex flex-col gap-2">
            {archives.map((a) => (
              <Link
                key={a.label}
                to={`/articles?archive=${encodeURIComponent(a.label)}`}
                className="flex items-center justify-between no-underline hover:opacity-75 transition-opacity"
              >
                <span className="font-mono text-13px text-text-primary">{a.label}</span>
                <span className="font-mono text-12px text-text-secondary">{a.count} 篇</span>
              </Link>
            ))}
          </div>
        </SidebarCard>
      )}

      {recentProjects && (
        <SidebarCard command="ls ~/projects">
          <div className="flex flex-col gap-2.5">
            {recentProjects.map((p) => (
              <div key={p.name}>
                <span className="font-mono text-13px font-600 text-green-accent">&gt;</span>
                <span className="font-mono text-13px text-text-primary ml-2">{p.name}</span>
                <p className="font-mono text-11px text-text-secondary m-0 ml-4 mt-0.5">
                  {p.description}
                </p>
              </div>
            ))}
          </div>
        </SidebarCard>
      )}
    </aside>
  )
}
