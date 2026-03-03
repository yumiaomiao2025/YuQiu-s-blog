import { PageLayout } from '@/components/layout/PageLayout'
import { HeroSection } from '@/components/sections/HeroSection'
import { ProjectCard } from '@/components/sections/ProjectCard'
import type { Project } from '@/types'

const projects: Project[] = [
  {
    id: '1',
    name: '智能文档助手',
    description:
      '基于 LLM 的智能文档生成工具，支持 Markdown、自定义模板和批量处理。',
    tags: ['React', 'Node.js', 'OpenAI'],
    imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=200&fit=crop',
    url: '#',
    repoUrl: '#',
  },
  {
    id: '2',
    name: '开源组件库',
    description: '一套轻量级 UI 组件集，基于 React 和 TypeScript 构建。',
    tags: ['TypeScript', 'Storybook'],
    imageUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=200&fit=crop',
    url: '#',
    repoUrl: '#',
  },
  {
    id: '3',
    name: 'CLI 脚手架工具',
    description: '命令行项目模板生成工具，自动集成 ESLint、Prettier、Husky。',
    tags: ['Node.js', 'CLI'],
    imageUrl: 'https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=400&h=200&fit=crop',
    url: '#',
    repoUrl: '#',
  },
  {
    id: '4',
    name: '数据可视化平台',
    description: '基于 ECharts 的数据分析仪表盘，支持实时数据流和自定义图表。',
    tags: ['Vue', 'ECharts', 'WebSocket'],
    imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=200&fit=crop',
    url: '#',
    repoUrl: '#',
  },
]

export function ProjectsPage() {
  return (
    <PageLayout>
      <HeroSection
        comment="// projects.ts"
        title={
          <div className="flex items-center gap-3">
            <span className="font-mono text-3xl font-700 text-green-accent">$</span>
            <h1 className="font-mono text-3xl font-700 text-text-primary m-0">ls ~/projects</h1>
          </div>
        }
        subtitle="> 开源项目与作品集——每一行代码都是一次探索"
      />

      <div className="flex flex-col gap-8 px-20 py-12">
        <div className="flex gap-6">
          {projects.slice(0, 2).map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
        <div className="flex gap-6">
          {projects.slice(2, 4).map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </PageLayout>
  )
}
