interface MarkdownRendererProps {
  html: string
  className?: string
}

export function MarkdownRenderer({ html, className = '' }: MarkdownRendererProps) {
  return (
    <div
      className={`markdown-body ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
