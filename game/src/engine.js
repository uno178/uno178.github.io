/* ===== 2000年冬 · 引擎 ===== */
(() => {
  const $ = id => document.getElementById(id)
  const stage = $('stage'), frame = $('frame'), bgA = $('bgA'), bgB = $('bgB')
  const charBox = $('charBox'), charImg = $('char')
  const gameUI = $('gameUI'), textbox = $('textbox')
  const speakerEl = $('speaker'), textEl = $('text'), nextEl = $('next')
  const titleScreen = $('titleScreen'), startBtn = $('startBtn')
  const panel = $('panel'), volEl = $('vol'), volTxt = $('volTxt')

  let data = null, idx = 0
  let typing = false, typeTimer = null, fullText = ''
  let bgToggle = false, curBg = '', curChar = '', curBgm = ''
  let bgmEl = null, started = false

  /* ===== 音量 ===== */
  let volume = Number(localStorage.getItem('vn_vol') ?? 70)
  volEl.value = volume; volTxt.textContent = volume
  volEl.oninput = () => {
    volume = Number(volEl.value); volTxt.textContent = volume
    localStorage.setItem('vn_vol', volume)
    if (bgmEl) bgmEl.volume = volume / 100
  }

  /* ===== 背景（居中框 + 白边）===== */
  function fitFrame(w, h) {
    const maxW = innerWidth * 0.94, maxH = innerHeight * 0.92
    const ar = w / h
    let fw = maxW, fh = fw / ar
    if (fh > maxH) { fh = maxH; fw = fh * ar }
    frame.style.width = Math.round(fw) + 'px'
    frame.style.height = Math.round(fh) + 'px'
  }
  /* 背景：预加载 + 序号保证顺序（防止快速点击时图片错乱） */
  const bgImg = {}
  let bgSeq = 0

  function preloadBg() {
    for (const l of data.lines) {
      if (l.type !== 'bg' || bgImg[l.name]) continue
      const im = new Image()
      im.src = `assets/bg/${l.name}.webp`
      bgImg[l.name] = im
    }
  }

  function setBg(name, slow) {
    if (curBg === name) return
    curBg = name
    const seq = ++bgSeq
    const dur = slow ? 4200 : 900
    const url = `assets/bg/${name}.webp`

    const apply = (im) => {
      if (seq !== bgSeq) return                 // 已经有更新的切换，丢弃这次
      if (im && im.naturalWidth) fitFrame(im.naturalWidth, im.naturalHeight)
      const showEl = bgToggle ? bgA : bgB
      const hideEl = bgToggle ? bgB : bgA
      bgToggle = !bgToggle
      showEl.style.transitionDuration = dur + 'ms'
      hideEl.style.transitionDuration = dur + 'ms'
      showEl.style.backgroundImage = `url("${url}")`
      void showEl.offsetWidth                   // 强制回流，确保过渡生效
      showEl.classList.add('on')
      hideEl.classList.remove('on')
    }

    let im = bgImg[name]
    if (!im) { im = new Image(); bgImg[name] = im; im.src = url }
    if (im.complete && im.naturalWidth) { apply(im); return }   // 已缓存，立即切换
    im.addEventListener('load', () => apply(im), { once: true })
    im.addEventListener('error', () => { if (seq === bgSeq) apply(null) }, { once: true })
  }

  addEventListener('resize', () => {
    const im = curBg && bgImg[curBg]
    if (im && im.naturalWidth) fitFrame(im.naturalWidth, im.naturalHeight)
  })

  /* ===== 立绘（半身）===== */
  function setChar(name) {
    if (name === curChar) return
    curChar = name
    if (!name) { charBox.classList.remove('on'); return }
    charImg.src = `assets/char/${name}.webp`
    charBox.classList.add('on')
  }

  /* ===== BGM：预加载 + 交叉淡入（切换不中断） ===== */
  const bgmCache = {}
  let bgmSeq = 0

  function makeAudio(path) {
    const a = new Audio('assets/' + path)
    a.loop = true
    a.preload = 'auto'
    a.volume = 0
    try { a.load() } catch (e2) {}
    bgmCache[path] = a
    return a
  }

  function preloadBgm(firstOnly) {
    const seen = firstOnly ? [data.lines.find(l => l.type === 'bgm')].filter(Boolean) : data.lines
    for (const l of seen) {
      if (l.type !== 'bgm') continue
      const p = data.bgmMap[l.name]
      if (p && !bgmCache[p]) makeAudio(p)
    }
  }

  function playBgm(path) {
    if (!path) { if (bgmEl) { fadeOutStop(bgmEl, 700); bgmEl = null } curBgm = ''; return }
    if (curBgm === path) { if (bgmEl && bgmEl.paused) bgmEl.play().catch(() => {}); return }

    const seq = ++bgmSeq
    curBgm = path
    const old = bgmEl
    const a = bgmCache[path] || makeAudio(path)

    let fired = false
    const start = () => {
      if (fired) return
      fired = true
      if (seq !== bgmSeq) return          // 已有更新的请求，直接丢弃（不要 pause，会误伤同一个 Audio）
      try { a.currentTime = 0 } catch (e2) {}
      a.volume = 0
      a.play().catch(() => {})
      fadeTo(a, volume / 100, 900)
      if (old && old !== a) fadeOutStop(old, 900)   // 旧曲同时淡出 → 无缝交叉
      bgmEl = a
    }

    if (a.readyState >= 3) start()
    else a.addEventListener('canplay', start, { once: true })
    // 加载失败就保持旧曲继续播，绝不出现空白
  }

  function fadeTo(a, target, ms) {
    const from = a.volume, t0 = performance.now()
    const step = t => {
      const k = Math.min(1, (t - t0) / ms)
      a.volume = Math.max(0, Math.min(1, from + (target - from) * k))
      if (k < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }
  function fadeOutStop(a, ms) {
    const from = a.volume, t0 = performance.now()
    const step = t => {
      const k = Math.min(1, (t - t0) / (ms || 700))
      a.volume = from * (1 - k)
      if (k < 1) requestAnimationFrame(step)
      else { try { a.pause() } catch (e2) {} }
    }
    requestAnimationFrame(step)
  }

  /* ===== 文本 ===== */
  function showLine(line) {
    if (line.type === 'say') {
      const ch = data.characters[line.who] || { font: 'sans' }
      speakerEl.textContent = line.who
      speakerEl.className = ch.font === 'serif' ? 'serif' : ''
      textEl.className = ch.font === 'serif' ? 'serif' : 'sans'
      typeText(line.text)
    } else {
      speakerEl.textContent = ''
      speakerEl.className = ''
      textEl.className = 'narr'
      typeText(line.text)
    }
  }
  function typeText(s) {
    clearInterval(typeTimer)
    fullText = s; typing = true
    textEl.textContent = ''
    nextEl.classList.remove('on')
    let i = 0
    typeTimer = setInterval(() => {
      i++
      textEl.textContent = s.slice(0, i)
      if (i >= s.length) finishTyping()
    }, 32)
  }
  function finishTyping() {
    clearInterval(typeTimer)
    typing = false
    textEl.textContent = fullText
    nextEl.classList.add('on')
  }

  /* ===== 推进 ===== */
  function advance() {
    if (!started) return
    if (typing) { finishTyping(); return }
    idx++
    run()
  }
  function run() {
    while (idx < data.lines.length) {
      const l = data.lines[idx]
      if (l.type === 'bg') { setBg(l.name, l.slow); idx++; continue }
      if (l.type === 'show') { setChar(l.name); idx++; continue }
      if (l.type === 'hide') { setChar(''); idx++; continue }
      if (l.type === 'bgm') { playBgm(data.bgmMap[l.name]); idx++; continue }
      if (l.type === 'say' || l.type === 'text') { showLine(l); return }
      idx++
    }
    // —— 结局：音乐继续，进入鸣谢 ——
    clearInterval(typeTimer); typing = false
    speakerEl.textContent = ''; speakerEl.className = ''
    textEl.textContent = ''
    nextEl.classList.remove('on')
    charBox.classList.remove('on')
    gameUI.classList.remove('on')
    showCredits()
  }

  /* ===== 鸣谢页 ===== */
  const creditsEl = $('credits')
  function showCredits() {
    const songs = (data.credits || []).map(c =>
      `<div class="song">${c.name}<br><small>${c.author || ''}</small></div>`).join('')
    creditsEl.innerHTML = `
      <div class="inner">
        <h2>${data.title}</h2>
        <div class="role">制作 · 脚本</div>
        <div class="name">${data.author || ''}</div>
        <div class="role" style="margin-top:40px">BGM</div>
        ${songs}
        <div class="end">— 感 谢 游 玩 —</div>
        <button class="btn" id="btnBackTitle2">返 回 标 题</button>
      </div>`
    creditsEl.classList.add('on')
    $('btnBackTitle2').onclick = (ev) => { ev.stopPropagation(); backToTitle() }
  }

  /* ===== 开始 ===== */
  function startGame() {
    started = true
    titleScreen.classList.add('off')
    gameUI.classList.add('on')
    const q = new URLSearchParams(location.search).get('line')
    idx = q !== null ? Math.max(0, Math.min(Number(q) || 0, data.lines.length)) : 0
    curBg = ''; curChar = ''; curBgm = ''
    // 抢先找第一个 BGM，让音乐立刻响起
    const firstBgm = data.lines.find(l => l.type === 'bgm')
    if (firstBgm) playBgm(data.bgmMap[firstBgm.name])
    run()
  }
  startBtn.onclick = startGame
  textbox.onclick = advance
  document.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance() }
    if (e.key === 'Escape') panel.classList.contains('on') ? closePanel() : openPanel()
  })

  function openPanel() { panel.classList.add('on') }
  function closePanel() { panel.classList.remove('on') }
  $('btnPanel').onclick = openPanel
  $('btnClose').onclick = closePanel
  function backToTitle() {
    closePanel(); started = false
    if (creditsEl) creditsEl.classList.remove('on')
    titleScreen.classList.remove('off'); gameUI.classList.remove('on')
    charBox.classList.remove('on')
    if (bgmEl) { try { bgmEl.pause() } catch {} bgmEl = null; curBgm = '' }
    curBg = ''
  }
  $('btnTitle').onclick = backToTitle

  /* ===== 离开页面时必定停音频 ===== */
  function stopAudio() {
    for (const p in bgmCache) { try { bgmCache[p].pause(); bgmCache[p].currentTime = 0 } catch (e) {} }
    if (bgmEl) { try { bgmEl.pause(); bgmEl.currentTime = 0 } catch (e) {} }
    bgmEl = null; curBgm = ''
  }
  addEventListener('pagehide', stopAudio)
  addEventListener('beforeunload', stopAudio)
  // bfcache 恢复（前进/后退回来）时也确保是静音状态
  addEventListener('pageshow', ev => { if (ev.persisted) stopAudio() })
  // 切到后台自动暂停，回来继续
  document.addEventListener('visibilitychange', () => {
    if (!bgmEl) return
    if (document.hidden) { try { bgmEl.pause() } catch (e) {} }
    else if (started && curBgm) { bgmEl.play().catch(() => {}) }
  })

  /* ===== 雪 ===== */
  ;(function snow() {
    const box = $('snow')
    for (let i = 0; i < 95; i++) {
      const f = document.createElement('div')
      f.className = 'flake'
      const s = 1 + Math.random() * 2.4
      f.style.width = s + 'px'; f.style.height = s + 'px'
      f.style.left = Math.random() * 100 + '%'
      f.style.animationDuration = (8 + Math.random() * 10) + 's'
      f.style.animationDelay = (-Math.random() * 14) + 's'
      f.style.opacity = 0.55 + Math.random() * 0.45
      box.append(f)
    }
  })()

  /* ===== 调试面板（只有 ?debug=1 才显示） ===== */
  const DBG = new URLSearchParams(location.search).has('debug')
  if (DBG) {
    const d = document.createElement('div')
    d.id = '__DBG__'
    d.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;background:rgba(0,0,0,.8);color:#0f0;font:11px/1.5 monospace;padding:6px 8px;white-space:pre;pointer-events:none'
    document.body.appendChild(d)
    setInterval(() => {
      const a = bgmEl
      d.textContent = [
        'bgm: ' + (curBgm || '-'),
        'el: ' + (a ? 'yes' : 'no'),
        'readyState: ' + (a ? a.readyState : '-'),
        'paused: ' + (a ? a.paused : '-'),
        't: ' + (a ? a.currentTime.toFixed(1) : '-'),
        'vol: ' + (a ? a.volume.toFixed(2) : '-'),
        'started: ' + started,
      ].join('\n')
    }, 400)
  }

  /* ===== 启动 ===== */
  fetch('script.json').then(r => r.json()).then(d => {
    data = d
    document.title = d.title
    $('topTitle').textContent = d.title
    // 标题页背景 = 图片1
    titleScreen.style.backgroundImage = `url("assets/bg/图片1.webp")`
    // 预加载所有背景（一共不到 500KB，一次性载入）
    preloadBg()
    preloadBgm(true)                       // 先把第一首准备好
    setTimeout(() => preloadBgm(false), 5000)  // 其余几首慢慢下
  })
})()
