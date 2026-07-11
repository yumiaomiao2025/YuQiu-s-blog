import type { Element, Properties, Root } from 'hast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

/**
 * Wrap images in a figure and use title/alt as the caption.
 * A Markdown/HTML width attribute is moved to the figure as max-width.
 */
export const rehypeFigureImage: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'element', (node: Element, index, parent) => {
    if (node.tagName !== 'img' || !parent || index == null) return
    if ((parent as Element).tagName === 'figure') return

    const properties = node.properties
    const caption = String(properties.title ?? properties.alt ?? '')

    let figureStyle: string | undefined
    const rawWidth = properties.width as string | number | undefined
    if (rawWidth != null && rawWidth !== '') {
      const width = String(rawWidth).trim()
      figureStyle = `max-width:${/^\d+$/.test(width) ? `${width}px` : width}`
      delete properties.width
    }

    delete properties.title

    const figureProperties: Properties = { className: ['md-figure'] }
    if (figureStyle) figureProperties.style = figureStyle

    const figure: Element = {
      type: 'element',
      tagName: 'figure',
      properties: figureProperties,
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
