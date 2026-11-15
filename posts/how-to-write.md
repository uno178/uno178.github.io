---
title: 这个博客怎么用（写作说明）
date: 2026-11-12
excerpt: 一分钟学会：新建 md、写 front matter、跑 build.js、部署。
tags: 说明
---

# 写作流程

## 1. 新建文章

在 `posts/` 里建一个 `.md` 文件，文件名就是网址，比如：

```
posts/my-first-post.md   →   你的域名/blog/my-first-post.html
```

## 2. 开头写 front matter

```
---
title: 文章标题
date: 2026-11-14
excerpt: 列表页显示的一句话摘要
tags: 标签1, 标签2
---
```

## 3. 正文用 Markdown

支持这些写法：

- **加粗** → `**加粗**`
- *斜体* → `*斜体*`
- [链接](https://example.com) → `[链接](url)`
- 行内代码 → `` `代码` ``
- 列表、引用、分割线、代码块

代码块：

```js
console.log('hello')
```

## 4. 生成

```bash
node build.js
```

然后 `site/` 目录里就是完整的网站。

## 5. 部署

把 `site/` 里的**所有文件**传到 GitHub Pages / Cloudflare Pages 就行。

> 记得改 `build.js` 顶部的 `SITE` 配置：标题、作者、链接。
