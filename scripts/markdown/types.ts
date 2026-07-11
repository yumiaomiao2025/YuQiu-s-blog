export interface MarkdownHeading {
  level: number
  text: string
  id: string
}

export interface RenderedMarkdown {
  html: string
  headings: MarkdownHeading[]
}
