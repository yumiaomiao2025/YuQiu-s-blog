---
title: Go 并发模式与 Channel 实战
date: 2026-01-15
category: 后端
tags: [Go, 并发, Channel]
readTime: 11 min
slug: go-concurrency-patterns
excerpt: 深入理解 Go 的 goroutine 与 channel 机制，掌握 fan-in/fan-out、worker pool 等经典并发模式。
---

## 一、Goroutine 基础

Goroutine 是 Go 的轻量级线程，由 Go 运行时管理。创建一个 goroutine 的成本极低，通常只需几 KB 的栈空间。

```go
func main() {
    go func() {
        fmt.Println("Hello from goroutine")
    }()
    time.Sleep(time.Second)
}
```

## 二、Channel 通信

Channel 是 goroutine 之间通信的管道，遵循 CSP 模型。

```go
ch := make(chan int, 10)

go func() {
    for i := 0; i < 10; i++ {
        ch <- i
    }
    close(ch)
}()

for v := range ch {
    fmt.Println(v)
}
```

## 三、Worker Pool 模式

Worker Pool 是处理大量任务时最常用的并发模式：

```go
func worker(id int, jobs <-chan int, results chan<- int) {
    for j := range jobs {
        results <- j * 2
    }
}
```
