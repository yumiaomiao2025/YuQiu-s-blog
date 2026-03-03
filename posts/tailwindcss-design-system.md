---
title: 用 Tailwind CSS 构建设计系统
date: 2026-03-01
category: 前端
tags: [Tailwind CSS, 设计系统, CSS]
readTime: 7 min
slug: tailwindcss-design-system
excerpt: 基于 Tailwind CSS 搭建可扩展的设计系统，包含主题配置、组件抽象和 Design Token 管理。
---

## 一、Design Token 定义

在 `tailwind.config.js` 中统一管理设计变量：

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FEF0E8',
          500: '#C75B39',
          900: '#7A2E1B',
        },
      },
      spacing: {
        18: '4.5rem',
      },
    },
  },
};
```

## 二、组件抽象

### 使用 @apply 封装

```css
.btn-primary {
  @apply rounded-lg bg-brand-500 text-white px-6 py-2
         font-medium hover:bg-brand-600 transition-colors;
}
```

### CVA 模式

使用 `class-variance-authority` 管理组件变体，比手写条件类更可维护。

## 三、主题切换

通过 CSS 变量 + Tailwind 的 `darkMode: 'class'` 实现亮暗主题切换。
