---
title: GraphQL API 设计与性能优化
date: 2025-12-05
category: 后端
tags: [GraphQL, API, Node.js]
readTime: 10 min
slug: graphql-api-design
excerpt: 探讨 GraphQL Schema 设计原则、N+1 查询问题的解决方案，以及 DataLoader 批量加载优化技巧。
---

## 一、Schema 设计原则

好的 GraphQL Schema 是 API 成功的关键。遵循以下原则可以构建出易用且高效的 API。

```graphql
type Query {
  user(id: ID!): User
  users(filter: UserFilter, page: Pagination): UserConnection!
}

type User {
  id: ID!
  name: String!
  posts(first: Int = 10): [Post!]!
}
```

## 二、N+1 问题

嵌套查询是 GraphQL 的核心优势，但也容易引发 N+1 查询问题。

### DataLoader 解决方案

Facebook 开源的 DataLoader 通过批量加载和缓存解决了这个问题：

```ts
const userLoader = new DataLoader(async (ids) => {
  const users = await db.users.findByIds(ids);
  return ids.map(id => users.find(u => u.id === id));
});
```

## 三、性能监控

使用 Apollo Studio 或自定义 plugin 监控 resolver 执行时间，识别慢查询。
