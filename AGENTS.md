# 仓库协作指南

## 项目概览

这是一个基于 Vite + React + TypeScript 的个人博客。UnoCSS 负责 utility styles，
React Router 管理页面路由，Zustand 管理文章筛选状态。文章使用 Markdown 编写，并在
build time 通过 unified / remark / rehype pipeline 转换为应用消费的 JSON 数据。

## 常用命令

- `npm run dev` — 重新生成文章数据，然后启动 development server。
- `npm run generate` — 将 Markdown 文章转换为应用使用的 JSON 数据。
- `npm run build` — 重新生成文章、执行 TypeScript type-check，并产出 production build。
- `npm run lint` — 运行 ESLint。
- `npm run format` — 使用 Prettier 格式化整个仓库。

修改 application code 后，运行 `npm run lint` 和 `npm run build`。新增或修改文章后，
至少运行 `npm run generate`；如果同时影响页面或渲染逻辑，仍需运行完整的 lint 和 build。

## 仓库结构

- `posts/` 存放 Markdown 源文章及其 front matter。
- `scripts/generate-meta.ts` 负责读取文章并生成 metadata 与文章数据。
- `scripts/markdown/render-markdown.ts` 是 Markdown rendering pipeline 的统一入口。
- `scripts/markdown/plugins/` 存放可插拔的 rehype plugins，例如目录标题收集和图片包装。
- `src/data/meta.generated.json` 与 `src/data/posts/*.json` 是 generated outputs，禁止手动修改。
- `src/pages/` 存放 route-level views。
- `src/components/common/`、`src/components/layout/` 和 `src/components/sections/` 按作用域存放
  reusable components。
- `src/stores/` 存放 Zustand stores，`src/types/` 存放共享 TypeScript types。
- `src/styles/` 存放 global styles 与 Markdown styles；Markdown 样式按 tokens、base、code 和
  media 分层。

## 开发约定

- 使用 TypeScript，并通过现有的 `@/` alias 引用 `src/` 下的模块。
- 遵循 Prettier 配置：不写分号、使用 single quotes、保留 trailing commas、两空格缩进，
  每行最多 100 个字符。
- 保持 strict TypeScript 与 ESLint clean；避免使用 `any`，并延续现有 component patterns。
- 修改 Markdown rendering 或 post metadata 时，应更新 generator / rendering pipeline 并重新
  生成数据，不要直接 patch generated JSON。
- 标题目录与最终 HTML 必须来自同一次 AST processing，避免维护独立的正则解析逻辑。
- 博客特有行为应实现为独立 plugin，避免重新耦合进 `generate-meta.ts`。
- Markdown 中的 raw HTML 支持是有意保留的：pipeline 使用 `rehype-raw`，输入仅限仓库内可信
  的 local post content。若未来接入 user-generated content，必须先增加 sanitization。
- Markdown 视觉样式应保持 renderer-agnostic，优先通过 `.markdown-body`、CSS variables 和分层
  stylesheet 调整，不要让样式依赖某个 parser 的内部实现。
