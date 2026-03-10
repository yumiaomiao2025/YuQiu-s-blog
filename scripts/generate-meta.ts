import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import type { Root, Element } from 'hast'
import { visit } from 'unist-util-visit'

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '')
}

function extractTextContent(node: Element): string {
  let text = ''
  for (const child of node.children) {
    if (child.type === 'text') {
      text += child.value
    } else if (child.type === 'element') {
      text += extractTextContent(child)
    }
  }
  return text
}

function rehypeHeadingIds() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (/^h[1-6]$/.test(node.tagName)) {
        const text = extractTextContent(node).trim()
        if (text) {
          node.properties = node.properties || {}
          node.properties.id = generateSlug(text)
        }
      }
    })
  }
}

/**
 * 把所有 <img> 自动包成 <figure class="md-figure"><img/><figcaption>
 *
 * caption 来源（优先级）：title > alt > 无（只有图片，不生成 figcaption）
 *
 * max-width 支持（用于缩小图片）：
 *   <img width="60%" />   → figure style="max-width:60%"
 *   <img width="400" />   → figure style="max-width:400px"
 *   <img width="400px" /> → figure style="max-width:400px"
 */
function rehypeFigureImage() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'img' || !parent || index == null) return
      if ((parent as Element).tagName === 'figure') return

      const props = node.properties ?? {}

      // caption
      const caption = String(props.title ?? props.alt ?? '')

      // max-width：读取 width 属性后从 img 上移除，改挂在 figure 上
      let figureStyle: string | undefined
      const rawWidth = props.width as string | number | undefined
      if (rawWidth != null && rawWidth !== '') {
        const w = String(rawWidth).trim()
        figureStyle = `max-width:${/^\d+$/.test(w) ? `${w}px` : w}`
        delete props.width
      }

      // 清掉 title，避免浏览器原生 tooltip 弹出干扰
      delete props.title

      const figureProps: Record<string, unknown> = { className: ['md-figure'] }
      if (figureStyle) figureProps.style = figureStyle

      const figure: Element = {
        type: 'element',
        tagName: 'figure',
        properties: figureProps,
        children: [
          node,
          ...(caption
            ? [
                {
                  type: 'element',
                  tagName: 'figcaption',
                  properties: {},
                  children: [{ type: 'text', value: caption }],
                } as Element,
              ]
            : []),
        ],
      }

      parent.children.splice(index, 1, figure)
    })
  }
}

const POSTS_DIR = path.resolve('posts')
const OUTPUT_DIR = path.resolve('src/data')
const POSTS_OUTPUT_DIR = path.resolve('src/data/posts')

interface ArticleMeta {
  id: string
  title: string
  date: string
  category: string
  tags: string[]
  readTime: string
  slug: string
  excerpt: string
}

interface CategoryCount {
  name: string
  count: number
}

interface ArchiveMonth {
  label: string
  count: number
}

interface GeneratedMeta {
  articles: ArticleMeta[]
  categories: CategoryCount[]
  tags: string[]
  archives: ArchiveMonth[]
}

const mdProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeHeadingIds)
  .use(rehypeFigureImage)
  .use(rehypeHighlight, { detect: true })
  .use(rehypeStringify, { allowDangerousHtml: true })

function extractHeadings(content: string): { level: number; text: string; id: string }[] {
  const headings: { level: number; text: string; id: string }[] = []
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+)$/.exec(line)
    if (match?.[1] && match[2]) {
      const text = match[2].trim()
      const id = text
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fff]+/g, '-')
        .replace(/^-|-$/g, '')
      headings.push({ level: match[1].length, text, id })
    }
  }
  return headings
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(POSTS_OUTPUT_DIR, { recursive: true })

  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'))

  const articles: ArticleMeta[] = []

  for (const file of files) {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8')
    const { data, content } = matter(raw)

    const slug = (data.slug as string) || file.replace(/\.md$/, '')
    const meta: ArticleMeta = {
      id: slug,
      title: data.title as string,
      date: data.date as string,
      category: data.category as string,
      tags: data.tags as string[],
      readTime: data.readTime as string,
      slug,
      excerpt: data.excerpt as string,
    }

    articles.push(meta)

    const htmlResult = await mdProcessor.process(content)
    const headings = extractHeadings(content)

    const postData = {
      meta,
      headings,
      html: String(htmlResult),
    }

    fs.writeFileSync(
      path.join(POSTS_OUTPUT_DIR, `${slug}.json`),
      JSON.stringify(postData, null, 2),
    )

    console.log(`  ✓ ${slug}`)
  }

  articles.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const categoryMap = new Map<string, number>()
  const tagSet = new Set<string>()
  const archiveMap = new Map<string, number>()

  for (const a of articles) {
    categoryMap.set(a.category, (categoryMap.get(a.category) ?? 0) + 1)
    a.tags.forEach((t) => tagSet.add(t))

    const d = new Date(a.date)
    const key = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`
    archiveMap.set(key, (archiveMap.get(key) ?? 0) + 1)
  }

  const generated: GeneratedMeta = {
    articles,
    categories: Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    tags: Array.from(tagSet),
    archives: Array.from(archiveMap.entries()).map(([label, count]) => ({ label, count })),
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'meta.generated.json'),
    JSON.stringify(generated, null, 2),
  )

  console.log(`\n✓ 生成完成: ${articles.length} 篇文章`)
  console.log(`  分类: ${generated.categories.map((c) => `${c.name}(${c.count})`).join(', ')}`)
  console.log(`  标签: ${generated.tags.join(', ')}`)
  console.log(`  归档: ${generated.archives.map((a) => `${a.label}(${a.count})`).join(', ')}`)
}

main().catch(console.error)
