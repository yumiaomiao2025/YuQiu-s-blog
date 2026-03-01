import { PageLayout } from '@/components/layout/PageLayout'
import { CodeBlock, CodeLine } from '@/components/common/CodeBlock'
import { SkillCard } from '@/components/sections/SkillCard'
import { TimelineItem } from '@/components/sections/TimelineItem'
import { TerminalBlock, TerminalComment } from '@/components/common/TerminalBlock'
import type { TimelineEntry } from '@/types'

const timeline: TimelineEntry[] = [
  {
    hash: 'a1f72c1',
    year: '2025',
    title: '开源技术布道者',
    description: '开始系统性输出技术文章，构建个人品牌与开源影响力。',
  },
  {
    hash: 'b4e09f3',
    year: '2024',
    title: '全栈架构升级',
    description: '主导微服务架构转型，引入 K8s 容器编排与 CI/CD 自动化。',
  },
  {
    hash: 'c1d3a8b',
    year: '2022',
    title: '开源项目突破 1000 Star',
    description: '开源 UI 组件库获得社区认可，持续迭代维护。',
  },
  {
    hash: 'd7f08a2',
    year: '2019',
    title: '正式入行，成为前端开发工程师',
    description: '加入创业团队，从零构建产品前端。',
  },
]

export function AboutPage() {
  return (
    <PageLayout>
      <section className="flex items-center gap-12 px-20 py-16 border-b border-border">
        <div className="w-45 h-45 rounded-full bg-code-bg border-3 border-coral flex items-center justify-center shrink-0">
          <span className="font-heading text-6xl font-700 text-coral">YQ</span>
        </div>

        <div className="flex-1 flex flex-col gap-4">
          <TerminalComment text="// about.ts" />
          <CodeBlock>
            <CodeLine color="coral">{'class 开发者 {'}</CodeLine>
            <CodeLine>{'  姓名 = "YuQiu";'}</CodeLine>
            <CodeLine>{'  角色 = "全栈工程师";'}</CodeLine>
            <CodeLine color="green">{'  座右铭 = "代码即诗，Bug 即灵感";'}</CodeLine>
            <CodeLine>{'  爱好 = ["开源", "写作", "咖啡"];'}</CodeLine>
            <CodeLine color="coral">{'}'}</CodeLine>
          </CodeBlock>
        </div>
      </section>

      <section className="px-20 py-12">
        <TerminalBlock command="skills --list" className="text-lg mb-6" />
        <div className="flex gap-6">
          <SkillCard
            title="前端开发"
            skills={['React', 'Vue', 'TypeScript', 'Next.js', 'UnoCSS']}
          />
          <SkillCard
            title="后端服务"
            skills={['Node.js', 'Go', 'PostgreSQL', 'Redis', 'GraphQL']}
          />
          <SkillCard title="工具链" skills={['Docker', 'K8s', 'GitHub Actions', 'Vite']} />
        </div>
      </section>

      <section className="px-20 py-12 border-t border-border">
        <TerminalBlock command="git log --oneline" className="text-lg mb-6" />
        <div className="flex flex-col gap-5 pl-5">
          {timeline.map((entry) => (
            <TimelineItem key={entry.hash} entry={entry} />
          ))}
        </div>
      </section>
    </PageLayout>
  )
}
