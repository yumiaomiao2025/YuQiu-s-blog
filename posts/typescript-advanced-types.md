---
title: TypeScript 高级类型模式与设计范式
date: 2026-01-30
category: 前端
tags: [TypeScript, 类型系统]
readTime: 10 min
slug: typescript-advanced-types
excerpt: 深入探索 TypeScript 的条件类型、映射类型与 infer 关键字，掌握类型体操的核心技巧。
---

## 一、条件类型

条件类型是 TypeScript 类型系统中最强大的工具之一，它的语法类似于三元表达式：

```ts
type IsString<T> = T extends string ? true : false;

type A = IsString<'hello'>; // true
type B = IsString<42>;      // false
```

### 分布式条件类型

当条件类型作用于联合类型时，它会自动分发到每个成员：

```ts
type ToArray<T> = T extends unknown ? T[] : never;

type Result = ToArray<string | number>;
// string[] | number[]  （不是 (string | number)[]）
```

## 二、映射类型

映射类型可以基于已有类型创建新类型，遍历键并转换值类型：

```ts
type Readonly<T> = {
  readonly [K in keyof T]: T[K];
};

type Partial<T> = {
  [K in keyof T]?: T[K];
};

// 实用：把所有属性变为 Promise
type Async<T> = {
  [K in keyof T]: Promise<T[K]>;
};
```

## 三、infer 关键字

`infer` 用于在条件类型中声明待推断的类型变量：

```ts
// 提取函数返回类型
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

// 提取 Promise 的内部类型
type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;

// 提取数组元素类型
type ElementOf<T> = T extends (infer E)[] ? E : never;
```

掌握这三个核心概念，你就能应对大部分类型体操场景。
