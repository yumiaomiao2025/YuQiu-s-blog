import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { rehypeCollectHeadings } from './plugins/collect-headings.js'
import { rehypeFigureImage } from './plugins/figure-image.js'
import type { MarkdownHeading, RenderedMarkdown } from './types.js'

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSlug)
  .use(rehypeCollectHeadings)
  .use(rehypeFigureImage)
  .use(rehypeHighlight, { detect: true })
  .use(rehypeStringify, { allowDangerousHtml: true })

export async function renderMarkdown(source: string): Promise<RenderedMarkdown> {
  const result = await markdownProcessor.process(source)

  return {
    html: String(result),
    headings: (result.data.headings as MarkdownHeading[] | undefined) ?? [],
  }
}
