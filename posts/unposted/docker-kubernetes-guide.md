---
title: Docker 与 Kubernetes 实战指南
date: 2026-02-18
category: DevOps
tags: [Docker, K8s, CI/CD]
readTime: 12 min
slug: docker-kubernetes-guide
excerpt: 从容器基础到集群编排，一步步带你构建企业级的容器化部署流程。包含实战案例与常见踩坑总结。
---

## 一、Docker 基础

Docker 是一个开源的容器化平台，它让开发者能够将应用和其依赖打包到一个轻量级、可移植的容器中。与虚拟机不同，容器共享宿主机的操作系统内核，因此启动更快、资源占用更少。

### Dockerfile 最佳实践

```dockerfile
# 多阶段构建 - 减小镜像体积
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 常见踩坑

- 镜像层缓存：把不常变的指令放前面（如 `COPY package*.json`），提升构建速度
- `.dockerignore`：排除 `node_modules`、`.git` 等无关文件
- 非 root 用户：生产环境不要用 root 运行容器

## 二、Kubernetes 核心概念

Kubernetes（K8s）是容器编排的事实标准。它的核心抽象包括：

- **Pod**：最小部署单元，包含一个或多个容器
- **Deployment**：管理 Pod 的副本数和滚动更新
- **Service**：为 Pod 提供稳定的网络入口
- **Ingress**：管理外部 HTTP/HTTPS 路由

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: blog-frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: blog-frontend
  template:
    metadata:
      labels:
        app: blog-frontend
    spec:
      containers:
      - name: blog
        image: yuqiu/blog:latest
        ports:
        - containerPort: 80
```

## 三、CI/CD 自动化流水线

将 Docker 和 K8s 结合 CI/CD，可以实现代码推送后自动构建、测试、部署。一个典型的流水线：

1. 代码推送到 main 分支
2. GitHub Actions 触发构建
3. 运行单元测试和 lint
4. 构建 Docker 镜像并推送到 Registry
5. 更新 K8s Deployment 的镜像版本
6. K8s 自动执行滚动更新
