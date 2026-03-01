---
title: 用 Vite 构建现代化前端工程
date: 2026-01-20
category: 工具
tags: [Vite, 工程化]
readTime: 6 min
slug: vite-modern-frontend
excerpt: 从零搭建基于 Vite 的项目模板，集成 ESLint、Prettier、Husky 和 Vitest，打造高效开发体验。
---

## 一、为什么选 Vite

Vite 利用浏览器原生 ESM 实现秒级启动，配合 esbuild 预构建依赖，开发体验远超 Webpack。核心优势：

- **极速冷启动**：不需要打包，直接按需编译
- **即时 HMR**：模块热替换速度与项目规模无关
- **开箱即用**：TypeScript、JSX、CSS Modules 零配置支持

## 二、工程化配置

### ESLint + Prettier

```ts
// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    files: ['**/*.{ts,tsx}'],
  },
);
```

### Husky + lint-staged

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,css}": ["prettier --write"]
  }
}
```

## 三、测试集成

Vitest 与 Vite 共享配置，零成本集成：

```ts
// vite.config.ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
```

这套配置模板可以作为团队项目的起点，后续按需扩展。
