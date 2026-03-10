---
title: CSS Grid 布局完全指南
date: 2026-02-28
category: 前端
tags: [CSS, 布局, 响应式]
readTime: 7 min
slug: css-grid-layout-mastery
excerpt: 从基础网格概念到复杂布局实战，掌握 CSS Grid 的核心属性与高级技巧，告别 float 和 flexbox 的局限。
---

## 一、Grid 布局基础

CSS Grid 是一种二维布局模型，能够同时控制行和列。与 Flexbox 不同，Grid 更适合整体页面布局。

```css
.container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: auto;
  gap: 16px;
}
```

## 二、核心属性

### grid-template-areas

通过命名区域实现直观的布局定义：

```css
.layout {
  display: grid;
  grid-template-areas:
    "header header header"
    "sidebar main main"
    "footer footer footer";
}
```

### 隐式网格与自动放置

当内容超出定义的网格时，浏览器会自动创建隐式轨道。`grid-auto-rows` 和 `grid-auto-flow` 可以控制这些行为。

## 三、响应式实践

结合 `minmax()` 和 `auto-fill`，无需媒体查询即可实现响应式网格：

```css
.responsive-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}
```
