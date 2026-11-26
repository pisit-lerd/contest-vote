'use strict';
// Projector screen. Full re-render only when the view changes; live numbers are patched in place
// so bar transitions and the counter animation run smoothly.

let state = null;
let sig = '';
let lastVoters = null;
let lastStep = null; // null until first draw, so a reload at step 3 doesn't replay confetti

const fsBtn = $('#fs');
const toggleFs = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
fsBtn.addEventListener('click', toggleFs);
document.addEventListener('keydown', (e) => { if (e.key === 'f' || e.key === 'F') toggleFs(); });
// both corner buttons step aside in full screen, so the projector shows only the stage
document.addEventListener('fullscreenchange', () => { fsBtn.hidden = $('#home').hidden = !!document.fullscreenElement; });

// the stream when it delivers; otherwise the snapshot every 2 s (live bars stay close to real time)
liveStream('/api/screen/stream', (data) => {
  noteServerTime(data.now); noteTopics(data.topics);
  state = data; draw();
  // cheers belong to the intro only: leaving it clears whatever is still floating
  if (data.screen.mode !== 'intro') { cheerBox.replaceChildren(); textQueue.length = 0; return; }
  if (data.cheers) { hideCheers(data.cheers.hidden); showCheers(data.cheers.items); }
}, (ok) => { $('#conn').hidden = ok; }, { pollMs: 2000, events: { cheers: showCheers } });

/* ---------- cheers: emoji rise on the right, text slides across in lanes ---------- */
// The same cheer can arrive twice (stream push, then inside a later snapshot): ids keep it once.
const cheerSeen = new Set();
const cheerGone = new Set();
const CHEER_MAX_EMOJI = 40, CHEER_MAX_TEXT = 8, CHEER_LANES = 6;
const laneFreeAt = Array(CHEER_LANES).fill(0);
const textQueue = [];
const cheerBox = $('#cheers');
function showCheers(items) {
  if (!state || state.screen.mode !== 'intro') return;
  for (const c of items || []) {
    if (cheerSeen.has(c.id) || cheerGone.has(c.id)) continue;
    cheerSeen.add(c.id);
    if (c.k === 'e') floatEmoji(c.v); else { textQueue.push(c); if (textQueue.length > 20) textQueue.shift(); }
  }
  if (cheerSeen.size > 3000) cheerSeen.clear();
  pumpText();
}
function hideCheers(ids) {
  for (const id of ids || []) {
    if (cheerGone.has(id)) continue;
    cheerGone.add(id);
    const el = cheerBox.querySelector(`[data-id="${id}"]`); if (el) el.remove();
    const q = textQueue.findIndex((c) => c.id === id); if (q >= 0) textQueue.splice(q, 1);
  }
}
function floatEmoji(v) {
  if (cheerBox.childElementCount - cheerBox.querySelectorAll('.ch-t').length >= CHEER_MAX_EMOJI) return;
  const el = document.createElement('span');
  el.className = 'ch-e'; el.textContent = v;
  el.style.left = 80 + Math.random() * 15 + 'vw';
  el.style.setProperty('--dx', (Math.random() * 10 - 5).toFixed(1) + 'vw');
  el.style.animationDuration = (2.8 + Math.random() * 1.2).toFixed(2) + 's';
  el.addEventListener('animationend', () => el.remove());
  cheerBox.append(el);
}
function pumpText() {
  while (textQueue.length && cheerBox.querySelectorAll('.ch-t').length < CHEER_MAX_TEXT) {
    const now = Date.now();
    const lane = laneFreeAt.indexOf(Math.min(...laneFreeAt));
    if (laneFreeAt[lane] > now) { setTimeout(pumpText, laneFreeAt[lane] - now + 20); return; }
    const c = textQueue.shift();
    const el = document.createElement('span');
    el.className = 'ch-t'; el.dataset.id = c.id; el.textContent = c.v; // text only, never markup
    el.style.top = 14 + lane * 11 + 'vh';
    el.addEventListener('animationend', () => { el.remove(); pumpText(); });
    cheerBox.append(el);
    // the next one in this lane starts once this one's tail is on screen plus a gap
    const w = el.offsetWidth, speed = (innerWidth + w) / 11000; // px per ms (11 s crossing)
    laneFreeAt[lane] = now + (w + innerWidth * 0.06) / speed;
  }
}

// the server always encodes its own vote link; ?u= only makes the image reload when that link changes
const qrSrc = () => '/api/qr.svg?u=' + encodeURIComponent(state.voteUrl);
const qrPanel = () => `<aside class="qr-panel"><img src="${qrSrc()}" alt="QR สำหรับเข้าโหวต"><span class="lbl">สแกนเพื่อโหวต</span><span class="url">${esc(state.voteUrl)}</span></aside>`;

function draw() {
  const s = state.screen;
  const topic = state.topics.find((t) => t.id === s.topicId) || null;
  const newSig = JSON.stringify([state.event.name, state.voteUrl, !!state.entries?.open, !!state.entries?.auto, !!state.entries?.live, s.topicId, s.mode, s.revealStep, s.intro, topic && topic.status, topic && topic.closesAt, topic && topic.contestants, !topic && state.topics.map((t) => [t.title, t.status, t.closesAt])]);
  if (newSig !== sig) {
    sig = newSig;
    const el = $('#stage');
    if (s.mode === 'intro' && s.intro) el.innerHTML = intro(s.intro);
    else if (!topic) el.innerHTML = lobby();
    else if (s.mode === 'reveal' && topic.status === 'closed') el.innerHTML = reveal(topic, s);
    else if (s.mode === 'live') el.innerHTML = live(topic);
    else el.innerHTML = hidden(topic);
    if (s.mode === 'reveal' && s.revealStep === 3 && lastStep !== null && lastStep !== 3) confetti();
    lastStep = s.mode === 'reveal' ? s.revealStep : 0;
    lastVoters = null;
  }
  patch(topic, s);
  hype(s.mode === 'hidden' && !!topic && topic.status === 'open');
}

/* hidden scores while voting is open: the boxes swap places every few seconds to the Avengers theme, so the room
   feels the ranking moving without seeing it. The order is random on this page only, never the real counts. */
const HYPE_SRC = '/sounds/avengers.mp3', SHUFFLE_MS = 2600;
let hypeOn = false, hypeEl = null, shuffleT = null, duckUntil = 0;
// the screen's own speaker button: on by default, remembered on this computer, separate from the guest pages'
// speaker (switching sound off on the landing page must not silence the projector). It covers the shuffle music and
// the countdown sounds.
let screenMuted = false;
try { screenMuted = localStorage.getItem('cv_screen_snd_off') === '1'; } catch { /* storage blocked */ }
Bgm.muteWhen(() => screenMuted);
const sndBtn = $('#snd');
function paintSnd() {
  sndBtn.setAttribute('aria-pressed', String(!screenMuted));
  sndBtn.setAttribute('aria-label', screenMuted ? 'เปิดเสียง' : 'ปิดเสียง');
}
paintSnd();
sndBtn.addEventListener('click', () => {
  screenMuted = !screenMuted;
  try { localStorage.setItem('cv_screen_snd_off', screenMuted ? '1' : '0'); } catch { /* storage blocked */ }
  paintSnd();
  if (screenMuted) { hypeEl?.pause(); if (hypeOn) hypeState('muted'); } else hypePlay();
});
function hype(on) {
  if (on === hypeOn) return;
  hypeOn = on;
  clearInterval(shuffleT); shuffleT = null;
  if (on) {
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) shuffleT = setInterval(shuffleCards, SHUFFLE_MS);
    if (!hypeEl) { hypeEl = new Audio(HYPE_SRC); hypeEl.loop = true; hypeEl.volume = 0.7; hypeEl.preload = 'auto'; }
    hypePlay();
  } else { hypeEl?.pause(); hypeState('off'); }
}
// on the screen: a small "tap for sound" pill while the browser holds the music back
function hypeState(st) {
  document.body.dataset.hype = st;
  let pill = document.getElementById('hypeHint');
  if (st === 'blocked' && !pill) {
    pill = document.createElement('button');
    pill.id = 'hypeHint'; pill.type = 'button'; pill.className = 'hype-hint';
    pill.textContent = '🔇 แตะหน้าจอเพื่อเปิดเสียง';
    document.body.append(pill);
  }
  if (pill) pill.hidden = st !== 'blocked';
}
// browsers play only after a tap or key on the page ("เต็มจอ" or F): try again then
function hypePlay() {
  if (!hypeOn || !hypeEl || !hypeEl.paused || Date.now() < duckUntil || document.hidden) return;
  if (screenMuted) { hypeState('muted'); return; }
  hypeEl.play().then(() => hypeState('playing'), (e) => hypeState(e && e.name === 'NotAllowedError' ? 'blocked' : 'error'));
}
for (const ev of ['click', 'keydown', 'touchend']) document.addEventListener(ev, hypePlay, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) hypeEl?.pause(); else hypePlay(); });
// the one-minute and time's-up sounds get the room to themselves
document.addEventListener('cv-duck', (e) => {
  duckUntil = Date.now() + (e.detail || 0);
  hypeEl?.pause();
  setTimeout(hypePlay, (e.detail || 0) + 50);
});
// each round a few pairs of boxes clash: both rush to the middle, hit with a 💥, bounce off and land in each other's place
function shuffleCards() {
  const grid = document.querySelector('.c-grid');
  if (!grid || document.hidden) return;
  const cards = [...grid.children].filter((c) => c.classList.contains('c-card'));
  if (cards.length === 1) return soloHype(grid, cards[0]);
  if (cards.length < 2) return;
  const pool = cards.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const pairs = [];
  const want = Math.max(1, Math.min(3, Math.floor(cards.length / 3)));
  while (pairs.length < want && pool.length >= 2) pairs.push([pool.pop(), pool.pop()]);
  const box = grid.getBoundingClientRect();
  for (const [x, y] of pairs) {
    const ra = x.getBoundingClientRect(), rb = y.getBoundingClientRect();
    swapNodes(x, y);
    const na = x.getBoundingClientRect(), nb = y.getBoundingClientRect();
    clash(x, ra, na, rb, -1); clash(y, rb, nb, ra, 1);
    // the burst where they meet
    const fx = document.createElement('span');
    fx.className = 'clash-fx'; fx.textContent = '💥';
    fx.style.left = ((ra.left + ra.width / 2 + rb.left + rb.width / 2) / 2 - box.left) + 'px';
    fx.style.top = ((ra.top + ra.height / 2 + rb.top + rb.height / 2) / 2 - box.top) + 'px';
    grid.append(fx); setTimeout(() => fx.remove(), 1000);
  }
}
// only one contestant: nobody to clash with, so the box powers up on the beat instead (jump, wiggle, glow, sparkles)
function soloHype(grid, card) {
  card.animate([
    { transform: 'none' },
    { transform: 'translateY(-7%) scale(1.07) rotate(-3deg)', offset: 0.25, easing: 'cubic-bezier(.2,.8,.4,1)' },
    { transform: 'translateY(0) scale(.97) rotate(2.5deg)', offset: 0.5 },
    { transform: 'translateY(-3%) scale(1.03) rotate(-1.5deg)', offset: 0.7 },
    { transform: 'none' },
  ], { duration: 1100, easing: 'ease-out' });
  card.classList.remove('solo-glow'); void card.offsetWidth; card.classList.add('solo-glow');
  const box = grid.getBoundingClientRect(), r = card.getBoundingClientRect();
  ['✨', '⭐', '✨'].forEach((ch, i) => {
    const fx = document.createElement('span');
    fx.className = 'solo-fx'; fx.textContent = ch;
    const a = (-60 + i * 60 + (Math.random() * 30 - 15)) * Math.PI / 180; // above the box, fanned out
    fx.style.left = (r.left - box.left + r.width / 2 + Math.sin(a) * r.width * 0.42) + 'px';
    fx.style.top = (r.top - box.top + r.height * 0.32 - Math.cos(a) * r.height * 0.22) + 'px';
    fx.style.animationDelay = (0.12 + i * 0.1) + 's';
    grid.append(fx); setTimeout(() => fx.remove(), 1500);
  });
}
function swapNodes(a, b) {
  const mark = document.createComment('');
  a.replaceWith(mark); b.replaceWith(a); mark.replaceWith(b);
}
// from its old place (from) to its new one (to), by way of the point where it meets the other box (other)
function clash(el, from, to, other, side) {
  const cx = (r) => r.left + r.width / 2, cy = (r) => r.top + r.height / 2;
  const midX = (cx(from) + cx(other)) / 2, midY = (cy(from) + cy(other)) / 2;
  // stop a little short of the middle so the two boxes touch instead of overlapping
  const hitX = midX + (cx(from) - midX) * 0.35 - cx(to), hitY = midY + (cy(from) - midY) * 0.35 - cy(to);
  const sx = cx(from) - cx(to), sy = cy(from) - cy(to);
  const t = (x, y, extra = '') => `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) ${extra}`;
  el.animate([
    { transform: t(sx, sy), zIndex: 3 },
    { transform: t(hitX, hitY, `scale(1.12) rotate(${side * 5}deg)`), zIndex: 3, offset: 0.38, easing: 'cubic-bezier(.6,0,.9,.4)' },
    { transform: t(hitX * 1.15, hitY * 1.15, `scale(.94) rotate(${-side * 8}deg)`), zIndex: 3, offset: 0.48 },
    { transform: t(hitX * 0.9, hitY * 0.9, `scale(1.06) rotate(${side * 4}deg)`), zIndex: 3, offset: 0.56 },
    { transform: 'none', zIndex: 3 },
  ], { duration: 1100, easing: 'cubic-bezier(.3,.9,.4,1.15)' });
}

function header(topic) {
  const sub = topic.status === 'open' ? 'เปิดโหวตอยู่' : topic.status === 'closed' ? 'ปิดโหวตแล้ว' : 'ยังไม่เปิดโหวต';
  const rule = topic.maxVotes > 1 ? ` · เลือกได้ ${topic.maxVotes} คน` : '';
  const clock = topic.status === 'open' && topic.closesAt
    ? `<p class="s-clock"><span>ปิดโหวตใน</span><b data-deadline="${topic.closesAt}" data-done="หมดเวลา">${fmtLeft(topic.closesAt - serverNow())}</b></p>` : '';
  return `<header><p class="s-event">${esc(state.event.name)}</p><div class="s-head"><h1 class="s-title">${esc(topic.title)}</h1>${clock || `<p class="s-sub">${sub}${rule}</p>`}</div></header>`;
}

function lobby() {
  const open = state.topics.filter((t) => t.status === 'open');
  return `<div class="lobby">
    <img class="qr-big" src="${qrSrc()}" alt="QR สำหรับเข้าโหวต">
    <div><h1>${esc(state.event.name)}</h1>
      <p class="scan">สแกน QR เพื่อเข้าร่วม</p><p class="url">${esc(state.voteUrl)}</p>
      ${open.length ? `<ul>${open.map((t) => `<li>${esc(t.title)}${t.closesAt ? ` · <b data-deadline="${t.closesAt}" data-done="หมดเวลา">${fmtLeft(t.closesAt - serverNow())}</b>` : ''}</li>`).join('')}</ul>` : ''}
      ${state.entries?.open ? entryHowTo() : ''}
    </div></div>`;
}

// how to enter the costume contest from the landing page; shown while the admin has entries open
function entryHowTo() {
  return `<section class="howto">
    <h2>ส่งประกวดชุด <span>(Best Costume)</span></h2>
    <p class="howto-sub">ถ่ายจากตู้หรือถ่ายจากมือถือผู้ที่สนใจประกวดได้</p>
    <ol>
      <li>กด “ส่งประกวดชุด” ยืนให้เต็มกรอบ แล้วกดปุ่ม “กดถ่าย” ระบบนับถอยหลัง 5 วินาที</li>
      <li>ชอบรูปแล้วกดบันทึก จากนั้นกรอก ชื่อ / แผนก / Concept ชุด</li>
      <li>${!state.entries.auto ? 'รูปจะขึ้นบน Live Score เมื่อแอดมินอนุมัติ' : state.entries.live ? 'รูปจะขึ้นบน Live Score ทันที' : 'รูปจะขึ้นบน Live Score เมื่อเปิดโหวต'}</li>
    </ol>
  </section>`;
}

function hidden(topic) {
  return header(topic) + `<div class="s-body"><div class="s-main">
    <div class="counter"><span class="n" id="voters">0</span><span class="t">คนโหวตแล้ว</span></div>
    ${topic.contestants.length ? `<div class="c-grid${topic.contestants.length <= 3 ? ' few' : ''}" style="--cols:${gridCols(topic.contestants.length)};--n:${topic.contestants.length}">${topic.contestants.map((c) => `<div class="c-card">
      ${c.photo ? `<img class="ph" src="${esc(c.photo)}" alt="">` : `<div class="photo-ph">${esc(c.number)}</div>`}
      <span class="nm"><span class="no">${esc(c.number)}</span> ${esc(c.name)}</span></div>`).join('')}</div>` : '<p class="empty-stage">ยังไม่มีผู้เข้าประกวด</p>'}
    </div>${qrPanel()}</div>`;
}

// one contestant at a time while they walk on stage; the admin moves next / back
function intro(it) {
  const c = it.shown[it.index];
  const strip = Array.from({ length: it.total }, (_, i) => {
    const p = it.shown[i];
    const cls = i === it.index ? 'now' : p ? 'done' : 'next';
    return `<li class="${cls}">${p ? (p.photo ? `<img src="${esc(p.photo)}" alt="">` : `<span>${esc(p.number)}</span>`) : ''}</li>`;
  }).join('');
  return `<header class="compact"><p class="s-event">${esc(state.event.name)}</p><div class="s-head"><h1 class="s-title">${esc(it.title)}</h1>
      <p class="s-sub nowrap">แนะนำผู้เข้าประกวด · คนที่ ${it.index + 1} จาก ${it.total}</p></div></header>
    <div class="intro ${c.photo ? '' : 'no-photo'}" data-i="${it.index}">
      <div class="i-info"><span class="i-lbl">หมายเลข</span><span class="i-no">${esc(c.number)}</span><span class="i-name">${esc(c.name)}</span>
        <ol class="i-strip" aria-hidden="true">${strip}</ol></div>
      ${c.photo ? `<img class="i-photo" src="${esc(c.photo)}" alt="">` : ''}
    </div>`;
}

const gridCols = (n) => (n <= 5 ? 5 : n <= 12 ? 6 : n <= 21 ? 7 : 10);

// live scores as a ranking: 1st large, 2nd and 3rd beside it, everyone else as a numbered list.
// The page re-sorts from the counts on every update (ties share a place; nobody is placed on 0 votes).
function live(topic) {
  rankSig = '';
  return header(topic) + `<div class="rank" id="rank"></div>`;
}
let rankSig = '';
const fmtN = (n) => n.toLocaleString('th-TH');
function rankHtml(topic, counts, voters) {
  const list = topic.contestants.map((c) => ({ ...c, n: counts[c.id] || 0 }))
    .sort((a, b) => b.n - a.n || (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0) || String(a.number).localeCompare(String(b.number)));
  if (!list.length) return '<p class="empty-stage">ยังไม่มีผู้เข้าประกวด</p>';
  const max = Math.max(1, list[0].n);
  list.forEach((c) => { c.place = c.n ? 1 + list.filter((o) => o.n > c.n).length : 0; });
  const pic = (c) => (c.photo ? `<img src="${esc(c.photo)}" alt="">` : `<span class="rk-ph">${esc(c.number)}</span>`);
  const badge = (c) => `<span class="rk-badge">${c.place || '–'}</span>`;
  const card = (c, i) => `<article class="rk-card rk-${i + 1}${c.place === 1 ? ' lead' : ''}" data-id="${c.id}">
      <div class="rk-photo">${pic(c)}${badge(c)}</div>
      <div class="rk-info"><span class="rk-name"><b>${esc(c.number)}</b> ${esc(c.name)}</span>
        <span class="rk-votes"><b>${fmtN(c.n)}</b> คะแนน</span></div>
      <div class="rk-track"><i style="width:${(c.n / max) * 100}%"></i></div></article>`;
  const top = list.slice(0, 3), rest = list.slice(3);
  return `<div class="rk-first">${card(top[0], 0)}</div>
    <div class="rk-pair">${top.slice(1).map((c, i) => card(c, i + 1)).join('')}</div>
    <div class="rk-side">
      <div class="rk-count"><span class="n" id="voters">${fmtN(voters || 0)}</span><span class="t">คนโหวตแล้ว</span></div>
      ${rest.length ? `<ol class="rk-list${rest.length > 7 ? ' two' : ''}" style="--rows:${rest.length > 7 ? Math.ceil(rest.length / 2) : rest.length}">${rest.map((c) => `<li data-id="${c.id}"><span class="rk-pos">${c.place || '–'}</span>
        <span class="rk-mini">${pic(c)}</span><span class="nm"><b>${esc(c.number)}</b> ${esc(c.name)}</span><span class="v">${fmtN(c.n)}</span></li>`).join('')}</ol>` : '<div class="rk-list-empty"></div>'}
      <aside class="rk-qr"><img src="${qrSrc()}" alt="QR สำหรับเข้าโหวต"><span><b>สแกนเพื่อโหวต</b>${esc(state.voteUrl)}</span></aside>
    </div>`;
}

function reveal(topic, s) {
  const podium = s.podium || [];
  const size = s.podiumSize ?? 3;
  const slot = (place) => {
    const shown = podium.find((p) => p.place === place);
    const revealedYet = place > 3 - s.revealStep;
    let inner;
    if (shown) {
      inner = `<div class="ppl">${shown.winners.map((w) => `<div class="person">${photoHtml(w, 160)}<span class="pname">${esc(w.number)} · ${esc(w.name)}</span></div>`).join('')}</div>
        <span class="pvotes">${shown.votes} คะแนน${shown.winners.length > 1 ? ' · คะแนนเท่ากัน' : ''}</span>`;
    } else if (revealedYet || place > size) {
      inner = revealedYet ? '<span class="q">—</span><span class="pvotes">ไม่มีผู้ได้อันดับนี้</span>' : '<span class="q">?</span>';
    } else inner = '<span class="q">?</span>';
    const many = shown && shown.winners.length > 1 ? 'many' : '';
    const anim = revealedYet && place === 4 - s.revealStep ? 'pop' : '';
    const waiting = !revealedYet ? 'waiting' : '';
    return `<div class="place p${place} ${many} ${waiting}"><div class="slot ${anim}">${inner}</div><span class="rank">อันดับ ${place}</span></div>`;
  };
  const drum = s.revealStep === 0 ? '<p class="drum">ผลโหวตกำลังจะประกาศ…</p>' : s.revealStep === 3 ? `<p class="drum">ขอแสดงความยินดี</p>` : '';
  return header(topic) + `<div class="reveal">${drum}<div class="podium">${slot(2)}${slot(1)}${slot(3)}</div></div>`;
}

function patch(topic, s) {
  if (!topic) return;
  const vEl = $('#voters');
  if (vEl && s.voters !== undefined) {
    vEl.textContent = s.voters.toLocaleString('th-TH');
    if (lastVoters !== null && s.voters > lastVoters) { vEl.classList.remove('bump'); void vEl.offsetWidth; vEl.classList.add('bump'); }
    lastVoters = s.voters;
  }
  const rank = $('#rank');
  if (rank && s.mode === 'live' && s.counts) {
    const next = JSON.stringify(s.counts);
    if (next !== rankSig) {
      const before = rankSig ? JSON.parse(rankSig) : null;
      rankSig = next;
      rank.innerHTML = rankHtml(topic, s.counts, s.voters);
      lastVoters = s.voters;
      // whoever just got a vote pulses once
      if (before) for (const el of rank.querySelectorAll('[data-id]')) if ((s.counts[el.dataset.id] || 0) > (before[el.dataset.id] || 0)) el.classList.add('got');
    }
  }
}

function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = $('#confetti');
  const colors = ['#d4a017', '#e8b931', '#b42318', '#fff8f0', '#f97066'];
  box.innerHTML = Array.from({ length: 140 }, () => {
    const d = 2.5 + Math.random() * 2.5;
    return `<i style="left:${Math.random() * 100}vw;background:${colors[Math.floor(Math.random() * colors.length)]};animation-duration:${d}s;animation-delay:${Math.random() * 1.2}s"></i>`;
  }).join('');
  setTimeout(() => { box.innerHTML = ''; }, 6000);
}
