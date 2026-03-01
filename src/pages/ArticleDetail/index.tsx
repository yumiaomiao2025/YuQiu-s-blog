import { PageLayout } from '@/components/layout/PageLayout'
import { CodeBlock, CodeLine } from '@/components/common/CodeBlock'
import { TagBadge } from '@/components/common/TagBadge'
import { CommentSection } from '@/components/sections/CommentSection'
import { Link } from 'react-router-dom'

const tocItems = ['什么是 React Hooks', '核心原理解析', '实战最佳实践']

const relatedArticles = [
  { title: 'useEffect 完全指南', date: '2026-02-10', category: '前端', slug: 'useeffect-guide' },
  {
    title: 'React 性能优化实战',
    date: '2026-01-28',
    category: '性能优化',
    slug: 'react-performance',
  },
  {
    title: '状态管理方案对比',
    date: '2026-01-15',
    category: '架构',
    slug: 'state-management-compare',
  },
]

export function ArticleDetailPage() {
  return (
    <PageLayout>
      <div className="flex items-center gap-1.5 px-12 py-4 border-b border-border bg-white">
        <span className="font-mono text-13px font-700 text-green-accent">$</span>
        <span className="font-mono text-13px text-text-secondary">pwd:</span>
        <span className="font-mono text-13px text-text-secondary">~</span>
        <span className="font-mono text-13px text-text-secondary">/</span>
        <Link
          to="/"
          className="font-mono text-13px text-green-accent no-underline hover:underline"
        >
          博客
        </Link>
        <span className="font-mono text-13px text-text-secondary">/</span>
        <span className="font-mono text-13px text-green-accent">前端</span>
        <span className="font-mono text-13px text-text-secondary">/</span>
        <span className="font-mono text-13px font-600 text-text-primary">
          React Hooks 深度解析
        </span>
      </div>

      <div className="flex gap-10 p-12">
        <article className="flex-1 flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <h1 className="font-heading text-3xl font-700 text-text-primary m-0">
              React Hooks 深度解析：从原理到实战
            </h1>
            <div className="flex items-center gap-3">
              <span className="font-mono text-13px text-text-secondary">YuQiu</span>
              <span className="font-mono text-13px text-text-secondary">·</span>
              <span className="font-mono text-13px text-text-secondary">2026-02-25</span>
              <span className="font-mono text-13px text-text-secondary">·</span>
              <span className="font-mono text-13px text-text-secondary">阅读 8 min</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TagBadge label="前端" variant="category" />
              <TagBadge label="React" />
              <TagBadge label="Hooks" />
            </div>
          </div>

          <hr className="border-none h-px bg-border w-full m-0" />

          <section className="flex flex-col gap-6">
            <h2 className="font-heading text-2xl font-600 text-text-primary m-0">
              一、什么是 React Hooks
            </h2>
            <p className="font-mono text-sm text-text-primary leading-[1.8] m-0">
              React Hooks 是 React 16.8
              引入的新特性，允许你在函数组件中使用 state 和其他 React
              特性。在此之前，只有类组件才能拥有自己的状态和生命周期方法。Hooks
              的出现彻底改变了 React 的开发范式。
            </p>

            <CodeBlock fileName="useCounter.ts">
              <CodeLine color="coral">
                {"import { useState, useCallback } from 'react';"}
              </CodeLine>
              <CodeLine color="muted">{''}</CodeLine>
              <CodeLine>{'function useCounter(initialValue = 0) {'}</CodeLine>
              <CodeLine color="green">
                {'  const [count, setCount] = useState(initialValue);'}
              </CodeLine>
              <CodeLine>{'  const increment = useCallback(() => setCount(c => c + 1), []);'}</CodeLine>
              <CodeLine>{'  const decrement = useCallback(() => setCount(c => c - 1), []);'}</CodeLine>
              <CodeLine color="coral">{'  return { count, increment, decrement };'}</CodeLine>
              <CodeLine>{'}'}</CodeLine>
            </CodeBlock>

            <h2 className="font-heading text-2xl font-600 text-text-primary m-0">
              二、核心原理解析
            </h2>
            <p className="font-mono text-sm text-text-primary leading-[1.8] m-0">
              Hooks 的核心机制基于 Fiber
              架构中的链表结构。每个组件实例维护一个 hooks
              链表，React 在每次渲染时按顺序遍历该链表。这就是为什么 Hooks
              不能放在条件语句中——它们必须保持调用顺序的一致性。
            </p>

            <h2 className="font-heading text-2xl font-600 text-text-primary m-0">
              三、实战最佳实践
            </h2>
            <p className="font-mono text-sm text-text-primary leading-[1.8] m-0">
              在实际项目中，自定义 Hook
              是复用逻辑的最佳方式。将组件的业务逻辑抽离到独立的 Hook
              中，不仅提升了代码的可测试性，还让组件本身更加简洁。下面我们通过几个常见场景来展示最佳实践。
            </p>
          </section>
        </article>

        <aside className="w-60 shrink-0">
          <div className="rounded-2 border border-border p-5 flex flex-col gap-3 sticky top-8">
            <div className="flex items-center gap-2">
              <span className="font-mono text-13px font-700 text-coral">//</span>
              <span className="font-mono text-13px font-600 text-text-primary">目录</span>
            </div>
            <hr className="border-none h-px bg-border w-full m-0" />
            {tocItems.map((item, i) => (
              <a
                key={item}
                href={`#section-${i}`}
                className="font-mono text-13px text-text-secondary no-underline hover:text-coral transition-colors"
              >
                {i + 1}. {item}
              </a>
            ))}
          </div>
        </aside>
      </div>

      <CommentSection
        prevArticle={{ title: '构建高性能 Node.js 服务', slug: 'nodejs-high-concurrency' }}
        nextArticle={{ title: 'useEffect 完全指南', slug: 'useeffect-guide' }}
      />

      <section className="px-12 py-8 border-t border-border">
        <div className="flex items-center gap-2 mb-5">
          <span className="font-mono text-lg font-700 text-coral">//</span>
          <h3 className="font-heading text-xl font-600 text-text-primary m-0">相关推荐</h3>
        </div>
        <div className="flex gap-4">
          {relatedArticles.map((ra) => (
            <Link
              key={ra.slug}
              to={`/article/${ra.slug}`}
              className="flex-1 rounded-2 border border-border p-4 no-underline hover:shadow-sm transition-shadow"
            >
              <h4 className="font-heading text-base font-600 text-text-primary m-0">{ra.title}</h4>
              <span className="font-mono text-11px text-text-secondary mt-2 block">
                {ra.date} · {ra.category}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </PageLayout>
  )
}
