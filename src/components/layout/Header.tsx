import { Link, useLocation } from 'react-router-dom'

const navItems = [
  { label: '首页', path: '/', cmd: '$ cd 首页' },
  { label: '文章', path: '/articles', cmd: '$ cd 文章' },
  { label: '项目', path: '/projects', cmd: '$ cd 项目' },
  { label: '关于', path: '/about', cmd: '$ cd 关于' },
]

export function Header() {
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <header className="flex items-center justify-between px-12 py-4 bg-white border-b border-border">
      <Link to="/" className="flex items-center gap-2 no-underline">
        <span className="font-mono text-xl font-700 text-coral">&gt;</span>
        <span className="font-mono text-xl font-700 text-text-primary">yuqiu_</span>
        <span className="w-0.5 h-6 bg-coral" />
      </Link>

      <nav className="flex items-center gap-1.5">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`rounded-1 px-4 py-1.5 border border-border font-mono text-13px no-underline transition-colors hover:bg-gray-50 ${
              isActive(item.path)
                ? 'text-text-primary font-normal'
                : 'text-text-secondary font-normal'
            }`}
          >
            {item.cmd}
          </Link>
        ))}
      </nav>
    </header>
  )
}
