import { Link } from 'react-router-dom'
import { PageLayout } from '@/components/layout/PageLayout'

export function NotFoundPage() {
  return (
    <PageLayout>
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <div className="flex items-center gap-3">
          <span className="font-mono text-5xl font-700 text-coral">&gt;</span>
          <h1 className="font-heading text-5xl font-700 text-text-primary m-0">404</h1>
        </div>
        <p className="font-mono text-sm text-text-secondary">
          $ cat page.md → Error: No such file or directory
        </p>
        <Link
          to="/"
          className="rounded-1.5 bg-coral text-white font-mono text-sm px-7 py-3 no-underline hover:opacity-90 transition-opacity"
        >
          $ cd ~
        </Link>
      </div>
    </PageLayout>
  )
}
