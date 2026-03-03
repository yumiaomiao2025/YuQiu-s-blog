import { createBrowserRouter } from 'react-router-dom'
import { HomePage } from '@/pages/Home'
import { ArticlesPage } from '@/pages/Articles'
import { ArticleDetailPage } from '@/pages/ArticleDetail'
import { ProjectsPage } from '@/pages/Projects'
import { AboutPage } from '@/pages/About'
import { NotFoundPage } from '@/pages/NotFound'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/articles', element: <ArticlesPage /> },
  { path: '/article/:slug', element: <ArticleDetailPage /> },
  { path: '/projects', element: <ProjectsPage /> },
  { path: '/about', element: <AboutPage /> },
  { path: '*', element: <NotFoundPage /> },
])
