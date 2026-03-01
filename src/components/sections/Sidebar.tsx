import { SidebarCard } from '../common/SidebarCard'
import { TagBadge } from '../common/TagBadge'
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
            <div key={cat.name} className="flex items-center justify-between">
              <span className="font-mono text-13px text-text-primary">{cat.name}</span>
              <span className="font-mono text-12px text-coral">{cat.count}</span>
            </div>
          ))}
        </div>
      </SidebarCard>

      <SidebarCard command="cat tags.json">
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <TagBadge key={tag} label={tag} className="px-2.5 py-1" />
          ))}
        </div>
      </SidebarCard>

      {archives && (
        <SidebarCard command="ls -t ~/archive">
          <div className="flex flex-col gap-2">
            {archives.map((a) => (
              <div key={a.label} className="flex items-center justify-between">
                <span className="font-mono text-13px text-text-primary">{a.label}</span>
                <span className="font-mono text-12px text-text-secondary">{a.count} 篇</span>
              </div>
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
