'use strict';
// Party landing + photo page: home (curtain hero) → photo booth (frame, layout, count → shoot → save)
// or costume entry (shoot → review → name/department/concept → straight into the contest, or to the admin to approve).
// Ported from the "Staff Party" design. Voting itself stays on /vote; this page shares its session token.
(() => {
const F = window.Frames;
const TOKEN_KEY = 'cv_token';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const P = {
  pub: null, token: localStorage.getItem(TOKEN_KEY), me: null,
  screen: 'home', mode: 'booth', frame: 'beneat', n: 3, shape: 'strip',
  cName: '', cDept: '', cConcept: '', contestShot: null, contestFrom: 'camera', submitting: false,
};
const authHeaders = () => (P.token ? { 'X-Voter-Token': P.token } : {});

function say(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(say.t); say.t = setTimeout(() => t.classList.remove('show'), 2800);
}
const joinUrl = (next) => '/vote?next=' + next;

/* ---------- session (same token as the voting page) ---------- */
async function loadMe() {
  if (!P.token) { P.me = null; return; }
  try { P.me = await api('GET', '/api/me', undefined, authHeaders()); }
  catch (e) { if (e.status === 401) { localStorage.removeItem(TOKEN_KEY); P.token = null; P.me = null; } }
}

/* ---------- live event data: name, topics, whether entries / Drive are on ---------- */
function setText(sel, t) { const el = $(sel); if (el && el.textContent !== t) el.textContent = t; }
function renderHome() {
  if (!P.pub) return;
  const name = P.pub.event.name;
  document.title = name;
  setText('#eventName', name); setText('#topTitle', name);
  const topics = P.pub.topics;
  const people = topics.reduce((n, t) => n + t.contestants.length, 0);
  setText('#heroTopics', String(topics.length));
  setText('#heroEntries', `${people} ผู้เข้าประกวด`);
  const open = topics.filter((t) => t.status === 'open').length;
  const timer = $('#heroTimer');
  timer.classList.toggle('voting', open > 0);
  const cd = $('#heroCountdown');
  // the soonest closing time among open topics, counted down like the design's pill
  const next = topics.filter((t) => t.status === 'open' && t.closesAt).sort((a, b) => a.closesAt - b.closesAt)[0];
  if (next) {
    setText('#heroTimerLabel', `โหวตได้ถึง ${fmtClock(next.closesAt)} น. · อีก`);
    cd.dataset.deadline = next.closesAt; cd.dataset.done = 'หมดเวลา'; cd.textContent = fmtLeft(next.closesAt - serverNow());
  } else {
    delete cd.dataset.deadline;
    if (open) { setText('#heroTimerLabel', 'เปิดโหวตอยู่ ·'); setText('#heroCountdown', `${open} หัวข้อ`); }
    else if (topics.length && topics.every((t) => t.status === 'closed')) { setText('#heroTimerLabel', 'ปิดโหวตแล้ว'); setText('#heroCountdown', ''); }
    else { setText('#heroTimerLabel', 'ยังไม่เปิดโหวต'); setText('#heroCountdown', ''); }
  }
  $('#heroCountdown').hidden = !$('#heroCountdown').textContent;
  // Live Score and voting open once the admin opens a topic (they stay open afterwards for the results),
  // and during the contestant intro, when guests join to send cheers
  const unlocked = topics.length > 0 || !!P.pub.cheer?.open;
  for (const a of document.querySelectorAll('#voteLink, .live-cta')) {
    a.setAttribute('aria-disabled', String(!unlocked));
    if (unlocked) a.removeAttribute('tabindex'); else a.setAttribute('tabindex', '-1');
  }
  $('#linksNote').hidden = unlocked;
}

/* ---------- studio: stage previews ---------- */
const curN = () => (P.mode === 'contest' ? 1 : P.n);
const curShape = () => (P.mode === 'contest' ? 'strip' : P.shape);
const curFrame = () => (P.mode === 'contest' ? F.CONTEST_FRAME : P.frame);
const contestCaption = () => [P.cName.trim(), P.cDept.trim(), P.cConcept.trim()].filter(Boolean).join(' · ');
const curCap = () => (P.mode === 'contest' ? contestCaption() : '');
const frameName = (id) => (F.FRAMES.find((f) => f.id === id) || F.FRAMES[0]).name;

function drawStage() {
  const contest = P.mode === 'contest', form = P.screen === 'cform';
  const cv = $(form ? '#stageF' : contest ? '#stageC' : '#stage');
  const n = curN(), shape = curShape(), dims = F.frameDims(shape, n);
  const ctx = F.sizeCanvas(cv, dims, 1);
  F.drawFrame(ctx, curFrame(), form ? [P.contestShot] : [], curCap(), n, shape);
  if (!contest) $('#stageNote').textContent = `${frameName(P.frame)} · ${n} รูป · ${shape === 'square' ? 'แนวนอน' : 'แนวตั้ง'}`;
  fitStage(cv); setTimeout(() => fitStage(cv), 0);
}
/* preview size follows the screen: the booth preview ends level with "เริ่มถ่าย", others fill the height */
function fitStage(cv) {
  const st = cv && cv.closest('.stage'); if (!st || !st.offsetParent) return;
  const ar = cv.width / cv.height, pad = 44, top = st.getBoundingClientRect().top;
  const btn = P.screen === 'booth' ? $('#startBooth') : null;
  let H = btn && innerWidth >= 880 ? btn.getBoundingClientRect().bottom - top : innerHeight - top - 56;
  H = Math.max(340, H);
  st.style.setProperty('--stage-w', Math.round((H - pad) * ar + pad) + 'px');
}
function refitStage() { fitStage($(P.screen === 'cform' ? '#stageF' : P.screen === 'contest' ? '#stageC' : '#stage')); }
function buildFrames() {
  const box = $('#frames'); box.textContent = '';
  for (const f of F.FRAMES) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'fr'; b.setAttribute('role', 'radio'); b.dataset.frame = f.id;
    const c = document.createElement('canvas'), s = document.createElement('span'); s.textContent = f.name;
    b.append(c, s); box.append(b);
  }
}
function drawThumbs() {
  if (P.mode !== 'booth') return;
  const dims = F.frameDims(P.shape, P.n);
  for (const b of document.querySelectorAll('.fr')) {
    F.drawFrame(F.sizeCanvas(b.querySelector('canvas'), dims, 240 / Math.max(dims[0], dims[1])), b.dataset.frame, [], '', P.n, P.shape);
    b.setAttribute('aria-checked', String(b.dataset.frame === P.frame));
  }
}
function drawAll() { if (['booth', 'contest', 'cform'].includes(P.screen)) { drawStage(); drawThumbs(); } }

/* ---------- screens (phone back button returns to the previous one) ---------- */
const SCREENS = [['#scHome', 'home'], ['#scBooth', 'booth'], ['#scContest', 'contest'], ['#scResult', 'result'], ['#scForm', 'cform']];
function goScreen(name, push = true) {
  P.screen = name;
  if (name === 'booth' || name === 'contest') P.mode = name;
  if (name === 'cform') P.mode = 'contest';
  for (const [id, key] of SCREENS) $(id).hidden = key !== name;
  document.body.classList.toggle('on-home', name === 'home');
  document.body.classList.toggle('studio-screen', name !== 'home');
  if (push) {
    const hash = name === 'home' ? '' : '#' + name;
    if (location.hash !== hash) history.pushState({ screen: name }, '', location.pathname + hash);
  }
  renderScreen(); window.scrollTo(0, 0); setTimeout(refitStage, 60);
}

window.addEventListener('popstate', () => {
  if (SH.active) cancelShoot();
  const h = location.hash.slice(1);
  goScreen(['booth', 'contest'].includes(h) ? h : 'home', false);
});
function renderScreen() {
  if (P.screen === 'booth') renderBoothSetup();
  else if (P.screen === 'contest') renderContestSetup();
  else if (P.screen === 'cform') renderContestForm();
  else if (P.screen === 'home') renderHome();
}
function renderBoothSetup() {
  for (const b of document.querySelectorAll('#countRow button')) b.setAttribute('aria-checked', String(+b.dataset.n === P.n));
  for (const b of document.querySelectorAll('#shapeRow button')) b.setAttribute('aria-checked', String(b.dataset.shape === P.shape));
  const save = P.pub?.booth.drive ? 'ชอบแล้วค่อยกด “บันทึกรูป” เก็บลงเครื่องและส่งเข้า Google Drive ของงาน' : 'แล้วกดบันทึกลงเครื่องได้';
  $('#boothHow').textContent = liveCamera()
    ? `กด “เริ่มถ่าย” แล้วกล้องจะเปิดเต็มจอ นับ 3-2-1 และถ่ายเองทีละรูปจนครบ ${P.n} รูป ${save}`
    : `กด “เริ่มถ่าย” แล้วแตะเปิดกล้องของเครื่องทีละรูปจนครบ ${P.n} รูป ${save}`;
  drawAll();
}

/* contest needs: entries open (admin), and a joined guest (the server ties each entry to a voter) */
function contestBlock() {
  if (!P.pub) return { title: 'กำลังเชื่อมต่อ…', text: '' };
  if (!P.pub.entries.open) return { title: 'ยังไม่เปิดรับสมัครประกวดชุด', text: 'แอดมินจะเปิดให้ส่งรูปเมื่อถึงเวลา ระหว่างนี้ไปถ่ายรูปสนุกๆ ได้เลย' };
  if (!P.token) return { title: 'ลงชื่อเข้างานก่อนส่งประกวด', text: 'ใช้รหัสบนบัตรหรือชื่อของคุณ แล้วระบบจะพากลับมาหน้านี้', join: 'contest' };
  return null;
}
const ENTRY_STATUS = { pending: 'รอแอดมินตรวจ', approved: 'ขึ้นให้โหวตแล้ว', rejected: 'ไม่ผ่านการตรวจ' };
const entryStatus = (e) => (e.status === 'approved' && !e.live ? 'เข้าประกวดแล้ว · รอเปิดโหวต' : ENTRY_STATUS[e.status] || e.status);
function renderContestSetup() {
  const block = contestBlock(), msg = $('#contestMsg');
  $('#contestForm').hidden = !!block;
  msg.textContent = '';
  const parts = [];
  if (block) {
    const d = document.createElement('div'); d.className = 'note';
    const st = document.createElement('strong'); st.textContent = block.title; d.append(st, document.createTextNode(block.text));
    if (block.join) { const a = document.createElement('a'); a.className = 'btn primary'; a.href = joinUrl(block.join); a.textContent = 'ลงชื่อเข้างาน'; a.style.marginTop = '12px'; a.style.display = 'table'; d.append(a); }
    parts.push(d);
  }
  const mine = P.me?.entries || [];
  if (mine.length) {
    const d = document.createElement('div'); d.className = 'note';
    const st = document.createElement('strong'); st.textContent = 'รูปที่คุณส่งแล้ว'; d.append(st);
    for (const e of mine) { const r = document.createElement('div'); r.textContent = `${e.name} · ${e.concept} — ${entryStatus(e)}`; d.append(r); }
    parts.push(d);
  }
  msg.append(...parts); msg.hidden = !parts.length;
  drawAll();
}
function renderContestForm() {
  renderFlow($('#formFlow'), flowContest(), 2);
  const fr = $('#formRetake');
  fr.querySelector('b').textContent = P.contestFrom === 'gallery' ? 'เลือกรูปอื่น' : 'ถ่ายใหม่';
  fr.querySelector('small').textContent = P.contestFrom === 'gallery' ? 'เปิดคลังภาพอีกครั้ง' : 'นับถอยหลัง 5 วินาที แล้วถ่ายอีกครั้ง';
  $('#formNote').textContent = !autoEntries() ? 'รูปจะไปรอให้แอดมินตรวจก่อน ผ่านแล้วจึงขึ้นให้โหวต'
    : liveEntries() ? 'กดส่งแล้วรูปจะขึ้นหน้าโหวตและ Live Score ทันที' : 'กดส่งแล้วรูปจะเก็บไว้ในหัวข้อประกวด และขึ้น Live Score เมื่อเปิดโหวต';
  for (const [id, k] of [['#fName', 'cName'], ['#fDept', 'cDept'], ['#fConcept', 'cConcept']]) { const el = $(id); if (el.value !== P[k]) el.value = P[k]; }
  $('#submitContest').disabled = !(P.cName.trim() && P.cDept.trim() && P.cConcept.trim()) || P.submitting;
  drawAll();
}

/* ---------- camera ----------
 * A live camera inside the page needs https (or localhost). Guests usually open http://<ip>:3000,
 * so there the page opens the phone's own camera app once per shot instead. */
const CAM = { stream: null, idle: null, facing: 'user', count: 0 };
try { if (localStorage.getItem('cv_cam') === 'environment') CAM.facing = 'environment'; } catch {}
const liveCamera = () => !!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
const camLive = () => !!CAM.stream && CAM.stream.getVideoTracks().some((t) => t.readyState === 'live');
async function getCamera() {
  clearTimeout(CAM.idle);
  if (camLive()) return CAM.stream;
  const size = { width: { ideal: 1280 }, height: { ideal: 960 } };
  const tries = [
    { video: { facingMode: { exact: CAM.facing }, ...size }, audio: false },
    { video: { facingMode: CAM.facing, ...size }, audio: false },
    { video: true, audio: false },
  ];
  let last;
  for (let round = 0; round < 2; round++) {
    for (const c of tries) {
      try { CAM.stream = await navigator.mediaDevices.getUserMedia(c); countCameras(); return CAM.stream; }
      catch (e) { last = e; if (e.name === 'NotAllowedError' || e.name === 'SecurityError') throw e; }
    }
    await sleep(600); // a camera still closing from the last shot often frees up after a moment
  }
  throw last;
}
function releaseCamera() { clearTimeout(CAM.idle); if (CAM.stream) { CAM.stream.getTracks().forEach((t) => t.stop()); CAM.stream = null; } }
function releaseCameraSoon(ms = 60000) { clearTimeout(CAM.idle); CAM.idle = setTimeout(releaseCamera, ms); }
const camMirror = () => CAM.facing === 'user';
async function countCameras() {
  try { CAM.count = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput').length; } catch { CAM.count = 0; }
  $('#shootFlip').hidden = CAM.count < 2;
}
async function flipCamera() {
  if (!SH.active || SH.switching || !SH.live) return;
  SH.switching = true; $('#shootFlip').disabled = true;
  CAM.facing = CAM.facing === 'user' ? 'environment' : 'user';
  try { localStorage.setItem('cv_cam', CAM.facing); } catch {}
  releaseCamera();
  const v = $('#liveVid');
  try {
    SH.stream = await getCamera();
    v.srcObject = SH.stream; await v.play().catch(() => {});
    for (let t = 0; t < 60 && !v.videoWidth; t++) await sleep(50);
  } catch (e) { if (!SH.cancelled) showCamError(e); }
  SH.switching = false; $('#shootFlip').disabled = false;
}
document.addEventListener('visibilitychange', () => { if (document.hidden && !SH.active) releaseCamera(); });

/* ---------- full-screen shoot ---------- */
const SH = { active: false };
function shootNum(text, done) {
  const el = $('#shootNum'); el.textContent = text; el.classList.toggle('done', !!done);
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}
function flash() { const f = $('#shootFlash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
function grabFrame(v, mirror, max = 1400) {
  const k = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(v.videoWidth * k)); c.height = Math.max(1, Math.round(v.videoHeight * k));
  const x = c.getContext('2d');
  if (mirror) { x.translate(c.width, 0); x.scale(-1, 1); }
  x.drawImage(v, 0, 0, c.width, c.height);
  return c;
}
function drawShoot(liveImg) {
  const dims = F.frameDims(SH.shape, SH.n);
  const ctx = F.sizeCanvas($('#shootCanvas'), dims, Math.min(0.6, 1300 / Math.max(dims[0], dims[1])));
  const imgs = Array.from({ length: SH.n }, (_, i) => SH.shots[i] || (i === SH.k ? liveImg : null) || null);
  F.drawFrame(ctx, SH.frame, imgs, SH.cap, SH.n, SH.shape);
}
const shotLabel = () => (SH.mode === 'contest' ? 'รูปประกวด' : `รูปที่ ${SH.k + 1} / ${SH.n}`);
function startShoot() {
  if (SH.active) return;
  if (P.mode === 'contest' && contestBlock()) return renderContestSetup();
  Object.assign(SH, { active: true, cancelled: false, mode: P.mode, n: curN(), frame: curFrame(), shape: curShape(), cap: curCap(), shots: [], k: 0, stream: null, loop: null, live: liveCamera() });
  $('#shoot').hidden = false; document.body.classList.add('noscroll');
  $('#shootErr').hidden = true; $('#shootNum').textContent = '';
  $('#shootFlip').hidden = true;
  drawShoot(null);
  if (SH.live) { $('#shootLbl').textContent = 'กำลังเปิดกล้อง…'; tapButton(null); openCameraForShoot(); }
  else askPhoto();
}
async function openCameraForShoot() {
  $('#shootErr').hidden = true;
  try { SH.stream = await getCamera(); }
  catch (e) { if (!SH.cancelled) showCamError(e); return; }
  if (!SH.cancelled) runLive();
}
function showCamError(e) {
  const n = e && e.name;
  $('#shootErrText').textContent =
    n === 'NotAllowedError' || n === 'SecurityError' ? 'เบราว์เซอร์ยังไม่อนุญาตให้ใช้กล้อง แตะไอคอนกล้องหรือแม่กุญแจที่แถบที่อยู่ เลือก “อนุญาต” แล้วกดลองอีกครั้ง'
      : n === 'NotReadableError' || n === 'AbortError' ? 'กล้องกำลังถูกใช้งานโดยแอปหรือแท็บอื่น ปิดแอปนั้นแล้วกดลองอีกครั้ง'
        : n === 'NotFoundError' || n === 'OverconstrainedError' ? 'ไม่พบกล้องในเครื่องนี้'
          : 'เปิดกล้องไม่ได้ กดลองอีกครั้ง';
  $('#shootLbl').textContent = '';
  $('#shootErr').hidden = false;
}
async function runLive() {
  const v = $('#liveVid'); v.srcObject = SH.stream; v.muted = true; v.playsInline = true;
  await v.play().catch(() => {});
  for (let t = 0; t < 80 && !v.videoWidth; t++) await sleep(50);
  if (!v.videoWidth) { releaseCamera(); return showCamError({ name: 'NotReadableError' }); }
  SH.loop = setInterval(() => { if (v.videoWidth) drawShoot(grabFrame(v, camMirror(), 640)); }, 70);
  for (let k = 0; k < SH.n; k++) {
    SH.k = k; $('#shootLbl').textContent = shotLabel();
    for (const d of (SH.mode === 'contest' ? ['5', '4', '3', '2', '1'] : ['3', '2', '1'])) {
      while (SH.switching && !SH.cancelled) await sleep(100);
      if (SH.cancelled) return;
      shootNum(d); await sleep(1000);
    }
    while (SH.switching && !SH.cancelled) await sleep(100);
    if (SH.cancelled) return;
    SH.shots[k] = grabFrame(v, camMirror()); flash(); shootNum('✓', true); await sleep(500);
  }
  SH.k = SH.n; clearInterval(SH.loop); SH.loop = null; drawShoot(null);
  finishShoot();
}
/* no live camera (plain http): one tap per shot opens the phone's camera app */
function tapButton(label) {
  let b = $('#shootTap');
  if (!label) { if (b) b.hidden = true; return; }
  if (!b) {
    b = document.createElement('button'); b.type = 'button'; b.id = 'shootTap'; b.className = 'shoot-tap btn primary';
    b.addEventListener('click', () => { const f = $('#camFile'); f.value = ''; f.click(); });
    $('#shoot').append(b);
  }
  b.textContent = label; b.hidden = false;
}
function askPhoto() {
  $('#shootLbl').textContent = shotLabel();
  tapButton(SH.n > 1 ? `แตะเพื่อถ่ายรูปที่ ${SH.k + 1}` : 'แตะเพื่อเปิดกล้อง');
}
$('#camFile').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file || !SH.active || SH.live) return;
  try {
    const { img } = await F.fileToPhoto(file);
    if (SH.cancelled) return;
    SH.shots[SH.k] = img; flash(); shootNum('✓', true);
    SH.k++; drawShoot(null);
    if (SH.k >= SH.n) { tapButton(null); return finishShoot(); }
    askPhoto();
  } catch { say('เปิดรูปนี้ไม่ได้ ลองถ่ายใหม่'); }
});
function stopCamera() {
  if (SH.loop) { clearInterval(SH.loop); SH.loop = null; }
  $('#liveVid').srcObject = null; SH.stream = null;
  releaseCameraSoon();
}
function closeShoot() { $('#shoot').hidden = true; document.body.classList.remove('noscroll'); tapButton(null); }
function cancelShoot() {
  SH.cancelled = true; SH.active = false; stopCamera(); closeShoot();
  renderScreen();
}
async function finishShoot() {
  $('#shootLbl').textContent = ''; $('#shootNum').textContent = ''; await sleep(350);
  stopCamera(); closeShoot(); SH.active = false;
  if (SH.mode === 'contest') reviewContest(SH.shots[0], 'camera'); else saveBoothResult();
}

/* ---------- result: step flow on top, then the next actions ---------- */
// last step follows the admin's choice: entries join the contest at once, or wait for approval
const autoEntries = () => !!P.pub?.entries.auto;
const liveEntries = () => autoEntries() && !!P.pub?.entries.live; // the topic is open: a new entry shows at once
const flowContest = () => [P.contestFrom === 'gallery' ? 'เลือกรูป' : 'ถ่ายรูป', 'ตรวจรูป', 'กรอกข้อมูล', !autoEntries() ? 'รอแอดมินตรวจ' : liveEntries() ? 'ขึ้น Live Score' : 'รอเปิดโหวต'];
const flowBooth = () => ['เลือกกรอบ', 'ถ่ายรูป', P.pub?.booth.drive ? 'บันทึกไป Google Drive' : 'บันทึกรูป'];
function renderFlow(el, steps, cur) {
  el.innerHTML = steps.map((s, i) => `<li class="${i < cur ? 'done' : i === cur ? 'cur' : ''}"><span class="fn">${i < cur ? '✓' : i + 1}</span><span class="ft"></span></li>`).join('');
  [...el.querySelectorAll('.ft')].forEach((t, i) => { t.textContent = steps[i]; });
}
const ACTION_ICONS = {
  save: '<path d="M5 4h11l3 3v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" fill="currentColor" opacity=".25"/><path d="M8 4v5h7V4M8 20v-6h8v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M5 4h11l3 3v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  retake: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.7l1.3-2h5l1.3 2h1.7A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" fill="currentColor" opacity=".25"/><path d="M15.6 10.2A4 4 0 1 0 16 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16.4 8.4v2.4H14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" fill="currentColor" opacity=".25"/><path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
};
const GO_ARROW = `<span class="go-arrow" aria-hidden="true">${'<svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'.repeat(2)}</span>`;
function resBtn(a) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'btn res-btn toy ' + (a.kind || 'alt');
  b.innerHTML = `<span class="ab-ic ${a.icon}" aria-hidden="true"><svg viewBox="0 0 24 24">${ACTION_ICONS[a.icon]}</svg></span><span class="rb-t"><b></b><small></small></span><span class="rb-go">${GO_ARROW}</span>`;
  b.querySelector('b').textContent = a.label;
  const sm = b.querySelector('small'); if (a.sub) sm.textContent = a.sub; else sm.remove();
  b.addEventListener('click', () => a.fn(b));
  return b;
}
function showResult({ src, kicker, title, text, flow, step, actions }) {
  goScreen('result');
  $('#resultImg').src = src; $('#resultKicker').textContent = kicker;
  $('#resultTitle').textContent = title; $('#resultText').textContent = text;
  renderFlow($('#resultFlow'), flow, step);
  const box = $('#resActions'); box.textContent = '';
  actions.forEach((a) => box.append(resBtn(a)));
  $('#autoBack').textContent = '';
}
function setResultText(t) { if (P.screen === 'result') $('#resultText').textContent = t; }
const goHome = () => goScreen('home');

/* booth sheet: kept on the phone (download / share) and, when the admin set up Drive, sent there through the server */
const sheetName = () => `photobooth-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
function canvasBlob(c, q) { return new Promise((r) => c.toBlob(r, 'image/jpeg', q)); }
// How each phone saves best:
// - iPhone/iPad: the share sheet ("Save Image" puts it in Photos); a download would land in Files instead.
// - Android and computers: a plain download (Android's share sheet usually has no "save to gallery").
// - In-app browsers (LINE, Facebook, Instagram…), which drop both: long-press the picture.
// The file is made as soon as the sheet shows, so the tap can open the share sheet straight away:
// Safari refuses navigator.share() once the tap has waited on slow work such as toBlob.
const UA = navigator.userAgent;
const IOS = /iPad|iPhone|iPod/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IN_APP = /\bLine\/|FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|TikTok|; wv\)/i.test(UA);
let sheetFile = null;
function prepareSheet(c) {
  sheetFile = null;
  return canvasBlob(c, 0.92).then((b) => (sheetFile = b ? new File([b], sheetName(), { type: 'image/jpeg' }) : null));
}
let tipShown = false; // the long-press tip stays on screen; Drive news then goes to a toast
function longPressTip() {
  tipShown = true;
  const t = IOS ? 'กดค้างที่รูปด้านบน แล้วเลือก “บันทึกรูปภาพ” หรือ “เพิ่มไปยังรูปภาพ”'
    : 'กดค้างที่รูปด้านบน แล้วเลือก “ดาวน์โหลดรูปภาพ” หรือ “บันทึกรูปภาพ”';
  setResultText(t); say(t);
  $('#resultImg').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
async function keepOnPhone(ready) {
  if (IN_APP) return longPressTip();
  const file = sheetFile || await ready;
  if (!file) return longPressTip();
  if (IOS) {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    return longPressTip();
  }
  const u = URL.createObjectURL(file), a = document.createElement('a');
  a.href = u; a.download = file.name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 30000);
  say('ดาวน์โหลดรูปแล้ว ดูได้ในแกลเลอรีหรือโฟลเดอร์ดาวน์โหลด');
}
function jpegUnder(c, max) { // data URL small enough for the server's 3 MB limit
  let q = 0.9, u;
  do { u = c.toDataURL('image/jpeg', q); q -= 0.1; } while (u.length * 0.75 > max && q > 0.4);
  return u;
}
async function sendToDrive(c) {
  const flow = flowBooth();
  const tell = (t) => { if (tipShown || P.screen !== 'result') say(t); else setResultText(t); };
  tell('กำลังบันทึกไป Google Drive…');
  try {
    await api('POST', '/api/booth', { photo: jpegUnder(c, 2.8 * 1024 * 1024) }, authHeaders());
    tell('บันทึกรูปไป Google Drive ของงานแล้ว');
    if (P.screen === 'result') renderFlow($('#resultFlow'), flow, flow.length);
    return true;
  } catch (e) {
    tell(e.message || 'บันทึกไป Google Drive ไม่สำเร็จ กด “บันทึกรูป” อีกครั้ง');
    return false;
  }
}
function saveBoothResult() {
  const c = F.compose(1, SH.frame, SH.shots, '', SH.n, SH.shape);
  const drive = !!P.pub?.booth.drive;
  const ready = prepareSheet(c);
  tipShown = false;
  // Drive gets the sheet only when the guest presses save (someone unhappy with it just retakes);
  // once per sheet, and again on the next press if the upload failed
  let drv = null; // null: not sent · a promise: sending or sent
  const save = () => {
    keepOnPhone(ready); // first, while the tap still counts (iPhone share sheet)
    if (drive && !drv) drv = sendToDrive(c).then((ok) => { if (!ok) drv = null; return ok; });
  };
  const actions = [
    drive ? { label: 'บันทึกรูป', sub: 'เก็บลงเครื่อง และส่งเข้า Google Drive ของงาน', icon: 'save', kind: 'main', fn: save }
      : { label: 'บันทึกลงเครื่อง', sub: 'เก็บรูปไว้ในมือถือของคุณ', icon: 'save', kind: 'main', fn: save },
    { label: 'ถ่ายอีกแผ่น', sub: 'กรอบและจำนวนรูปเดิม', icon: 'retake', fn: () => { goScreen('booth'); startShoot(); } },
    { label: 'กลับหน้าแรก', sub: 'ถ่ายรูปต่อหรือส่งประกวด', icon: 'home', kind: 'ghost', fn: goHome },
  ];
  const text = drive ? 'ชอบรูปนี้ กด “บันทึกรูป” รูปจะเก็บลงเครื่องและเข้า Google Drive ของงาน ไม่ชอบก็ถ่ายใหม่ได้ ไม่มีอะไรถูกส่งไป'
    : 'กด “บันทึกลงเครื่อง” เพื่อเก็บรูปไว้ในมือถือ';
  showResult({ src: c.toDataURL('image/jpeg', 0.9), kicker: 'ถ่ายรูปสนุกๆ', title: 'ได้รูปแล้ว!', text, flow: flowBooth(), step: 2, actions });
}

/* costume entry: review → fill in → sent to the admin's waiting list */
/* costume photo from the library: a picture taken earlier works too (the frame crops it to fit) */
function pickContestPhoto() {
  if (contestBlock()) return renderContestSetup();
  const f = $('#pickFile'); f.value = ''; f.click();
}
$('#pickFile').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const { img } = await F.fileToPhoto(file);
    reviewContest(img, 'gallery');
  } catch { say('เปิดรูปนี้ไม่ได้ ลองเลือกรูปอื่น'); }
});
const retakeContest = () => { if (P.contestFrom === 'gallery') pickContestPhoto(); else { goScreen('contest'); startShoot(); } };

function reviewContest(shot, from) {
  P.contestShot = shot; P.contestFrom = from;
  const gallery = from === 'gallery';
  const c = F.compose(0.6, F.CONTEST_FRAME, [P.contestShot], '', 1, 'strip');
  showResult({
    src: c.toDataURL('image/jpeg', 0.88), kicker: 'ส่งประกวดชุด', title: 'ชอบรูปนี้ไหม?',
    text: !autoEntries() ? 'ถ้าชอบ กดใช้รูปนี้แล้วกรอกข้อมูล รูปจะไปรอแอดมินตรวจก่อนขึ้นให้โหวต'
      : liveEntries() ? 'ถ้าชอบ กดใช้รูปนี้แล้วกรอกข้อมูล รูปจะขึ้น Live Score ทันที' : 'ถ้าชอบ กดใช้รูปนี้แล้วกรอกข้อมูล รูปจะเก็บไว้รอเปิดโหวต',
    flow: flowContest(), step: 1,
    actions: [
      { label: 'ใช้รูปนี้', sub: 'ถัดไป: กรอกชื่อ แผนก และ Concept', icon: 'save', kind: 'main', fn: () => goScreen('cform') },
      gallery ? { label: 'เลือกรูปอื่น', sub: 'เปิดคลังภาพอีกครั้ง', icon: 'retake', fn: pickContestPhoto }
        : { label: 'ถ่ายใหม่', sub: 'ถ่ายรูปประกวดอีกครั้ง', icon: 'retake', fn: () => { goScreen('contest'); startShoot(); } },
      { label: 'กลับหน้าแรก', sub: 'ยกเลิกรูปนี้', icon: 'home', kind: 'ghost', fn: goHome },
    ],
  });
}
async function submitContest() {
  if (P.submitting || !P.contestShot) return;
  const name = P.cName.trim(), dept = P.cDept.trim(), concept = P.cConcept.trim();
  if (!name || !dept || !concept) return;
  P.submitting = true; renderContestForm(); $('#submitContest').textContent = 'กำลังส่ง…';
  const shot = P.contestShot;
  const photo = F.smallDataURL(F.compose(720 / 1080, F.CONTEST_FRAME, [shot], contestCaption(), 1, 'strip'));
  try {
    const r = await api('POST', '/api/entries', { name, dept, concept, photo }, authHeaders());
    const added = r.entry && r.entry.status === 'approved', live = added && r.entry.live;
    const doneSrc = F.compose(0.6, F.CONTEST_FRAME, [shot], contestCaption(), 1, 'strip').toDataURL('image/jpeg', 0.88);
    P.contestShot = null; P.cName = P.cDept = P.cConcept = '';
    loadMe();
    showResult({
      src: doneSrc, kicker: 'ส่งประกวดชุด', title: 'ส่งประกวดเรียบร้อย!',
      text: live ? `รูปของ ${name} ขึ้น Live Score แล้ว ขอให้โชคดี 🍀`
        : added ? `รูปของ ${name} เข้าประกวดแล้ว จะขึ้น Live Score เมื่อเปิดโหวต ขอให้โชคดี 🍀`
          : `รูปของ ${name} ไปรอแอดมินตรวจแล้ว ผ่านแล้วจะขึ้นให้โหวต ขอให้โชคดี 🍀`,
      flow: flowContest(), step: 4,
      actions: [{ label: 'กลับหน้าแรก', sub: 'ถ่ายรูปต่อหรือไปโหวต', icon: 'home', kind: 'main', fn: goHome }],
    });
  } catch (e) {
    if (e.status === 401) { localStorage.removeItem(TOKEN_KEY); P.token = null; }
    say(e.message || 'ส่งไม่สำเร็จ ลองอีกครั้ง');
  } finally {
    P.submitting = false; $('#submitContest').textContent = 'ส่งประกวด';
    if (P.screen === 'cform') renderContestForm();
  }
}

/* ---------- hero buttons: a small press animation, then go ---------- */
function navTo(where) {
  goScreen(where); // contest: the guest chooses there between the camera and a photo from the library
}
function bindCamButtons() {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const b of document.querySelectorAll('[data-cam]')) {
    b.addEventListener('click', () => {
      b.classList.remove('snap'); void b.offsetWidth; b.classList.add('snap');
      setTimeout(() => { b.classList.remove('snap'); navTo(b.dataset.cam); }, calm ? 0 : 220);
    });
  }
}

/* ---------- "แตะเพื่อเข้างาน": once per visit, only while the browser is holding sound back ----------
 * Phones play nothing until the guest taps the page. This full-screen card turns that first tap into the one
 * that starts the music and readies the countdown sounds (the tap itself reaches common.js's listeners). */
function showWelcome() {
  let seen = false;
  try { seen = sessionStorage.getItem('cv_welcome') === '1'; } catch { /* storage blocked */ }
  if (seen || Bgm.silent() || (navigator.userActivation && navigator.userActivation.hasBeenActive)) return; // sound off: nothing to unlock
  const w = $('#welcome');
  // give the browser a moment to say whether it allows sound; a computer that does skips the card
  setTimeout(() => {
    if (soundReady() && !Bgm.isBlocked()) return;
    w.hidden = false; $('#welcomeGo').focus();
    $('#welcomeGo').addEventListener('click', () => {
      try { sessionStorage.setItem('cv_welcome', '1'); } catch { /* storage blocked */ }
      w.classList.add('out');
      setTimeout(() => { w.hidden = true; }, 500);
    }, { once: true });
  }, 600);
}

/* ---------- events + start ---------- */
function bind() {
  bindCamButtons();
  Bgm.enable($('#bgmBtn')); // background music, shared with the voting pages
  showWelcome();
  for (const a of document.querySelectorAll('#voteLink, .live-cta')) {
    a.addEventListener('click', (e) => { if (a.getAttribute('aria-disabled') === 'true') { e.preventDefault(); say('ยังไม่เปิดโหวต รอผู้จัดเปิดโหวตก่อนนะ'); } });
  }
  for (const b of document.querySelectorAll('[data-go]')) b.addEventListener('click', () => goScreen(b.dataset.go));
  $('#frames').addEventListener('click', (e) => { const b = e.target.closest('.fr'); if (b) { P.frame = b.dataset.frame; drawAll(); } });
  $('#countRow').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { P.n = +b.dataset.n; renderBoothSetup(); } });
  $('#shapeRow').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { P.shape = b.dataset.shape; renderBoothSetup(); } });
  $('#startBooth').addEventListener('click', startShoot);
  $('#startContest').addEventListener('click', startShoot);
  $('#shootCancel').addEventListener('click', cancelShoot);
  $('#shootRetry').addEventListener('click', openCameraForShoot);
  $('#shootFlip').addEventListener('click', flipCamera);
  for (const [id, k] of [['#fName', 'cName'], ['#fDept', 'cDept'], ['#fConcept', 'cConcept']]) {
    $(id).addEventListener('input', (e) => { P[k] = e.target.value; renderContestForm(); });
  }
  $('#submitContest').addEventListener('click', submitContest);
  $('#formRetake').addEventListener('click', retakeContest);
  $('#pickContest').addEventListener('click', pickContestPhoto);
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(refitStage, 120); });
}

async function boot() {
  buildFrames(); bind();
  await F.loadArt();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawAll);
  const h = location.hash.slice(1);
  goScreen(['booth', 'contest'].includes(h) ? h : 'home', false);
  await loadMe();
  liveStream('/api/stream', async (data) => {
    noteServerTime(data.now); noteTopics(data.topics);
    P.pub = data; F.setTitle(data.event.name);
    // "no entry details" mode: join quietly, like the voting page does
    if (!P.token && data.event.accessMode === 'open' && !P.joining) {
      P.joining = true;
      try { P.token = (await api('POST', '/api/join', {})).token; localStorage.setItem(TOKEN_KEY, P.token); await loadMe(); } catch {}
      P.joining = false;
    }
    renderHome();
    if (P.screen === 'contest' || P.screen === 'booth') renderScreen();
  });
}
boot();
})();
