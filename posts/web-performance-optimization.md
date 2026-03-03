---
title: 前端性能优化实战清单
date: 2025-11-18
category: 前端
tags: [性能优化, Web Vitals, 工程化]
readTime: 12 min
slug: web-performance-optimization
excerpt: 从 Core Web Vitals 指标出发，系统梳理前端性能优化的关键策略：代码分割、图片优化、渲染性能与网络层优化。
---

## 一、Core Web Vitals

Google 定义的三大核心指标：

- **LCP**（Largest Contentful Paint）：最大内容渲染时间 < 2.5s
- **INP**（Interaction to Next Paint）：交互响应时间 < 200ms
- **CLS**（Cumulative Layout Shift）：累计布局偏移 < 0.1

## 二、加载性能

### 代码分割

使用动态 `import()` 和路由懒加载，减少首屏 JS 体积：

```ts
const Dashboard = lazy(() => import('./pages/Dashboard'));
```

### 图片优化

- 使用 WebP/AVIF 格式
- 实现懒加载（`loading="lazy"`）
- 根据设备尺寸提供不同分辨率（`srcset`）

## 三、渲染性能

避免强制同步布局、减少重排重绘、使用 `will-change` 提示浏览器优化合成层。
