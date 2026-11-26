// Shared helpers: API calls, escaping, icons (lucide paths), toast, confirm dialog, live stream.
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data; }
}

async function api(method, url, body, headers = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError('เชื่อมต่อไม่ได้ ตรวจสัญญาณอินเทอร์เน็ตแล้วลองอีกครั้ง', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'ระบบขัดข้อง ลองอีกครั้ง', res.status, data);
  return data;
}

// lucide icon paths (ISC license)
const ICONS = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  pencil: '<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronUp: '<path d="m18 15-6-6-6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  alert: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
  printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.83 0L6 21"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  expand: '<path d="m15 15 6 6"/><path d="m15 9 6-6"/><path d="M21 16v5h-5"/><path d="M21 8V3h-5"/><path d="M3 16v5h5"/><path d="m3 21 6-6"/><path d="M3 8V3h5"/><path d="M9 9 3 3"/>',
  wifiOff: '<path d="M12 20h.01"/><path d="M8.5 16.43a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 4.17-2.65"/><path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76"/><path d="M16.85 11.25a10 10 0 0 1 2.22 1.68"/><path d="M5 13a10 10 0 0 1 5.24-2.76"/><line x1="2" x2="22" y1="2" y2="22"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

let toastTimer;
function toast(msg) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.append(el); }
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2500);
}

/**
 * Confirm dialog with outcome-named buttons. Optional typed confirmation.
 * Resolves true if confirmed.
 */
function confirmDialog({ title, body, confirmLabel, cancelLabel = 'ยกเลิก', danger = true, typeToConfirm = null }) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'dlg';
    dlg.innerHTML = `
      <form method="dialog" class="dlg-body">
        <h2 style="font-size:var(--fs-20)">${esc(title)}</h2>
        <p class="muted">${body}</p>
        ${typeToConfirm ? `<div class="field"><label for="dlg-type">พิมพ์ “${esc(typeToConfirm)}” เพื่อยืนยัน</label><input id="dlg-type" class="input" autocomplete="off"></div>` : ''}
        <div class="dlg-actions">
          <button value="cancel" class="btn btn-ghost">${esc(cancelLabel)}</button>
          <button value="ok" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" ${typeToConfirm ? 'disabled' : ''}>${esc(confirmLabel)}</button>
        </div>
      </form>`;
    document.body.append(dlg);
    const okBtn = dlg.querySelector('button[value=ok]');
    const typed = dlg.querySelector('#dlg-type');
    if (typed) typed.addEventListener('input', () => { okBtn.disabled = typed.value.trim() !== typeToConfirm; });
    dlg.addEventListener('close', () => { resolve(dlg.returnValue === 'ok'); dlg.remove(); });
    dlg.showModal();
    (typed || dlg.querySelector('button[value=cancel]')).focus();
  });
}

/*
 * Live data that keeps working when the live stream doesn't.
 * - The snapshot is read once with a plain GET right away, so the page never waits on the stream.
 * - SSE is used when it actually delivers. A proxy that holds the stream back (Cloudflare Quick
 *   Tunnel, buffering proxies) shows up as "no data within a few seconds": the stream is closed so
 *   it doesn't occupy a request slot, and this device stops trying it for a while.
 * - Whenever the stream isn't delivering, the snapshot is asked for every few seconds instead.
 */
const NO_STREAM_KEY = 'cv_nostream_until';
const STREAM_FIRST_MS = 6000;  // stream must deliver its first message within this
const STREAM_SILENT_MS = 40000; // server pings every 15 s; longer silence = stuck
const STREAM_RETRY_MS = 30000; // after a drop, try the stream again (while polling meanwhile)
function streamBlocked() {
  if (/\.trycloudflare\.com$/i.test(location.hostname)) return true; // documented: no SSE
  try { return Number(localStorage.getItem(NO_STREAM_KEY)) > Date.now(); } catch { return false; }
}
function blockStream() {
  try { localStorage.setItem(NO_STREAM_KEY, String(Date.now() + 6 * 3600 * 1000)); } catch { /* storage off */ }
}

/**
 * liveStream(streamUrl, onData, onState, { stateUrl, pollMs }) → stop()
 * stateUrl defaults to streamUrl with /stream → /state. onData only fires when the data changed.
 */
function liveStream(url, onData, onState, opts = {}) {
  const stateUrl = opts.stateUrl || url.replace(/\/stream$/, '/state');
  const pollMs = opts.pollMs || 3000;
  let es = null; let streaming = false; let stopped = false; let silentDrops = 0;
  let last = null; let lastPollOkAt = 0; let pollTimer = null; let watchTimer = null; let retryTimer = null; let polling = false;
  const setState = (ok) => onState && onState(ok);
  const deliver = (text) => {
    if (text === last) return;
    let data; try { data = JSON.parse(text); } catch { return; }
    last = text; onData(data);
  };

  async function poll() {
    clearTimeout(pollTimer); pollTimer = null;
    if (stopped || streaming || polling) return;
    polling = true;
    try {
      const res = await fetch(stateUrl, { cache: 'no-cache', credentials: 'same-origin' });
      if (!res.ok) throw new Error(String(res.status));
      const text = await res.text();
      // once the stream is delivering, a reply that was already in flight may be older: drop it
      lastPollOkAt = Date.now();
      if (!stopped && !streaming) { deliver(text); setState(true); }
    } catch { if (!stopped && !streaming) setState(false); }
    polling = false;
    schedulePoll();
  }
  function schedulePoll() {
    if (stopped || streaming || pollTimer || document.hidden) return; // hidden tab: resume on visible
    pollTimer = setTimeout(poll, pollMs * (0.8 + Math.random() * 0.4)); // jitter: phones don't sync up
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || stopped) return;
    // phone woke up: a stream that slept may be dead without an error → check right away
    if (streaming && Date.now() - lastEventAt > 20000) dropStream(true);
    else if (!streaming) poll();
  });
  let lastEventAt = 0;

  function arm(ms, onTimeout) { clearTimeout(watchTimer); watchTimer = setTimeout(onTimeout, ms); }
  function dropStream(retry) {
    clearTimeout(watchTimer);
    if (es) { es.close(); es = null; }
    streaming = false;
    poll();
    clearTimeout(retryTimer);
    if (retry && !stopped) retryTimer = setTimeout(openStream, STREAM_RETRY_MS);
  }
  function openStream() {
    if (stopped || es || streamBlocked()) return;
    let got = false;
    const src = new EventSource(url);
    es = src;
    // no data while plain requests to the same server get through (or headers came back empty):
    // something in between holds the stream → stop using it on this device for a while
    const opened = Date.now();
    arm(STREAM_FIRST_MS, () => {
      const held = src.readyState === EventSource.OPEN || lastPollOkAt >= opened;
      if (held) blockStream();
      dropStream(!held);
    });
    const alive = () => { lastEventAt = Date.now(); arm(STREAM_SILENT_MS, () => {
      // worked, then went quiet: try again later; twice in a row → treat like a buffering proxy
      if (++silentDrops >= 2) { blockStream(); dropStream(false); } else dropStream(true);
    }); };
    src.onmessage = (e) => {
      if (!got) { got = true; streaming = true; clearTimeout(pollTimer); pollTimer = null; }
      alive(); setState(true); deliver(e.data);
    };
    // pings arriving on time = the path really is live → forget earlier silent drops
    src.addEventListener('ping', () => { if (got) { silentDrops = 0; alive(); } });
    // extra named events (the big screen's cheers): data that is not the page state
    for (const [name, fn] of Object.entries(opts.events || {})) src.addEventListener(name, (e) => {
      if (!got) return;
      alive(); let d; try { d = JSON.parse(e.data); } catch { return; } fn(d);
    });
    src.onerror = () => { if (es === src) dropStream(true); }; // poll at once, reconnect later
  }

  poll();
  openStream();
  return () => {
    stopped = true;
    clearTimeout(pollTimer); clearTimeout(watchTimer); clearTimeout(retryTimer);
    if (es) { es.close(); es = null; }
  };
}

/** Button pending state: prevents double press. */
async function busy(btn, fn) {
  if (btn.getAttribute('aria-busy') === 'true') return;
  btn.setAttribute('aria-busy', 'true');
  try { return await fn(); } finally { btn.removeAttribute('aria-busy'); }
}

/** Fonts for text drawn on a canvas (card pictures, photo frames). The browser only downloads a font when a page
 * uses it, and Thai and Latin are separate files (unicode-range), so document.fonts.load() without sample text
 * fetches only the Latin part: Thai was then measured with another font and came out off centre and too wide
 * (seen on iPhone). Asking with Thai and Latin text loads both. Never rejects. */
const FONT_SAMPLE = 'กขคงจฉบัตรโหวต่้๊๋ ABCabc 0123';
function loadFonts(specs) {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  return Promise.all(specs.map((f) => document.fonts.load(f, FONT_SAMPLE).catch(() => null))).then(() => undefined);
}

function photoHtml(c, size, cls = '') {
  const style = `width:${size}px;height:${size}px;border-radius:var(--radius-control);object-fit:cover;flex:none`;
  return c.photo
    ? `<img src="${esc(c.photo)}" alt="" class="${cls}" style="${style}" loading="lazy">`
    : `<div class="photo-ph ${cls}" style="${style};font-size:${Math.round(size / 3)}px" aria-hidden="true">${esc(c.number)}</div>`;
}

/* ---------- countdowns to a topic's closing time ----------
 * Any element with data-deadline="<ms>" shows the time left and is refreshed every second.
 * Snapshots carry the server's clock (now), so a phone whose clock is off still counts right. */
let serverSkew = 0;
function noteServerTime(now) { if (Number.isFinite(now)) serverSkew = now - Date.now(); }
const serverNow = () => Date.now() + serverSkew;
function fmtLeft(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(x)}` : `${p(m)}:${p(x)}`;
}
function fmtClock(ms) {
  const d = new Date(ms - serverSkew); // shown in this device's time zone
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
// "time's up" and the one-minute clip follow each topic's current deadline, as the server last reported it
// (pages pass their topics to noteTopics). A deadline that was changed, cleared, or ended early by closing the
// topic by hand is dropped, so only the deadline that really ends voting fires. It fires once, and only on a
// page that watched it count down (not on a page opened after it passed), even if the server's "closed"
// update arrives a moment before this page's tick reaches zero.
const topicClocks = new Map(); // topic id -> { status, closesAt } from the latest snapshot
const armedEnd = new Map(); const armedMinute = new Map(); // topic id -> deadline being watched
const fired = new Set(); // "end:<id>:<ms>" / "min:<id>:<ms>"
function noteTopics(topics) {
  topicClocks.clear();
  for (const t of topics || []) topicClocks.set(t.id, { status: t.status, closesAt: t.closesAt || null });
  checkDeadlines();
}
/** still the deadline that ends this topic? (changed, cleared, deleted or closed by hand before it: no) */
function stillDue(id, d) {
  const t = topicClocks.get(id);
  if (!t) return false;
  if (t.status === 'open') return t.closesAt === d;
  return serverNow() >= d - 2000; // closed: by the deadline itself, not by hand well before it
}
function checkDeadlines() {
  const now = serverNow();
  for (const [id, t] of topicClocks) {
    if (t.status !== 'open' || !t.closesAt) continue;
    if (t.closesAt - now > 1000) armedEnd.set(id, t.closesAt); // a new time replaces the old one
    if (t.closesAt - now > 61000) armedMinute.set(id, t.closesAt);
  }
  for (const [id, d] of armedMinute) {
    if (!stillDue(id, d)) { armedMinute.delete(id); continue; }
    if (d - now > 60000) continue;
    armedMinute.delete(id);
    if (d - now > 0 && !fired.has(`min:${id}:${d}`)) { fired.add(`min:${id}:${d}`); finalMinute(); }
  }
  for (const [id, d] of armedEnd) {
    if (!stillDue(id, d)) { armedEnd.delete(id); continue; }
    if (now < d) continue;
    armedEnd.delete(id);
    if (!fired.has(`end:${id}:${d}`)) { fired.add(`end:${id}:${d}`); timeUp(d); }
  }
}
function tickCountdowns() {
  for (const el of document.querySelectorAll('[data-deadline]')) {
    const left = Number(el.dataset.deadline) - serverNow();
    const text = left > 0 ? fmtLeft(left) : (el.dataset.done || 'หมดเวลา');
    if (el.textContent !== text) el.textContent = text;
    el.classList.toggle('urgent', left > 0 && left <= 60000);
  }
  checkDeadlines();
}
setInterval(tickCountdowns, 1000);

/* ---------- time's up: a shaking "หมดเวลา!" stamp, a buzzer, and a buzz on phones ---------- */
let audioCtx = null;
// Browsers only allow sound after a tap or key press on the page (the big screen: "เต็มจอ" or F). Phones count
// touchend and click as that tap, not touchstart or pointerdown, so all of them are listened to and the unlock
// is retried on every tap until the audio is really running.
// The short clips (public/sounds/) are decoded once and played through the same Web Audio context as the buzzer:
// on iPhone that mixes them reliably over the background music and lets their volume be set.
const CLIPS = { minute: '/sounds/iron-chep.mp3', timeUp: '/sounds/time-up.mp3' };
const clipBufs = {}; let clipsLoading = false;
function loadClips() {
  if (clipsLoading || !audioCtx) return;
  clipsLoading = true;
  for (const [k, url] of Object.entries(CLIPS)) {
    fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
      .then((buf) => new Promise((ok, no) => audioCtx.decodeAudioData(buf, ok, no))) // callback form: older Safari
      .then((b) => { clipBufs[k] = b; })
      .catch(() => { clipsLoading = false; }); // missing file or no network: tried again at the next tap
  }
}
const clipEls = {}; // fallback when Web Audio is not available
function playClip(k) {
  if (audioCtx && audioCtx.state === 'running' && clipBufs[k]) {
    const src = audioCtx.createBufferSource(), g = audioCtx.createGain();
    src.buffer = clipBufs[k]; g.gain.value = 0.9;
    src.connect(g); g.connect(audioCtx.destination); src.start();
    return;
  }
  try {
    const a = clipEls[k] || (clipEls[k] = new Audio(CLIPS[k]));
    a.currentTime = 0; a.play().catch(() => {});
  } catch { /* sound not allowed yet */ }
}
// Several tabs on one device (say /screen and /vote side by side) play a warning once: the first tab whose sound
// is unlocked takes it through localStorage; the others still show the stamp. A tab without unlocked sound never
// takes it, so it cannot swallow the sound for a tab that could play it.
const TAB_ID = Math.random().toString(36).slice(2);
function oncePerDevice(key, play) {
  if (!audioCtx || audioCtx.state !== 'running') return play(); // fallback path: try to play here
  const k = 'cv_snd_' + key;
  try {
    const cur = JSON.parse(localStorage.getItem(k) || 'null');
    if (cur && cur.tab !== TAB_ID && Date.now() - cur.at < 20000) return;
    localStorage.setItem(k, JSON.stringify({ tab: TAB_ID, at: Date.now() }));
    setTimeout(() => {
      const won = JSON.parse(localStorage.getItem(k) || 'null');
      if (!won || won.tab === TAB_ID) play();
      setTimeout(() => { try { localStorage.removeItem(k); } catch { /* storage blocked */ } }, 30000);
    }, 150); // two tabs at the same tick: the last writer wins in both
  } catch { play(); }
}
// two topics ending (or reaching their last minute) together give one set of sounds, not a pile-up
let lastMinuteAt = 0, lastTimeUpAt = 0;
const finalMinute = () => { if (Bgm.silent() || Date.now() - lastMinuteAt < 4000) return; lastMinuteAt = Date.now(); Bgm.duck(3000); oncePerDevice('minute', () => playClip('minute')); };
function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state !== 'running') {
      audioCtx.resume().then(loadClips, () => {});
      // iPhone: the context starts only once a sound is played during the tap itself; a silent one does
      const b = audioCtx.createBuffer(1, 1, 22050), src = audioCtx.createBufferSource();
      src.buffer = b; src.connect(audioCtx.destination); src.start(0);
    } else loadClips();
  } catch { audioCtx = null; }
}
for (const ev of ['touchend', 'click', 'keydown', 'pointerdown', 'touchstart']) document.addEventListener(ev, unlockAudio, { passive: true });
/** sound is ready for the warnings (the browser has let the audio context start) */
const soundReady = () => !!audioCtx && audioCtx.state === 'running';
// where the browser already allows sound (a computer that has played this site before), start without a tap
// (otherwise the context stays suspended until the first tap; nothing is played)
try {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'running') loadClips();
  else audioCtx.resume().then(() => { if (audioCtx.state === 'running') loadClips(); }, () => {});
} catch { audioCtx = null; }
function buzzer() {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const t0 = audioCtx.currentTime;
  const out = audioCtx.createGain(); out.gain.value = .32; out.connect(audioCtx.destination);
  // three short beeps, then a long falling horn
  const note = (at, len, f1, f2, type) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, at); o.frequency.exponentialRampToValueAtTime(f2, at + len);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(1, at + .02); g.gain.setValueAtTime(1, at + len - .06); g.gain.linearRampToValueAtTime(0, at + len);
    o.connect(g); g.connect(out); o.start(at); o.stop(at + len + .02);
  };
  note(t0, .16, 880, 880, 'square'); note(t0 + .26, .16, 880, 880, 'square'); note(t0 + .52, .16, 880, 880, 'square');
  note(t0 + .82, .9, 620, 330, 'sawtooth');
}
let timeUpStyle = false;
function timeUp(deadline) {
  const again = Date.now() - lastTimeUpAt < 12000; // another topic ending with this one: just shake its countdown
  if (!again && Bgm.silent()) { // guest page with the speaker off: no buzzer, just the stamp and a buzz
    lastTimeUpAt = Date.now();
    try { if (navigator.vibrate) navigator.vibrate([180, 90, 420]); } catch { /* not on this device */ }
  } else if (!again) {
    lastTimeUpAt = Date.now();
    Bgm.duck(13000); // buzzer, then the time's-up clip
    oncePerDevice('end', () => {
      buzzer();
      setTimeout(() => playClip('timeUp'), 1800); // right after the buzzer's long horn
      try { if (navigator.vibrate) navigator.vibrate([180, 90, 180, 90, 420]); } catch { /* not on this device */ }
    });
  }
  if (!timeUpStyle) { // one place for every page (index.html does not load base.css)
    timeUpStyle = true;
    const st = document.createElement('style');
    st.textContent = `.tu-overlay{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;pointer-events:none;background:rgba(42,20,10,.32);animation:tuFade 3.4s ease forwards}
.tu-card{font-family:Mitr,Anuphan,sans-serif;font-weight:600;font-size:clamp(44px,9vw,170px);line-height:1.2;color:#fff8f0;padding:.18em .7em;border-radius:999px;
background:linear-gradient(180deg,rgba(0,0,0,.2),rgba(0,0,0,0) 45%,rgba(0,0,0,.25)),repeating-linear-gradient(90deg,#9e3f16 0,#be5726 .4em,#dc7640 .8em,#e8874d .95em,#cc6532 1.25em,#ad4c1d 1.6em,#9e3f16 1.8em);
box-shadow:0 .2em .5em rgba(40,10,0,.55),inset 0 0 0 .06em rgba(255,248,240,.7);animation:tuIn .35s cubic-bezier(.3,1.6,.5,1) both,tuShake .5s .35s ease-in-out 4}
.tu-shake{display:inline-block;animation:tuShake .5s ease-in-out 4}
@keyframes tuIn{from{transform:scale(.3);opacity:0}}
@keyframes tuShake{0%,100%{transform:translateX(0) rotate(0)}15%{transform:translateX(-.08em) rotate(-4deg)}30%{transform:translateX(.08em) rotate(4deg)}45%{transform:translateX(-.06em) rotate(-3deg)}60%{transform:translateX(.06em) rotate(3deg)}75%{transform:translateX(-.03em) rotate(-1deg)}}
@keyframes tuFade{0%,82%{opacity:1}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.tu-card,.tu-shake{animation:none}}`;
    document.head.append(st);
  }
  for (const el of document.querySelectorAll(`[data-deadline="${deadline}"]`)) { el.classList.remove('tu-shake'); void el.offsetWidth; el.classList.add('tu-shake'); }
  if (again) return;
  const ov = document.createElement('div');
  ov.className = 'tu-overlay'; ov.setAttribute('role', 'alert');
  const card = document.createElement('div'); card.className = 'tu-card'; card.textContent = '⏰ หมดเวลา!';
  ov.append(card); document.body.append(ov);
  setTimeout(() => ov.remove(), 3500);
}

/* ---------- background music that follows the guest across pages ----------
 * Pages that want it call Bgm.enable(button): the landing page (all its screens), /vote and /claim.
 * Off by default (guests were startled by a page that suddenly played); the speaker button turns the music and
 * the countdown sounds on, remembered on that phone. Pages without the button (the big screen) always sound.
 * Browsers hold sound back until the first tap on each page, so it starts (from the same spot as on
 * the last page) as soon as the browser allows: at once where it can, otherwise at the first tap anywhere.
 * The music dips while the one-minute and time's-up sounds play. */
const Bgm = (() => {
  const SRC = '/sounds/home-loop.mp3', VOL = 0.55;
  // off until the guest turns it on with the speaker button; the choice is remembered on this phone
  let el = null, enabled = false, btn = null, off = true, blocked = false, duckT = null, ducked = false;
  let mutedElsewhere = () => false; // a page with its own speaker button (the big screen) says when it is off
  try { off = localStorage.getItem('cv_bgm_off') !== '0'; } catch { /* storage blocked */ }
  const save = () => { try { if (el && !el.paused) sessionStorage.setItem('cv_bgm_t', String(el.currentTime)); } catch { /* storage blocked */ } };
  function paint() {
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(!off));
    btn.setAttribute('aria-label', off ? 'เปิดเสียง' : blocked ? 'แตะเพื่อเปิดเสียงเพลง' : 'ปิดเสียง');
    btn.classList.toggle('bgm-wait', !off && blocked); // the browser is holding the sound until a tap
  }
  function sync() {
    if (!enabled) return;
    if (ducked) return;
    if (!off && !document.hidden) {
      el.play().then(() => { blocked = false; claim(); paint(); }, () => { blocked = true; paint(); });
    } else { save(); el.pause(); }
    paint();
  }
  // browsers hold back sound until the first tap or key press on the page: try again then
  const onTap = (e) => { if (btn && e.target && e.target.closest && e.target.closest('#' + btn.id)) return; if (!off && el.paused) sync(); };
  // one tab plays at a time: a tab that starts playing tells the others, and they pause (the tab used last wins)
  let chan = null;
  try { chan = new BroadcastChannel('cv-bgm'); } catch { /* old browser: tabs may overlap */ }
  const claim = () => { try { chan && chan.postMessage({ playing: TAB_ID }); } catch { /* closed */ } };
  if (chan) chan.onmessage = (m) => { if (m.data && m.data.playing && m.data.playing !== TAB_ID && el && !el.paused) { save(); el.pause(); } };
  return {
    enable(button) {
      if (enabled) return;
      enabled = true; btn = button || null;
      el = new Audio(SRC); el.loop = true; el.volume = VOL; el.preload = 'auto';
      let t = 0; try { t = Number(sessionStorage.getItem('cv_bgm_t')) || 0; } catch { /* storage blocked */ }
      if (t) el.addEventListener('loadedmetadata', () => { try { el.currentTime = t % (el.duration || Infinity); } catch { /* not seekable yet */ } }, { once: true });
      for (const ev of ['click', 'touchend', 'keydown']) document.addEventListener(ev, onTap, { passive: true });
      document.addEventListener('visibilitychange', sync);
      window.addEventListener('focus', sync); // back to this tab: it takes the music over
      window.addEventListener('pagehide', save);
      setInterval(save, 1000);
      if (btn) btn.addEventListener('click', () => {
        // pressed while the browser was holding the sound: this tap starts it (it does not switch it off)
        if (!off && blocked) { sync(); return; }
        off = !off;
        try { localStorage.setItem('cv_bgm_off', off ? '1' : '0'); } catch { /* storage blocked */ }
        sync();
      });
      sync(); // plays at once where the browser allows it; otherwise at the first tap
    },
    /** a guest page whose speaker is off: the countdown sounds stay quiet too */
    silent: () => (enabled && off) || mutedElsewhere(),
    /** pages without the music (the big screen) hand over their own speaker switch for the countdown sounds */
    muteWhen(fn) { mutedElsewhere = fn; },
    /** the browser is holding the music back until a tap */
    isBlocked: () => blocked,
    /** lower the music for a moment so a warning sound is heard */
    duck(ms) {
      // other sounds on the page (the big screen's shuffle music) step aside too
      try { document.dispatchEvent(new CustomEvent('cv-duck', { detail: ms })); } catch { /* old browser */ }
      if (!el) return;
      clearTimeout(duckT);
      el.volume = VOL * 0.2;
      // iPhone ignores volume set from a page: pause the music for the moment instead, then carry on
      const fixedVolume = Math.abs(el.volume - VOL * 0.2) > 0.01;
      if (fixedVolume && !el.paused) { ducked = true; save(); el.pause(); }
      duckT = setTimeout(() => { el.volume = VOL; if (ducked) { ducked = false; sync(); } }, ms);
    },
  };
})();
