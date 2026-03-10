---
title: Redis 缓存策略与最佳实践
date: 2026-02-05
category: 后端
tags: [Redis, 缓存, 性能优化]
readTime: 9 min
slug: redis-caching-strategies
excerpt: 详解 Redis 的缓存穿透、雪崩与击穿问题，以及布隆过滤器、双写一致性等解决方案。
---

## 一、缓存的基本模式

### Cache-Aside（旁路缓存）

最常见的缓存模式：先查缓存，缓存未命中则查数据库，再写入缓存。

```ts
async function getUser(id: string) {
  let user = await redis.get(`user:${id}`);
  if (!user) {
    user = await db.findUser(id);
    await redis.set(`user:${id}`, user, 'EX', 3600);
  }
  return user;
}
```

## 二、常见问题与解决

### 缓存穿透

大量请求查询不存在的数据，绕过缓存直达数据库。解决方案包括布隆过滤器和空值缓存。

### 缓存雪崩

大量缓存同时过期导致数据库压力激增。可通过随机过期时间和多级缓存来缓解。

## 三、数据一致性

双写一致性是缓存系统的核心挑战。推荐使用「先更新数据库，再删除缓存」配合消息队列重试的方案。
