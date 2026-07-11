import type { Element, Root } from 'hast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import type { MarkdownHeading } from '../types.js'

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

/** Collect headings after rehype-slug has assigned their final IDs. */
export const rehypeCollectHeadings: Plugin<[], Root> = () => (tree, file) => {
  const headings: MarkdownHeading[] = []

  visit(tree, 'element', (node: Element) => {
    if (!/^h[1-6]$/.test(node.tagName)) return

    const id = String(node.properties.id ?? '')
    const text = extractTextContent(node).trim()
    if (!id || !text) return

    headings.push({
      level: Number(node.tagName.slice(1)),
      text,
      id,
    })
  })

  file.data.headings = headings
}
