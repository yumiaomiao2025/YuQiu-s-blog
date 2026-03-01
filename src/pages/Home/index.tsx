import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageLayout } from '@/components/layout/PageLayout'
import { HeroSection } from '@/components/sections/HeroSection'
import { ArticleCard } from '@/components/sections/ArticleCard'
import { Sidebar } from '@/components/sections/Sidebar'
import { Pagination } from '@/components/common/Pagination'
import { CodeBlock, CodeLine } from '@/components/common/CodeBlock'
import { useArticleStore } from '@/stores/useArticleStore'

export function HomePage() {
  const [page, setPage] = useState(1)
  const articles = useArticleStore((s) => s.articles)
  const categories = useArticleStore((s) => s.categories)
  const tags = useArticleStore((s) => s.tags)

  return (
    <PageLayout>
      <HeroSection
        comment="// main.ts"
        title={
          <div className="flex items-center gap-4">
            <span className="font-mono text-5xl font-700 text-coral">&gt;</span>
            <h1 className="font-heading text-5xl font-700 text-text-primary m-0">
              你好，我是 YuQiu
            </h1>
          </div>
        }
        subtitle="> 一个热爱折腾的全栈开发者，专注于用技术解决真实问题"
      >
        <CodeBlock className="max-w-md">
          <CodeLine color="muted">{'const developer = {'}</CodeLine>
          <CodeLine>{'  name: "YuQiu",'}</CodeLine>
          <CodeLine>{'  role: "全栈工程师",'}</CodeLine>
          <CodeLine color="green">{'  skills: ["前端", "后端", "DevOps"],'}</CodeLine>
          <CodeLine color="coral">{'  passion: "构建优雅的解决方案"'}</CodeLine>
          <CodeLine color="muted">{'};'}</CodeLine>
        </CodeBlock>

        <div className="flex items-center gap-4 mt-6">
          <Link
            to="/articles"
            className="rounded-1.5 bg-coral text-white font-mono text-sm px-7 py-3 no-underline hover:opacity-90 transition-opacity"
          >
            浏览文章
          </Link>
          <Link
            to="/projects"
            className="rounded-1.5 bg-white text-coral font-mono text-sm px-7 py-3 no-underline border-1.5 border-coral hover:bg-coral-bg transition-colors"
          >
            了解项目 →
          </Link>
        </div>
      </HeroSection>

      <div className="flex gap-8 p-12">
        <div className="flex-1 flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-700 text-coral">//</span>
            <h2 className="font-heading text-xl font-600 text-text-primary m-0">最新文章</h2>
          </div>
          {articles.slice(0, 3).map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
          <Pagination currentPage={page} totalPages={3} onPageChange={setPage} pageSize={12} />
        </div>

        <Sidebar
          categories={categories}
          tags={tags}
          recentProjects={[
            { name: '智能文档助手', description: 'AI 驱动的文档工具' },
            { name: '开源组件库', description: 'React UI 组件集合' },
            { name: 'CLI 脚手架工具', description: '项目模板生成器' },
          ]}
        />
      </div>
    </PageLayout>
  )
}
