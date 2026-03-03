---
title: GitHub Actions 自动化 CI/CD 实战
date: 2026-01-08
category: DevOps
tags: [GitHub Actions, CI/CD, 自动化]
readTime: 8 min
slug: github-actions-cicd
excerpt: 从零搭建基于 GitHub Actions 的 CI/CD 流水线，实现自动测试、构建和部署的完整工作流。
---

## 一、GitHub Actions 基础

GitHub Actions 使用 YAML 文件定义工作流，支持多种触发条件和运行环境。

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test
```

## 二、构建与部署

### 多阶段构建

将测试、构建和部署分为独立的 job，通过 `needs` 关键字定义依赖关系。

### 部署到生产

使用环境保护规则，确保只有通过审批的代码才能部署到生产环境。

## 三、进阶技巧

- 使用 `matrix` 策略并行测试多个 Node.js 版本
- 缓存 `node_modules` 加速构建
- 使用 `secrets` 安全管理密钥
