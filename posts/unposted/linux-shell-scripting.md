---
title: Linux Shell 脚本编程实用指南
date: 2025-10-20
category: DevOps
tags: [Linux, Shell, 自动化]
readTime: 8 min
slug: linux-shell-scripting
excerpt: 掌握 Bash 脚本核心语法与常用模式，编写健壮的自动化运维脚本，提升日常工作效率。
---

## 一、Bash 基础

### 变量与字符串

```bash
#!/bin/bash
APP_NAME="my-app"
VERSION=$(cat package.json | jq -r '.version')
echo "Deploying $APP_NAME v$VERSION"
```

### 条件判断

```bash
if [ -f ".env" ]; then
  source .env
else
  echo "Error: .env file not found"
  exit 1
fi
```

## 二、常用模式

### 日志函数

```bash
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting deployment..."
```

### 错误处理

使用 `set -euo pipefail` 让脚本在遇到错误时立即退出，避免静默失败。

## 三、实战案例

自动化数据库备份脚本、日志轮转脚本、批量服务器配置脚本等常见场景。
