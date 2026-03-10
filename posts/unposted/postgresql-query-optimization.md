---
title: PostgreSQL 查询优化深度指南
date: 2025-11-05
category: 后端
tags: [PostgreSQL, SQL, 性能优化]
readTime: 14 min
slug: postgresql-query-optimization
excerpt: 从执行计划分析到索引策略，掌握 PostgreSQL 查询优化的核心方法论，解决慢查询问题。
---

## 一、EXPLAIN ANALYZE

理解查询执行计划是优化的第一步：

```sql
EXPLAIN ANALYZE
SELECT u.name, COUNT(p.id) as post_count
FROM users u
LEFT JOIN posts p ON p.user_id = u.id
GROUP BY u.name
ORDER BY post_count DESC
LIMIT 10;
```

## 二、索引策略

### B-Tree 索引

最常见的索引类型，适用于等值查询和范围查询。

### GIN 索引

适用于全文搜索和 JSONB 字段查询：

```sql
CREATE INDEX idx_posts_tags ON posts USING GIN (tags);
```

### 部分索引

只索引满足条件的行，减少索引大小：

```sql
CREATE INDEX idx_active_users ON users (email)
WHERE is_active = true;
```

## 三、查询模式优化

避免 SELECT *、减少子查询、合理使用 CTE 和窗口函数。
