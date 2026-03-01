import { useState } from 'react'

interface CommentSectionProps {
  prevArticle?: { title: string; slug: string }
  nextArticle?: { title: string; slug: string }
}

export function CommentSection({ prevArticle, nextArticle }: CommentSectionProps) {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write')

  return (
    <section className="px-30 py-8">
      {(prevArticle ?? nextArticle) && (
        <div className="flex items-center justify-between pb-5 border-b border-border mb-6">
          {prevArticle ? (
            <a
              href={`/article/${prevArticle.slug}`}
              className="font-mono text-sm font-600 text-coral no-underline hover:underline"
            >
              ← {prevArticle.title}
            </a>
          ) : (
            <span />
          )}
          {nextArticle ? (
            <a
              href={`/article/${nextArticle.slug}`}
              className="font-mono text-sm font-600 text-coral no-underline hover:underline"
            >
              {nextArticle.title} →
            </a>
          ) : (
            <span />
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mb-6">
        <h3 className="font-heading text-lg font-600 text-text-primary m-0">0 Comments</h3>
        <span className="font-mono text-13px text-text-secondary">- powered by utteranc.es</span>
      </div>

      <div className="flex gap-4">
        <div className="w-10 h-10 rounded-1.5 border border-border flex items-center justify-center bg-white shrink-0">
          <span className="text-lg">👤</span>
        </div>

        <div className="flex-1 rounded-2 border border-border overflow-hidden">
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab('write')}
              className={`px-4 py-2 font-mono text-12px cursor-pointer border-none ${
                activeTab === 'write'
                  ? 'bg-white text-text-primary font-600'
                  : 'bg-gray-50 text-text-secondary'
              }`}
            >
              Write
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-4 py-2 font-mono text-12px cursor-pointer border-none ${
                activeTab === 'preview'
                  ? 'bg-white text-text-primary font-600'
                  : 'bg-gray-50 text-text-secondary'
              }`}
            >
              Preview
            </button>
          </div>

          <textarea
            placeholder="留下你的评论..."
            className="w-full min-h-24 p-4 border-none outline-none resize-vertical font-mono text-sm text-text-primary placeholder:text-gray-400 bg-white box-border"
          />

          <div className="flex items-center justify-between px-4 py-2 border-t border-border">
            <span className="font-mono text-11px text-text-secondary">支持 Markdown 语法</span>
            <button className="rounded-1.5 bg-green-accent text-white font-mono text-12px font-600 px-4 py-2 border-none cursor-pointer hover:opacity-90 transition-opacity">
              使用 GitHub 登录
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
