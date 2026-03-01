import { TagBadge } from '../common/TagBadge'

interface SkillCardProps {
  title: string
  skills: string[]
}

export function SkillCard({ title, skills }: SkillCardProps) {
  return (
    <div className="flex-1 rounded-2 border border-border p-5 flex flex-col gap-4">
      <span className="font-mono text-sm font-600 text-coral">// {title}</span>
      <div className="flex flex-wrap gap-2">
        {skills.map((skill) => (
          <TagBadge key={skill} label={skill} className="px-2.5 py-1" />
        ))}
      </div>
    </div>
  )
}
