'use strict';
// BeNeat buddy (the otter from the "Staff Party" design) beside the voting sign-in card:
// eyes follow the mouse anywhere on the page (or the text being typed), it blinks, leans in while you type,
// cheers when you get in, does a little trick each time it is tapped, and now and then on its own.
// The drawing is /img/otter.svg, fetched once and placed inline so its eyes can move.
const Buddy = (() => {
  let svgText = null; let blinkT = null; let ctx = null;
  const load = () => (svgText ? Promise.resolve(svgText)
    : fetch('/img/otter.svg').then((r) => (r.ok ? r.text() : '')).then((t) => { svgText = t; return t; }).catch(() => ''));

  function look(root, px, py) {
    for (const eye of root.querySelectorAll('.bd-eye')) {
      const r = eye.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 160);
      eye.querySelector('.bd-pupil').style.transform = `translate(${(dx / d * 9 * k).toFixed(1)}px,${(dy / d * 8 * k).toFixed(1)}px)`;
    }
  }
  function watchInput(root, el) { // look at the caret: the end of the typed text
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    ctx = ctx || document.createElement('canvas').getContext('2d');
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const w = ctx.measureText(el.value || '').width;
    look(root, r.left + parseFloat(cs.paddingLeft) + Math.min(w, r.width - 30), r.top + r.height / 2);
  }

  /** wrap: element with class "buddy" holding a ".bd-slot" and the form; input: the field to watch */
  async function attach(wrap, input) {
    const slot = wrap.querySelector('.bd-slot');
    const t = await load();
    if (!t || !slot.isConnected) return;
    slot.innerHTML = t;
    const state = () => {
      wrap.classList.toggle('typing', document.activeElement === input);
      wrap.classList.toggle('ready', !!input.value.trim());
    };
    // follow the mouse over the whole page; stop listening once this sign-in screen is gone
    let raf = 0, last = null;
    const follow = (e) => {
      if (!wrap.isConnected) { document.removeEventListener('pointermove', follow); document.removeEventListener('pointerdown', follow); return; }
      last = e; // the mouse always wins; typing moves the eyes to the caret until the mouse moves again
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; look(wrap, last.clientX, last.clientY); });
    };
    document.addEventListener('pointermove', follow, { passive: true });
    document.addEventListener('pointerdown', follow, { passive: true });
    slot.addEventListener('click', () => trick(wrap, slot));
    let typedAt = 0;
    input.addEventListener('input', () => { typedAt = Date.now(); });
    for (const ev of ['focus', 'input', 'click']) input.addEventListener(ev, () => { state(); watchInput(wrap, input); });
    input.addEventListener('blur', () => setTimeout(state, 0));
    state();
    clearTimeout(blinkT);
    const blink = () => {
      if (!wrap.isConnected) return;
      for (const eye of wrap.querySelectorAll('.bd-eye')) { eye.classList.remove('blink'); void eye.getBBox(); eye.classList.add('blink'); }
      blinkT = setTimeout(blink, 2600 + Math.random() * 2600);
    };
    blinkT = setTimeout(blink, 2000);

    // on its own: says hello when the page opens, then a random trick every 6-12 s (not while someone types)
    clearTimeout(idleT);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const idle = () => {
      if (!wrap.isConnected) return;
      if (!document.hidden && Date.now() - typedAt > 4000) {
        const line = Math.random() < 0.35 ? LINES[Math.floor(Math.random() * LINES.length)] : null;
        play(wrap, slot, IDLE[Math.floor(Math.random() * IDLE.length)], { line });
      }
      idleT = setTimeout(idle, 6000 + Math.random() * 6000);
    };
    if (!greeted) { greeted = true; setTimeout(() => wrap.isConnected && play(wrap, slot, 'jump', { line: 'สวัสดีจ้า 👋' }), 900); }
    idleT = setTimeout(idle, 7000 + Math.random() * 4000);
  }

  /* tap the otter: each tap plays the next trick, with a speech bubble and a few floating hearts */
  const TRICKS = ['jump', 'spin', 'sweep', 'wiggle'];
  const IDLE = ['jump', 'sweep', 'wiggle']; // the tricks it does by itself
  const LINES = ['สวัสดีจ้า 👋', 'โหวตให้ชุดที่ชอบเลย!', 'สู้ ๆ นะ ✨', 'อย่าลืมไปถ่ายรูปนะ 📸', 'กวาดคะแนนกันเลย 🧹', 'ขอบคุณที่มาร่วมงาน 💙'];
  let trickN = 0; let bubbleT = null; let idleT = null; let greeted = false;
  function trick(wrap, slot) {
    if (play(wrap, slot, TRICKS[trickN % TRICKS.length], { hearts: true, line: LINES[trickN % LINES.length] })) trickN++;
  }
  function play(wrap, slot, name, { hearts = false, line = null } = {}) {
    if (wrap.classList.contains('acting')) return false;
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!calm) {
      wrap.classList.add('acting', 'act-' + name);
      setTimeout(() => wrap.classList.remove('acting', 'act-' + name), 900);
    }
    if (!calm && hearts) {
      for (let i = 0; i < 5; i++) {
        const h = document.createElement('span');
        h.className = 'bd-heart'; h.textContent = ['❤️', '💙', '✨'][i % 3];
        h.style.left = (30 + Math.random() * 40) + '%';
        h.style.setProperty('--dx', (Math.random() * 60 - 30).toFixed(0) + 'px');
        h.style.animationDelay = (i * 0.08).toFixed(2) + 's';
        slot.append(h); setTimeout(() => h.remove(), 1600);
      }
    }
    if (line) {
      let b = slot.querySelector('.bd-bubble');
      if (!b) { b = document.createElement('span'); b.className = 'bd-bubble'; slot.append(b); }
      b.textContent = line;
      b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
      clearTimeout(bubbleT); bubbleT = setTimeout(() => b.classList.remove('show'), 2200);
    }
    return true;
  }

  /** a short jump with the broom before moving on */
  function cheer(wrap) {
    if (!wrap || !wrap.isConnected || matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
    wrap.classList.add('cheer');
    return new Promise((r) => setTimeout(r, 550));
  }
  return { attach, cheer };
})();
