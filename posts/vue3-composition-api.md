---
title: Vue 3 Composition API 实战总结
date: 2025-12-20
category: 前端
tags: [Vue, Composition API, 响应式]
readTime: 9 min
slug: vue3-composition-api
excerpt: 从 Options API 到 Composition API 的迁移指南，结合 ref、reactive 和 composables 模式提升代码可维护性。
---

## 一、为什么需要 Composition API

Options API 在大型组件中容易导致逻辑分散，相关功能被拆分到 data、methods、computed 等选项中。Composition API 允许按逻辑关注点组织代码。

```ts
import { ref, computed, onMounted } from 'vue';

export function useCounter(initial = 0) {
  const count = ref(initial);
  const doubled = computed(() => count.value * 2);
  const increment = () => count.value++;
  return { count, doubled, increment };
}
```

## 二、响应式核心

### ref vs reactive

- `ref` 适用于基本类型，访问值需要 `.value`
- `reactive` 适用于对象，直接访问属性

### watchEffect 与 watch

`watchEffect` 自动追踪依赖，`watch` 则需要显式指定监听源。

## 三、Composables 模式

将可复用逻辑封装为 `use*` 函数，是 Composition API 的最佳实践。
