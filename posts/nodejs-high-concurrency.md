---
title: Node.js 高并发架构设计与实践
date: 2026-02-10
category: 后端
tags: [Node.js, 架构, 高并发]
readTime: 15 min
slug: nodejs-high-concurrency
excerpt: 探讨 Node.js 在高并发场景下的架构设计模式，包括集群模式、负载均衡、消息队列以及数据库连接池优化策略。
---

## 一、Node.js 的并发模型

Node.js 基于单线程事件循环，通过非阻塞 I/O 实现高并发。但单线程意味着 CPU 密集型任务会阻塞事件循环。理解这个特性是架构设计的基础。

```ts
import cluster from 'node:cluster';
import { cpus } from 'node:os';
import { createServer } from 'node:http';

if (cluster.isPrimary) {
  const numCPUs = cpus().length;
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died, restarting...`);
    cluster.fork();
  });
} else {
  createServer((req, res) => {
    res.end('Hello from worker ' + process.pid);
  }).listen(3000);
}
```

## 二、连接池优化

数据库连接是高并发系统的瓶颈之一。合理配置连接池参数至关重要：

```ts
import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  database: 'blog',
  max: 20,              // 最大连接数
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function query(sql: string, params?: unknown[]) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}
```

## 三、消息队列解耦

对于耗时操作（邮件发送、图片处理等），使用消息队列将请求和处理解耦：

1. API 接收请求后，将任务推入队列，立即返回
2. 消费者进程从队列取出任务，异步处理
3. 处理完成后通过 WebSocket 或轮询通知前端

这种模式让 API 服务保持高响应，不会被慢操作拖垮。
