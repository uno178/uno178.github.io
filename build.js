#!/usr/bin/env node
/**
 * 零依赖静态博客生成器
 *   用法:  node build.js
 *   输入:  posts/*.md   (Markdown + front matter)
 *   输出:  site/        (直接拿去部署)
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const POSTS = path.join(ROOT, 'posts');
const OUT = path.join(ROOT, 'site');

/* ---------------- 站点配置（改这里） ---------------- */
const SITE = {
  title: '长门厶希 的 幻想',
  brand: '𝑵𝒂𝒈𝒂𝒕𝒐 𝑺𝒉𝒊𝒌𝒊’𝒔 𝑭𝒂𝒏𝒕𝒂𝒔𝒚',  // 页头左上角显示
  author: '长门厶希',
  desc: 'ただの人間には興味ありません。この中に宇宙人、未来人、異世界人、超能力者がいたら、あたしのところに来なさい。以上。',
  url: 'https://uno178.github.io',
  links: [
    ['B站', 'https://space.bilibili.com/3546910166092247'],
    ['邮箱', 'mailto:3919212116@qq.com'],
  ],
};

/* ---------------- 游戏清单 ---------------- */
// 以后加游戏：在这里加一项，并把构建产物放进 game/<slug>/
const GAMES = [
  {
    slug: '2000',
    title: '2000年冬',
    desc: '2000年初，我遇到的那位并不存在少女。',
    cover: '/game/2000/assets/bg/图片2.webp',
    tag: '视觉小说 · 横屏游玩',
  },
]

/* ---------------- 工具 ---------------- */
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const pad = n => String(n).padStart(2,'0');
// 静态资源版本号：内容变了 URL 就变，浏览器缓存自动失效
const crypto = require('crypto');
const assetVer = rel => {
  try { return crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex').slice(0, 8); }
  catch { return '0'; }
};
function fmtDate(d){ const t=new Date(d); return `${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`; }

/* ---------------- 极简 Markdown ---------------- */
function md(src){
  const blocks = [];
  // 1) 代码块先抽出来，避免被其它规则破坏
  src = src.replace(/```(\w*)\n([\s\S]*?)```/g, (_,lang,code) => {
    blocks.push(code.replace(/\n$/,''));
    return `\u0000CODE${blocks.length-1}\u0000`;
  });

  const lines = src.split('\n');
  const out = [];
  let i = 0, inList = false, inOl = false;

  const closeList = () => { if(inList){out.push('</ul>');inList=false} if(inOl){out.push('</ol>');inOl=false} };
  // 先把原文的 HTML 特殊字符转义，再套 Markdown 语法
  // —— 这样文章里写 <script> 只会显示成文字，不会被执行
  const inline = raw => String(raw)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  while (i < lines.length) {
    let ln = lines[i];

    if (/^\u0000CODE\d+\u0000$/.test(ln.trim())) {
      closeList();
      const idx = Number(ln.match(/\d+/)[0]);
      out.push(`<pre><code>${esc(blocks[idx])}</code></pre>`);
      i++; continue;
    }
    if (/^\s*$/.test(ln)) { closeList(); i++; continue; }
    if (/^---+\s*$/.test(ln)) { closeList(); out.push('<hr>'); i++; continue; }

    const h = ln.match(/^(#{1,4})\s+(.*)$/);
    if (h) { closeList(); const lv=h[1].length+1; out.push(`<h${lv}>${inline(h[2])}</h${lv}>`); i++; continue; }

    if (/^>\s?/.test(ln)) {
      closeList(); const buf=[];
      while(i<lines.length && /^>\s?/.test(lines[i])){ buf.push(lines[i].replace(/^>\s?/,'')); i++; }
      out.push(`<blockquote><p>${inline(buf.join(' '))}</p></blockquote>`); continue;
    }
    if (/^\s*[-*]\s+/.test(ln)) {
      if(!inList){closeList();out.push('<ul>');inList=true}
      out.push(`<li>${inline(ln.replace(/^\s*[-*]\s+/,''))}</li>`); i++; continue;
    }
    if (/^\s*\d+\.\s+/.test(ln)) {
      if(!inOl){closeList();out.push('<ol>');inOl=true}
      out.push(`<li>${inline(ln.replace(/^\s*\d+\.\s+/,''))}</li>`); i++; continue;
    }
    // 段落：连续非空行合并
    closeList();
    const p=[];
    while(i<lines.length && lines[i].trim() && !/^(#{1,4}\s|>\s?|\s*[-*]\s|\s*\d+\.\s|---)/.test(lines[i]) && !/^\u0000CODE/.test(lines[i])){ p.push(lines[i]); i++; }
    out.push(`<p>${inline(p.join(' '))}</p>`);
  }
  closeList();
  return out.join('\n');
}

/* ---------------- 读取文章 ---------------- */
function readPosts(){
  if(!fs.existsSync(POSTS)) return [];
  return fs.readdirSync(POSTS).filter(f=>f.endsWith('.md')).map(f=>{
    const raw = fs.readFileSync(path.join(POSTS,f),'utf8');
    const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    const fm = {}, body = m ? m[2] : raw;
    if(m) m[1].split('\n').forEach(line=>{
      const mm = line.match(/^(\w+)\s*:\s*(.*)$/);
      if(mm) fm[mm[1]] = mm[2].trim().replace(/^["']|["']$/g,'');
    });
    const slug = fm.slug || f.replace(/\.md$/,'');
    const words = body.replace(/\s/g,'').length;
    return {
      slug,
      title: fm.title || slug,
      date: fm.date || '2026-01-01',
      excerpt: fm.excerpt || body.replace(/[#>*`\-]/g,'').replace(/\s+/g,' ').slice(0,90)+'…',
      tags: fm.tags ? fm.tags.split(',').map(s=>s.trim()).filter(Boolean) : [],
      minutes: Math.max(1, Math.round(words/400)),
      html: md(body),
    };
  }).sort((a,b)=> a.date < b.date ? 1 : -1);
}

/* ---------------- 模板 ---------------- */
const layout = (title, body, extra='', bodyClass='') => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(SITE.desc)}">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="stylesheet" href="/assets/style.css?v=${assetVer('assets/style.css')}">
${extra}
</head>
<body${bodyClass ? ' class="' + bodyClass + '"' : ''}>
<header class="site"><div class="wrap">
  <a class="brand" href="/">${esc(SITE.brand || SITE.title)}</a>
  <nav><a href="/" class="${title===SITE.title?'active':''}">文章</a><a href="/game/">游戏</a></nav>
</div></header>
<main class="wrap">${body}</main>
<footer class="site"><div class="wrap">
  <span>© ${new Date().getFullYear()} ${esc(SITE.author)}</span>
  <span>用 Markdown 写成</span>
</div></footer>
</body></html>`;

const item = p => `<a class="post-item" href="/blog/${p.slug}.html">
  <h3>${esc(p.title)}</h3>
  <div class="meta">${fmtDate(p.date)} · ${p.minutes} 分钟</div>
  <p class="excerpt">${esc(p.excerpt)}</p>
</a>`;

/* ---------------- 游戏列表页 ---------------- */
function gameListPage() {
  const cards = GAMES.map(g =>
    '<a class="gcard" href="/game/' + g.slug + '/">' +
      '<div class="gcover"><img src="' + g.cover + '" alt="' + esc(g.title) + '" loading="lazy"></div>' +
      '<h3 class="gtitle">' + esc(g.title) + '</h3>' +
      '<p class="gmeta">' + esc(g.tag) + '</p>' +
    '</a>').join('\n')
  return layout('游戏', `
    <div class="hero hero-games">
      <h1>游戏</h1>
      <p class="hero-sub">${GAMES.length} 个作品</p>
    </div>
    <div class="games">${cards || '<p style="color:var(--muted)">还没有游戏。</p>'}</div>`, '', 'is-light')
}

/* ---------------- 生成 ---------------- */
function build(){
  const posts = readPosts();
  fs.rmSync(OUT,{recursive:true,force:true});
  fs.mkdirSync(path.join(OUT,'blog'),{recursive:true});
  fs.cpSync(path.join(ROOT,'assets'), path.join(OUT,'assets'), {recursive:true});
  // 游戏（game/<slug>/）+ 游戏列表页
  if (fs.existsSync(path.join(ROOT, 'game'))) {
    fs.cpSync(path.join(ROOT, 'game'), path.join(OUT, 'game'), { recursive: true })
    fs.writeFileSync(path.join(OUT, 'game', 'index.html'), gameListPage())
  }
  // 写作后台也一起发布（页面本身公开，但要 Token 才能写）
  if(fs.existsSync(path.join(ROOT,'admin'))) fs.cpSync(path.join(ROOT,'admin'), path.join(OUT,'admin'), {recursive:true});

  // 首页 = 文章列表
  fs.writeFileSync(path.join(OUT,'index.html'), layout(SITE.title, `
    <div class="hero">
      <img class="avatar" src="/assets/avatar.png?v=${assetVer('assets/avatar.png')}" alt="">
      <h1>${esc(SITE.title)}</h1>
    </div>
    <div class="intro">
      <p class="lead">${esc(SITE.desc)}</p>
      <div class="links">${SITE.links.map(([n,u])=>`<a href="${u}">${esc(n)}</a>`).join('')}</div>
    </div>
    <section><h2>全部文章 · ${posts.length} 篇</h2>
      ${posts.map(item).join('\n') || '<p style="color:var(--muted)">还没有文章，去 posts/ 里新建一个 .md 吧。</p>'}
    </section>`));

  // 每篇文章
  posts.forEach(p=>{
    fs.writeFileSync(path.join(OUT,'blog',`${p.slug}.html`), layout(p.title, `
      <article>
        <a class="back" href="/">← 返回</a>
        <h1>${esc(p.title)}</h1>
        <div class="meta">${fmtDate(p.date)} · ${p.minutes} 分钟阅读${p.tags.length?' · '+p.tags.map(t=>'#'+esc(t)).join(' '):''}</div>
        ${p.html}
      </article>`));
  });

  // RSS
  fs.writeFileSync(path.join(OUT,'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${esc(SITE.title)}</title><link>${SITE.url}</link><description>${esc(SITE.desc)}</description>
${posts.map(p=>`<item><title>${esc(p.title)}</title><link>${SITE.url}/blog/${p.slug}.html</link><pubDate>${new Date(p.date).toUTCString()}</pubDate><description>${esc(p.excerpt)}</description></item>`).join('\n')}
</channel></rss>`);

  console.log(`✅ 生成完成：${posts.length} 篇文章 → site/`);
  posts.forEach(p=>console.log(`   · ${fmtDate(p.date)}  ${p.title}`));
}

build();
