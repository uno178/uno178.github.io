# 我的博客

零依赖静态博客。写 Markdown，GitHub Actions 自动构建发布。

## 写文章

在 `posts/` 里新建 `xxx.md`：

```markdown
---
title: 我的标题
date: 2026-11-15
excerpt: 列表页显示的一句话摘要
tags: 随笔
---

正文……
```

提交后，GitHub Actions 会自动构建并发布，约 1 分钟生效。

## 本地预览

```bash
node build.js          # 生成到 site/
node preview.js        # 本地起服务 http://127.0.0.1:8091
```

## 改站点信息

编辑 `build.js` 顶部的 `SITE` 对象：标题、作者、简介、链接。

## 目录

```
build.js            生成器（零依赖）
posts/              文章源文件（Markdown）
assets/style.css    样式
site/               构建产物（不提交也可以）
.github/workflows/  自动部署配置
```
