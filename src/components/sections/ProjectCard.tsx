import { TagBadge } from '../common/TagBadge'
import type { Project } from '@/types'

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <div className="rounded-2 border border-border overflow-hidden bg-white flex-1">
      <div
        className="h-40 bg-cover bg-center"
        style={{ backgroundImage: `url(${project.imageUrl})` }}
      />
      <div className="p-5 flex flex-col gap-3">
        <h3 className="font-heading text-lg font-700 text-text-primary m-0">{project.name}</h3>
        <p className="font-mono text-13px text-text-secondary leading-relaxed m-0">
          {project.description}
        </p>
        <div className="flex items-center gap-1.5">
          {project.tags.map((tag) => (
            <TagBadge key={tag} label={tag} />
          ))}
        </div>
        <div className="flex items-center gap-3 mt-1">
          {project.url && (
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-1.5 bg-coral text-white font-mono text-12px px-4 py-2 no-underline hover:opacity-90 transition-opacity"
            >
              查看详情
            </a>
          )}
          {project.repoUrl && (
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-1.5 bg-white text-coral font-mono text-12px px-4 py-2 border border-coral no-underline hover:bg-coral-bg transition-colors"
            >
              源码
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
