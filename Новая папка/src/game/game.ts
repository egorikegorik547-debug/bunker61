// @ts-nocheck
import * as THREE from 'three';
import './game.css';
import { createHubRoom } from './hubRoom';
import { NOTES, HUB_LINES, SECTORS, ITEMS, HEAL, STASH_KEYS, LABELS, CONT, ZONES, UPS, CRAFT, WEAPONS, WEAPON_ORDER, CARRY, WCRAFT, PISTOL_CARD, PIPE_CARD, SLOTS, SLOT_OPTIONS, MELEE, FURNITURE } from './data';
import { FurniturePreviewer } from './furniture';
import { buildWeaponModel, flatMat, WeaponPreviewer } from './weaponModels';
import { PlayerViewer } from './playerModel';
import { WA, initWeaponAudio } from './weaponAudio';
import { ViewHands } from './viewHands';
import { buildSpider, buildRat, decorateBloater, decorateSpitter } from './monsterModels';
import { menuMusic } from './music';
import { bunkerAmbient } from './ambient';
import { ALMANAC, ALMANAC_ORDER, MonsterViewer } from './almanac';
import { TEX, wallTex, corridorFloorMat, ceilTex, bloodTex, zoneSignMat, zoneFloorMat, zoneMarkMat } from './bunkerTextures';
import { PROPS, WALL_DECOR, ZONE_DECOR, wallStripes, addFixture, ceilingDecor, buildAirlockDoor, containerMat, createDust, bakeStatic, addFloorDetails } from './bunkerProps';

export function startGame() {
/* ====================== УТИЛИТЫ ====================== */
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const show = (id, on = true) => $(id).classList.toggle('off', !on);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const turn = (cur, tgt, rate) => { const d = ((tgt - cur + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return cur + clamp(d, -rate, rate); };

/* ====================== СОХРАНЕНИЕ ====================== */
const DEF_SAVE = { day: 1, food: 3, meds: 1, band: 2, scrap: 4, wood: 2, furniture: { candle: false, chair: false, painting: false, radio: false }, ammo: 16, ammoR: 0, ammoV: 0, shells: 0, fuel: 0, weapons: { rifle: false, shotgun: false, flame: false, asval: false, machete: false, kukri: false }, equip: { primary: null, melee: 'pipe' }, blueprints: { asval: false }, wpn: 'pistol', batt: 1, up: { light: 0, hp: 0, stam: 0, boots: 0, bag: 0 }, notes: [], kills: 0, sorties: 0, deaths: 0, bestiary: {} };
let save = loadSave();
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem('bunker-save-v1'));
    if (s) { const d = JSON.parse(JSON.stringify(DEF_SAVE)); Object.assign(d, s); d.up = Object.assign({}, DEF_SAVE.up, s.up || {}); d.weapons = Object.assign({}, DEF_SAVE.weapons, s.weapons || {}); d.blueprints = Object.assign({}, DEF_SAVE.blueprints, s.blueprints || {}); d.equip = Object.assign({}, DEF_SAVE.equip, s.equip || {}); if (!d.equip.primary) d.equip.primary = SLOT_OPTIONS.primary.find(id => d.weapons[id]) || null; if (d.equip.melee !== 'pipe' && !d.weapons[d.equip.melee]) d.equip.melee = 'pipe'; d.bestiary = Object.assign({}, s.bestiary || {}); d.furniture = Object.assign({}, DEF_SAVE.furniture, s.furniture || {}); if (typeof d.wood !== 'number') d.wood = 0; return d; }
  } catch (e) {}
  return null;
}
function store() { try { localStorage.setItem('bunker-save-v1', JSON.stringify(save)); } catch (e) {} }

/* ====================== НАСТРОЙКИ ====================== */
// Раскладка по умолчанию: коды физических клавиш (KeyW, Digit1…) и кнопок мыши (Mouse0 — ЛКМ, Mouse2 — ПКМ)
const DEF_BINDS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', sprint: 'ShiftLeft', crouch: 'KeyC',
  fire: 'Mouse0', aim: 'Mouse2', reload: 'KeyR', melee: 'KeyV',
  w1: 'Digit1', w2: 'Digit2', w3: 'Digit3',
  interact: 'KeyE', inventory: 'Tab', flash: 'KeyF', heal: 'KeyH'
};
const DEF_SET = { sens: 1, vol: 0.85, music: true, musicVol: 0.7, fov: 75, bright: 1, quality: 1, shadows: true, bob: true, shake: true, invertY: false, aimToggle: false, binds: Object.assign({}, DEF_BINDS) };
const settings = loadSettings();
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('bunker-settings-v1'));
    if (s) { const r = Object.assign({}, DEF_SET, s); r.binds = Object.assign({}, DEF_BINDS, s.binds || {}); return r; }
  } catch (e) {}
  return Object.assign({}, DEF_SET, { binds: Object.assign({}, DEF_BINDS) });
}
function storeSettings() { try { localStorage.setItem('bunker-settings-v1', JSON.stringify(settings)); } catch (e) {} }

/* ====================== УПРАВЛЕНИЕ: привязки клавиш ====================== */
const KEYNAMES = {
  Space: 'Пробел', Tab: 'Tab', ShiftLeft: 'Shift', ShiftRight: 'Правый Shift', ControlLeft: 'Ctrl', ControlRight: 'Правый Ctrl',
  AltLeft: 'Alt', AltRight: 'Правый Alt', Enter: 'Enter', Backspace: 'Backspace', CapsLock: 'Caps Lock', Delete: 'Delete', Insert: 'Insert',
  Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Mouse0: 'ЛКМ', Mouse1: 'СКМ (колесо)', Mouse2: 'ПКМ', Mouse3: 'Мышь 4', Mouse4: 'Мышь 5',
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\'
};
const keyName = code => KEYNAMES[code] || (code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : code.startsWith('Numpad') ? 'Num ' + code.slice(6) : code);
const bindName = a => keyName(settings.binds[a]);
const kbd = a => `<kbd>${bindName(a)}</kbd>`;
// какое действие сейчас привязано к коду (с запасными вариантами: I — инвентарь, правый Shift — бег)
function actionOf(code) {
  for (const a in settings.binds) if (settings.binds[a] === code) return a;
  if (code === 'KeyI') return 'inventory';
  return null;
}
const down = a => { const c = settings.binds[a]; return !!keys[c] || (a === 'sprint' && c === 'ShiftLeft' && !!keys.ShiftRight); };

/* ====================== ИНВЕНТАРЬ: СПИСКИ СЛОТОВ ====================== */
// Список — плотный массив стеков {id, n, ref}. cap — число ячеек.
function addTo(list, cap, id, n, ref) {
  const max = ITEMS[id].max;
  if (max > 1) for (const s of list) {
    if (s.id === id && s.n < max) { const t = Math.min(max - s.n, n); s.n += t; n -= t; if (!n) return 0; }
  }
  while (n > 0 && list.length < cap) { const t = Math.min(max, n); list.push({ id, n: t, ref }); n -= t; }
  return n; // сколько не влезло
}
const countIn = (list, id) => list.reduce((a, s) => a + (s.id === id ? s.n : 0), 0);
function removeFrom(list, id, n) {
  for (let i = list.length - 1; i >= 0 && n > 0; i--) {
    const s = list[i]; if (s.id !== id) continue;
    const t = Math.min(s.n, n); s.n -= t; n -= t; if (s.n <= 0) list.splice(i, 1);
  }
  return n;
}
function moveStack(from, to, toCap, idx, amount) {
  const it = from[idx]; if (!it) return 0;
  amount = Math.min(amount, it.n);
  const left = addTo(to, toCap, it.id, amount, it.ref), moved = amount - left;
  if (moved > 0) { it.n -= moved; if (it.n <= 0) from.splice(idx, 1); }
  return moved;
}

/* ====================== THREE: СЦЕНА ====================== */
const CELL = 6, WALL_H = 3.4, WALL_T = 0.5;
const renderer = new THREE.WebGLRenderer({ antialias: true });
const QUALITY_PR = [0.6, Math.min(devicePixelRatio, 1.5), Math.min(devicePixelRatio, 2)];
renderer.setPixelRatio(QUALITY_PR[settings.quality] ?? 1);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);
const dom = renderer.domElement;

const scene = new THREE.Scene();
const FOG_COL = 0x07090b, FOG_DENS = 0.046;
scene.background = new THREE.Color(FOG_COL);
scene.fog = new THREE.FogExp2(FOG_COL, FOG_DENS);
const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.05, 90);
camera.rotation.order = 'YXZ';
scene.add(camera);
const AMB_COL = 0x93a6b8, AMB_INT = 1.45;
let ambBase = AMB_INT;
const ambient = new THREE.AmbientLight(AMB_COL, AMB_INT * settings.bright);
scene.add(ambient);

const spot = new THREE.SpotLight(0xfff0d6, 170, 34, 0.5, 0.75, 2);
spot.position.set(0.12, -0.1, 0);
camera.add(spot); camera.add(spot.target); spot.target.position.set(0, 0, -5);
spot.castShadow = settings.shadows; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0006; spot.shadow.normalBias = 0.03; spot.shadow.camera.near = 0.2; spot.shadow.camera.far = 34;
const gunLight = new THREE.PointLight(0xffc27a, 0, 12, 2);
gunLight.position.set(0, 0, -0.8); camera.add(gunLight);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});

/* ---------- Материалы уровня (текстуры — в bunkerTextures.ts) ---------- */
const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9, metalness: 0.02 });
const debrisMat = new THREE.MeshStandardMaterial({ color: 0x5a5851, roughness: 1 });
const pipeMat = new THREE.MeshStandardMaterial({ color: 0x6b4a34, roughness: 0.6, metalness: 0.5 });
const ribMat = new THREE.MeshStandardMaterial({ color: 0x1d2023, roughness: 0.8, metalness: 0.4 });
const trimMat = new THREE.MeshStandardMaterial({ map: TEX.hazard, roughness: 0.6, metalness: 0.2 });
const bloodMat = new THREE.MeshStandardMaterial({ map: bloodTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.4 });

/* ---------- Сборщик геометрии ---------- */
class Geo {
  constructor() { this.p = []; this.n = []; this.u = []; this.i = []; }
  box(cx, cy, cz, sx, sy, sz, us = 0.25, vs = us, v0 = 0) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const F = [
      { n: [1, 0, 0], v: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]], w: sz, h: sy },
      { n: [-1, 0, 0], v: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]], w: sz, h: sy },
      { n: [0, 1, 0], v: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]], w: sx, h: sz },
      { n: [0, -1, 0], v: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]], w: sx, h: sz },
      { n: [0, 0, 1], v: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]], w: sx, h: sy },
      { n: [0, 0, -1], v: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]], w: sx, h: sy }
    ];
    for (const f of F) {
      const b = this.p.length / 3;
      const uv = [[0, v0], [f.w * us, v0], [f.w * us, v0 + f.h * vs], [0, v0 + f.h * vs]];
      for (let k = 0; k < 4; k++) {
        this.p.push(cx + f.v[k][0], cy + f.v[k][1], cz + f.v[k][2]);
        this.n.push(...f.n); this.u.push(...uv[k]);
      }
      this.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setIndex(this.i);
    return g;
  }
}

/* ---------- Вьюмодель (оружие в руках; ближний бой — mgroups) ---------- */
const vm = new THREE.Group();
const vmMat = c => new THREE.MeshBasicMaterial({ color: c, fog: false });
vm.position.set(.22, -.12, -.45);
camera.add(vm);
const hands = new ViewHands(vm);
// Новое оружие в руках (модели — в weaponModels.ts)
const wgroups = {}, muzzles = {}, slides = {};
const WVM = { pipe: { s: 1, p: [0, 0, 0], ry: 0 }, machete: { s: 1, p: [0, 0, 0], ry: 0 }, kukri: { s: 1, p: [0, 0, 0], ry: 0 }, pistol: { s: 1.18, p: [0.0, 0.0, -0.01], ry: 0.06 }, asval: { s: 0.8, p: [0.0, 0.03, -0.1], ry: 0.1 }, rifle: { s: 0.78, p: [0.0, 0.02, -0.12], ry: 0.1 }, shotgun: { s: 0.78, p: [0.0, 0.02, -0.12], ry: 0.1 }, flame: { s: 0.8, p: [0.0, 0.04, -0.08], ry: 0.1 } };
// ближний бой: рукоять у начала координат, клинок в −Z; поза покоя и масштаб подобраны под вид от первого лица
const MVM = { pipe: { s: 0.62, p: [0.03, -0.02, -0.05], r: [0.38, 0.1, -0.05] }, machete: { s: 0.72, p: [0.03, -0.03, -0.1], r: [0.42, 0.12, -0.08] }, kukri: { s: 1.0, p: [0.03, -0.035, -0.14], r: [0.4, 0.1, -0.1] } };
const mgroups = {};
for (const id of ['pipe', 'machete', 'kukri']) {
  const w = buildWeaponModel(id, flatMat), cf = MVM[id];
  const holder = new THREE.Group(); holder.add(w); holder.scale.setScalar(cf.s); holder.visible = false;
  vm.add(holder); mgroups[id] = holder; hands.register(id, holder, w);
}
let pilotMesh = null;
const MZ_SIZE = { pistol: 0.17, rifle: 0.3, shotgun: 0.36, flame: 0.3, asval: 0.1 };
for (const id of ['pistol', 'rifle', 'shotgun', 'flame', 'asval']) {
  const w = buildWeaponModel(id, flatMat), cf = WVM[id];
  const holder = new THREE.Group(); holder.add(w); holder.scale.setScalar(cf.s); holder.position.set(...cf.p); holder.rotation.y = cf.ry; holder.visible = false;
  const mz = new THREE.Mesh(new THREE.PlaneGeometry(MZ_SIZE[id], MZ_SIZE[id]), new THREE.MeshBasicMaterial({ color: id === 'flame' ? 0xff8a2a : 0xffd27a, transparent: true, opacity: 0.95, fog: false, side: THREE.DoubleSide }));
  mz.position.copy(w.userData.muzzle); mz.position.z -= 0.06; mz.visible = false; w.add(mz);
  if (id === 'flame') pilotMesh = w.userData.pilot;
  if (w.userData.slide) slides[id] = w.userData.slide;
  vm.add(holder); wgroups[id] = holder; muzzles[id] = mz; hands.register(id, holder, w);
}

/* ====================== АУДИО ====================== */
let AC = null, master = null, noiseBuf = null;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = settings.vol; master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    initWeaponAudio(AC, master, noiseBuf);
    [[47, 'sine', .05], [50.4, 'sine', .05], [95.5, 'triangle', .012]].forEach(([f, t, v]) => {
      const o = AC.createOscillator(); o.type = t; o.frequency.value = f;
      const g = AC.createGain(); g.gain.value = v; o.connect(g); g.connect(master); o.start();
    });
  } catch (e) { AC = null; }
}
function outNode(node, pan) {
  if (AC.createStereoPanner && pan) { const p = AC.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); node.connect(p); p.connect(master); }
  else node.connect(master);
}
function tone(f, dur, type = 'sine', vol = 0.1, slide = 0, pan = 0) {
  if (!AC) return;
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); outNode(g, pan); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, lp = 2000, pan = 0) {
  if (!AC) return;
  const t = AC.currentTime, s = AC.createBufferSource(); s.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(lp, t); f.frequency.exponentialRampToValueAtTime(Math.max(80, lp / 5), t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); outNode(g, pan); s.start(t, Math.random() * 0.5, dur + 0.05);
}
function growl(dist, pan, big = 1) {
  if (!AC) return;
  const v = clamp(1 - dist / 32, 0, 1) * 0.26; if (v < 0.01) return;
  const t = AC.currentTime, d = rand(0.6, 1.1);
  const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(rand(75, 105) / big, t); o.frequency.exponentialRampToValueAtTime(48 / big, t + d);
  const lfo = AC.createOscillator(); lfo.frequency.value = rand(14, 26); const lg = AC.createGain(); lg.gain.value = 14; lfo.connect(lg); lg.connect(o.frequency);
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520;
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(f); f.connect(g); outNode(g, pan); o.start(t); lfo.start(t); o.stop(t + d + .05); lfo.stop(t + d + .05);
}
function skitter(dist, pan, hi = 1) {
  if (!AC) return;
  const v = clamp(1 - dist / 30, 0, 1) * 0.24; if (v < 0.01) return;
  for (let i = 0; i < 8; i++) setTimeout(() => { if (!AC) return; noise(0.035, v, 5200 * hi, pan); tone(rand(2300, 3900) * hi, 0.03, 'square', v * 0.16, -300, pan); }, i * rand(32, 62));
}
function gurgle(dist, pan) {
  if (!AC) return;
  const v = clamp(1 - dist / 30, 0, 1) * 0.26; if (v < 0.01) return;
  const t = AC.currentTime, d = rand(0.7, 1.1);
  const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(rand(150, 210), t); o.frequency.exponentialRampToValueAtTime(70, t + d);
  const lfo = AC.createOscillator(); lfo.frequency.value = rand(30, 46); const lg = AC.createGain(); lg.gain.value = 55; lfo.connect(lg); lg.connect(o.frequency);
  const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 2.5;
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(f); f.connect(g); outNode(g, pan); o.start(t); lfo.start(t); o.stop(t + d + 0.05); lfo.stop(t + d + 0.05);
}
function voice(m, dist, pan) {
  const k = m.cfg.voice;
  if (k === 'skitter') skitter(dist, pan, m.cfg.hi || 1);
  else if (k === 'gurgle') gurgle(dist, pan);
  else growl(dist, pan, m.cfg.big);
}
let hitKind = null;
const sfx = {
  shot() { WA.shot('pistol'); },
  empty() { tone(1300, 0.04, 'square', 0.05); },
  asval() { WA.shot('asval'); },
  rifle() { WA.shot('rifle'); },
  shotgun() { WA.shot('shotgun'); },
  flame() { WA.shot('flame'); },
  boom() { noise(1.1, 1.0, 1600); tone(58, 0.9, 'sawtooth', 0.45, -34); },
  spit() { noise(0.2, 0.18, 3200); tone(520, 0.22, 'sawtooth', 0.09, -300); },
  swing(id) { WA.swing(id); },
  slash() { },
  thud() { noise(0.12, 0.3, 700); tone(90, .12, 'sine', .25, -40); },
  hit() { WA.flesh(hitKind || 'bullet'); },
  hurt() { noise(0.25, 0.4, 900); tone(80, 0.3, 'sawtooth', 0.2, -30); },
  pick() { tone(620, .08, 'triangle', .1); setTimeout(() => tone(880, .1, 'triangle', .1), 70); },
  heal() { tone(440, .25, 'sine', .12, 220); },
  open() { noise(0.25, 0.14, 1200); tone(180, .15, 'square', .05, -60); },
  click() { tone(900, .03, 'square', .04); },
  door() { noise(0.7, 0.2, 1500); tone(70, .6, 'sawtooth', .1, -20); },
  stepN: 0,
  // шаги: глухой удар подошвы + шорох + короткий «цокот» по бетону. v — база громкости (шаг 0.05, бег 0.1, на корточках 0.02)
  step(v) {
    if (!AC) return;
    const k = v * 3.6, side = (this.stepN++ % 2 ? 1 : -1) * 0.18, hard = v >= 0.04;
    noise(0.1, k * 1.15, 1250 + rand(-200, 300), side);
    tone(rand(62, 84), 0.13, 'sine', k * 1.5, -28, side);
    tone(rand(120, 170), 0.07, 'triangle', k * 0.5, -60, side);
    if (hard) { tone(rand(1900, 2900), 0.03, 'square', k * 0.07, -900, side); noise(0.035, k * 0.55, 3400, side); }
  },
  heart(v) { tone(55, .14, 'sine', v); setTimeout(() => tone(48, .16, 'sine', v * .8), 170); }
};

/* ====================== СОСТОЯНИЕ ИГРЫ ====================== */
let state = 'menu';       // menu | hub | sortie | result
let running = false, locked = false, fallback = false, lockErrors = 0;
let lv = null, lvGroup = null, time = 0;
let invOpen = false, invCont = null, invSel = null, invNote = null;
let invTab = 'model', plViewer = null;   // вкладка справа в инвентаре: 'model' (3D-модель) | 'stats'
const keys = {};
let fireHeld = false, aiming = false;
const player = {
  x: 3, z: 3, yaw: 0, pitch: 0, vx: 0, vz: 0, hp: 100, maxHp: 100, stam: 100, maxStam: 100, exhausted: false,
  batt: 100, battDur: 150, flash: true, crouch: false, eye: 1.65, bobT: 0, stepT: 0, burst: 0, noise: 2, shake: 0,
  mags: { pistol: 8, rifle: 0, shotgun: 0, flame: 0, asval: 0 }, weapon: 'pistol', melee: 'pipe', swingMax: 0.32, get mag() { return this.mags[this.weapon] ?? 0; }, set mag(v) { this.mags[this.weapon] = v; }, reloadT: 0, reloadMax: 1.3, reloadN: 0, cycleT: -1, cycleDelay: 0, cycleDur: 0.8, gunCD: 0, meleeCD: 0, swingT: 0, kick: 0, flashT: 0, aimT: 0, bag: [], bagCap: 8, loot: {}, hasKey: false, vault: false,
  prog: 0, boots: 0, heartT: 0, kills: 0, hurtFlash: 0
};
// Прицеливание (ПКМ): приближение, сведение оружия к центру экрана, меньший разброс и отдача, медленнее ход.
// sy — высота линии прицеливания (мушка/оптика) в модели оружия.
const AIM = {
  pistol: { zoom: 0.8, time: 0.16, move: 0.75, spread: 0.35, recoil: 0.7, sy: 0.05, z: -0.38 },
  rifle: { zoom: 0.34, time: 0.3, move: 0.5, spread: 0.12, recoil: 0.65, sy: 0.095, z: -0.4, scope: true },
  shotgun: { zoom: 0.86, time: 0.22, move: 0.7, spread: 0.6, recoil: 0.8, sy: 0.058, z: -0.4 },
  flame: { zoom: 0.92, time: 0.2, move: 0.7, spread: 0.5, recoil: 1, sy: 0.058, z: -0.45 },
  asval: { zoom: 0.72, time: 0.2, move: 0.7, spread: 0.4, recoil: 0.7, sy: 0.076, z: -0.36 }
};
for (const id of ['pipe', 'machete', 'kukri']) AIM[id] = { zoom: 1, time: 0.2, move: 1, spread: 1, recoil: 1, sy: 0, z: -0.45 };
const aimE = () => { const t = player.aimT; return t * t * (3 - 2 * t); };
const bagCount = id => countIn(player.bag, id);
const cw = () => WEAPONS[player.weapon];
const isOwned = id => id === 'pistol' || id === 'pipe' || !!save.weapons[id];
/* ---------- Слоты экипировки: основное / пистолет / ближний бой ---------- */
const slotWeapon = slot => slot === 'pistol' ? 'pistol' : (save.equip && save.equip[slot]) || null;
const isEquipped = id => !!id && !!WEAPONS[id] && slotWeapon(WEAPONS[id].slot) === id;
const equippedList = () => SLOTS.map(sl => slotWeapon(sl.id)).filter(Boolean);
function fixEquip() {
  if (!save.equip) save.equip = { primary: null, melee: 'pipe' };
  if (!save.equip.primary || !isOwned(save.equip.primary)) save.equip.primary = SLOT_OPTIONS.primary.find(isOwned) || null;
  if (!save.equip.melee || !isOwned(save.equip.melee)) save.equip.melee = 'pipe';
  player.melee = save.equip.melee;
}
function switchWeapon(id, quiet) {
  const p = player; if (!id || !isEquipped(id) || p.weapon === id) return;
  p.weapon = id; p.reloadT = 0; p.cycleT = -1; p.cycleDelay = 0; p.gunCD = Math.max(p.gunCD, 0.25); save.wpn = id; WA.draw(id);
  if (!quiet) toast(`${WEAPONS[id].icon} ${WEAPONS[id].name}`, 'info');
}
// клавиши 1 / 2 / 3: достать оружие из слота
function selectSlot(slot) {
  const id = slotWeapon(slot);
  if (!id) { toast('Слот «' + SLOTS.find(x => x.id === slot).name + '» пуст — соберите оружие на верстаке', 'bad'); return; }
  switchWeapon(id);
}
// поставить оружие в слот (из инвентаря); если заменяемое было в руках — в руки берём новое
function equipWeapon(id, quiet) {
  const W = WEAPONS[id]; if (!W || !isOwned(id)) return false;
  const slot = W.slot; if (slot === 'pistol') return true;
  const old = slotWeapon(slot), inHand = player.weapon === old;
  save.equip[slot] = id; if (slot === 'melee') player.melee = id; store();
  if (inHand && old !== id) { player.weapon = id; player.reloadT = 0; player.gunCD = Math.max(player.gunCD, 0.25); save.wpn = id; }
  if (!quiet) { sfx.click(); toast(`${SLOTS.find(x => x.id === slot).name}: ${W.icon} ${W.name}`, 'info'); }
  return true;
}
const bagAdd = (id, n, ref) => addTo(player.bag, player.bagCap, id, n, ref);
const bagRemove = (id, n) => removeFrom(player.bag, id, n);
function invChanged() { player.hasKey = bagCount('key') > 0; if (invOpen) renderInv(); }

const MT = {
  walker: { name: 'Бродяга', hp: 60, walk: 1.1, chase: 2.7, dmg: 14, scale: 1, sight: 13, hear: 1, range: 1.5, cd: 1.1, hunch: 0.5, skin: 0x93a08c, clothes: [0xb4561d, 0x2f4f7f, 0xbdbdae, 0x3d5a3a], arm: -1.1, big: 1 },
  runner: { name: 'Бегун', hp: 36, walk: 1.7, chase: 4.7, dmg: 10, scale: 0.93, sight: 15, hear: 1.2, range: 1.4, cd: 0.8, hunch: 0.85, skin: 0x7f8a85, clothes: [0x30343b, 0x5a2d2d], arm: -0.5, big: 1.3 },
  spider: { name: 'Паук-мутант', kind: 'spider', voice: 'skitter', hi: 1, hp: 46, walk: 1.9, chase: 5.0, dmg: 13, scale: 1.05, sight: 15, hear: 1.3, range: 1.5, cd: 0.9, swing: 0.25, hunch: 0, arm: 0, big: 1, leapDur: 0.4, leapCD: 3.2, noLoot: true },
  rat: { name: 'Крыса-мутант', kind: 'rat', voice: 'skitter', hi: 1.5, hp: 14, walk: 2.1, chase: 5.6, dmg: 6, scale: 0.95, sight: 12, hear: 1.4, range: 1.0, cd: 0.55, swing: 0.2, hunch: 0, arm: 0, big: 1, noLoot: true, pack: 3 },
  spitter: { name: 'Кислотник', kind: 'human', voice: 'gurgle', hp: 58, walk: 1.0, chase: 2.3, dmg: 10, scale: 1, sight: 15, hear: 1, range: 1.5, cd: 1.1, hunch: 0.35, skin: 0x7da85c, clothes: [0x3d4a2e, 0x4a4a3a], arm: -0.7, big: 1, spit: { keep: 7, min: 2.2, max: 16, cd: 2.8, dmg: 13 } },
  bloater: { name: 'Подрывник', kind: 'human', voice: 'bloat', hp: 85, walk: 0.8, chase: 1.9, dmg: 0, scale: 1.15, fat: 1.5, sight: 11, hear: 0.9, range: 1.7, cd: 1.0, hunch: 0.25, skin: 0x9a8f6a, clothes: [0x5a4a2a, 0x44484f], arm: -0.9, big: 0.6, explode: { r: 4.2, dmg: 45 } },
  brute: { name: 'Громила', hp: 170, walk: 0.9, chase: 2.35, dmg: 30, scale: 1.45, sight: 11, hear: 0.8, range: 1.9, cd: 1.6, hunch: 0.3, skin: 0x8d8878, clothes: [0x44484f, 0x6b5a2a], arm: -0.9, big: 0.6 }
};

/* ====================== ГЕНЕРАЦИЯ УРОВНЯ ====================== */
const DX = [0, 1, 0, -1], DZ = [-1, 0, 1, 0];
function canGo(x, z, d) {
  const N = lv.N;
  if (d === 0) return z > 0 && !lv.H[z][x];
  if (d === 1) return x < N - 1 && !lv.V[z][x + 1];
  if (d === 2) return z < N - 1 && !lv.H[z + 1][x];
  return x > 0 && !lv.V[z][x];
}
const cellOf = v => clamp(Math.floor(v / CELL), 0, lv.N - 1);
function bfsDist(sx, sz) {
  const N = lv.N, dist = new Array(N * N).fill(-1); dist[sz * N + sx] = 0; const q = [[sx, sz]];
  for (let h = 0; h < q.length; h++) {
    const [x, z] = q[h];
    for (let d = 0; d < 4; d++) if (canGo(x, z, d)) {
      const nx = x + DX[d], nz = z + DZ[d];
      if (dist[nz * N + nx] < 0) { dist[nz * N + nx] = dist[z * N + x] + 1; q.push([nx, nz]); }
    }
  }
  return dist;
}
function bfsNext(sx, sz, tx, tz) {
  const N = lv.N, prev = new Int16Array(N * N).fill(-1), s = sz * N + sx; prev[s] = s;
  const q = [s];
  for (let h = 0; h < q.length; h++) {
    const c = q[h], x = c % N, z = (c / N) | 0;
    if (x === tx && z === tz) break;
    for (let d = 0; d < 4; d++) if (canGo(x, z, d)) {
      const n = (z + DZ[d]) * N + x + DX[d];
      if (prev[n] < 0) { prev[n] = c; q.push(n); }
    }
  }
  let c = tz * N + tx; if (prev[c] < 0) return null;
  while (prev[c] !== s) c = prev[c];
  return [c % N, (c / N) | 0];
}

function disposeLevel() {
  if (!lvGroup) return;
  scene.remove(lvGroup);
  lvGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  lvGroup = null;
}

/* ---------- Зоны ---------- */
function assignZones(N, farI) {
  const zone = new Array(N * N).fill('corridor');
  const pool = []; for (let i = 1; i < N * N; i++) if (i !== farI) pool.push(i);
  shuffle(pool);
  const base = ['living', 'medbay', 'canteen', 'warehouse', 'server', 'generator', 'armory', 'corridor', 'corridor'];
  const types = shuffle(base.slice());
  const k = Math.min(pool.length, Math.max(7, Math.round(N * N / 7)));
  const seeds = [];
  for (let s = 0; s < k; s++) seeds.push({ x: pool[s] % N, z: (pool[s] / N) | 0, t: s < types.length ? types[s] : pick(base), w: rand(0.85, 1.2) });
  for (let i = 0; i < N * N; i++) {
    const cx = i % N, cz = (i / N) | 0; let best = 1e9, bt = 'corridor';
    for (const s of seeds) { const d = Math.hypot(s.x - cx, s.z - cz) * s.w; if (d < best) { best = d; bt = s.t; } }
    zone[i] = bt;
  }
  zone[0] = 'airlock'; zone[farI] = 'vault';
  return zone;
}
const zoneAt = (x, z) => lv.zone[cellOf(z) * lv.N + cellOf(x)];

/* ---------- Материалы и примитивы для реквизита ---------- */
const matCache = {};
const sm = (c, r = 0.8, m = 0.2) => matCache[`${c}_${r}_${m}`] || (matCache[`${c}_${r}_${m}`] = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }));
const bm = c => matCache['b' + c] || (matCache['b' + c] = new THREE.MeshBasicMaterial({ color: c }));
function mb(g, w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; }
function cyl(g, rt, rb, h, mat, x, y, z) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 10), mat); m.position.set(x, y, z); g.add(m); return m; }

const PROP_SIDE_LIMIT = 1.1;
function placeProp(name, cx, cz, side) {
  const g = new THREE.Group(), info = PROPS[name](g);
  const inx = -DX[side], inz = -DZ[side], th = Math.atan2(inx, inz);
  const px = (cx + 0.5) * CELL + DX[side] * (CELL / 2 - WALL_T / 2), pz = (cz + 0.5) * CELL + DZ[side] * (CELL / 2 - WALL_T / 2);
  const range = Math.max(0, PROP_SIDE_LIMIT - info.w / 2), a = rand(-range, range);
  g.position.set(px + a * Math.cos(th), 0, pz - a * Math.sin(th)); g.rotation.y = th;
  lvGroup.add(g); lv.propSides.add((cz * lv.N + cx) * 4 + side);
  const wx = inz !== 0 ? info.w : info.d, wz = inz !== 0 ? info.d : info.w;
  const ccx = g.position.x + inx * info.d / 2, ccz = g.position.z + inz * info.d / 2;
  lv.cols.push({ minX: ccx - wx / 2, maxX: ccx + wx / 2, minZ: ccz - wz / 2, maxZ: ccz + wz / 2 });
}
function placeProps() {
  const N = lv.N;
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const i = z * N + x; if (i === 0) continue;
    const zone = ZONES[lv.zone[i]];
    if (!zone.props.length || Math.random() > zone.pc) continue;
    const sides = shuffle([0, 1, 2, 3].filter(d => !canGo(x, z, d)));
    const n = Math.random() < 0.4 ? 2 : 1;
    for (let s = 0; s < Math.min(n, sides.length); s++) placeProp(pick(zone.props), x, z, sides[s]);
  }
}
function placeDecor() {
  const N = lv.N;
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const i = z * N + x; if (i === 0) continue;
    const zk = lv.zone[i], list = ZONE_DECOR[zk]; if (!list || !list.length) continue;
    const sides = shuffle([0, 1, 2, 3].filter(d => !canGo(x, z, d) && !lv.propSides.has(i * 4 + d)));
    let n = 0;
    for (const d of sides) {
      if (n >= 2 || Math.random() > 0.68) continue; n++;
      const g = new THREE.Group(), name = pick(list), info = WALL_DECOR[name](g, zk);
      const inx = -DX[d], inz = -DZ[d], th = Math.atan2(inx, inz);
      const px = (x + 0.5) * CELL + DX[d] * (CELL / 2 - WALL_T / 2), pz = (z + 0.5) * CELL + DZ[d] * (CELL / 2 - WALL_T / 2);
      const range = Math.max(0, (CELL - WALL_T) / 2 - info.w / 2 - 0.25), a = rand(-range, range);
      g.position.set(px + a * Math.cos(th), 0, pz - a * Math.sin(th)); g.rotation.y = th;
      lvGroup.add(g);
    }
  }
}
function buildZoneFloors() {
  const N = lv.N, by = {};
  for (let i = 0; i < N * N; i++) { const t = lv.zone[i]; if (t === 'corridor') continue; (by[t] = by[t] || []).push(i); }
  const mk = (list, y, tile, mat, local) => {
    const pos = [], uv = [], nor = [], idx = [];
    for (const i of list) {
      const x0 = (i % N) * CELL, z0 = ((i / N) | 0) * CELL, b = pos.length / 3;
      pos.push(x0, y, z0, x0 + CELL, y, z0, x0 + CELL, y, z0 + CELL, x0, y, z0 + CELL);
      const ux = local ? 0 : x0 / CELL * tile, uz = local ? 0 : z0 / CELL * tile;   // маркировка — по одной на клетку (UV 0..1), основа — бесшовная
      uv.push(ux, uz, ux + tile, uz, ux + tile, uz + tile, ux, uz + tile); nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
      idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.userData.keep = true; lvGroup.add(m);
  };
  for (const t of Object.keys(by)) {
    mk(by[t], 0.01, 2, zoneFloorMat(t));
    const mm = zoneMarkMat(t); if (mm) { const g = new THREE.Group(); mk(by[t].map(i => i), 0.016, 1, mm, true); }
  }
}

/* ---------- Лут ---------- */
function unreadNote() {
  const un = NOTES.map((_, i) => i).filter(i => !save.notes.includes(i) && !lv.notePlaced.has(i));
  if (!un.length) return -1;
  const n = pick(un); lv.notePlaced.add(n); return n;
}
function lootAmt(id, zk) {
  switch (id) {
    case 'food': return ri(1, zk === 'canteen' ? 3 : 2);
    case 'scrap': return ri(1, zk === 'warehouse' || zk === 'generator' ? 5 : 3);
    case 'wood': return ri(1, zk === 'warehouse' ? 4 : 3);
    case 'ammo': return ri(2, zk === 'armory' ? 8 : 5);
    case 'band': return ri(1, 2);
    case 'ammoR': return ri(2, 5);
    case 'ammoV': return ri(4, zk === 'armory' ? 14 : 8);
    case 'shells': return ri(2, 4);
    case 'fuel': return ri(6, 15);
    default: return 1;
  }
}
function rollLoot(zk, cap) {
  const w = Object.keys(ZONES[zk].loot).length ? ZONES[zk].loot : ZONES.corridor.loot, ids = Object.keys(w), tot = ids.reduce((a, k) => a + w[k], 0);
  const items = [], n = ri(1, 2) + (Math.random() < 0.35 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    let r = Math.random() * tot, id = ids[0];
    for (const k of ids) { r -= w[k]; if (r <= 0) { id = k; break; } }
    addTo(items, cap, id, lootAmt(id, zk));
  }
  if (Math.random() < 0.16 && items.length < cap) { const nt = unreadNote(); if (nt >= 0) items.push({ id: 'note', n: 1, ref: nt }); }
  return items;
}
function rollCorpse() {
  const items = [];
  if (Math.random() < 0.55) { const id = pick(['scrap', 'scrap', 'ammo', 'food', 'band', 'batt']); addTo(items, 3, id, lootAmt(id, 'corridor')); }
  if (Math.random() < 0.22) { const id = pick(['ammo', 'band', 'scrap']); addTo(items, 3, id, lootAmt(id, 'corridor')); }
  return items;
}

function makeContainer(kind, cx, cz) {
  const def = CONT[kind], D = def.d;
  const sx = Math.random() < 0.5 ? -1 : 1, sz = Math.random() < 0.5 ? -1 : 1;
  const x = (cx + 0.5) * CELL + (CELL / 2 - D[0] / 2 - 0.45) * sx, z = (cz + 0.5) * CELL + (CELL / 2 - D[2] / 2 - 0.45) * sz;
  const m = new THREE.Mesh(new THREE.BoxGeometry(D[0], D[1], D[2]), containerMat(kind, def.color));
  m.position.set(x, D[1] / 2, z); lvGroup.add(m);
  // детали фасада (лицом к центру клетки)
  const fz = -sz, fy = z + fz * (D[2] / 2 + 0.012), dark = sm(0x101214, .5, .5), steel = sm(0xaab0b4, .3, .8);
  const add = (w, h, d, mat, px, py, pz) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(px, py, pz); lvGroup.add(o); };
  if (kind === 'locker' || kind === 'medcab' || kind === 'fridge') {
    add(0.02, D[1] * 0.92, 0.02, dark, x, D[1] / 2, fy);
    add(0.03, kind === 'fridge' ? 0.5 : 0.14, 0.04, steel, x + 0.1, D[1] * 0.55, fy + fz * 0.02);
    if (kind === 'locker') for (let k = 0; k < 4; k++) add(D[0] * .5, 0.02, 0.01, dark, x - D[0] * .22, D[1] * 0.82 + k * 0.03, fy);
    if (kind === 'fridge') add(D[0] * .96, 0.02, 0.02, dark, x, D[1] * 0.68, fy);
  }
  if (kind === 'medcab') { add(0.32, 0.09, 0.012, bm(0xd02828), x - 0.2, D[1] * 0.78, fy + fz * 0.006); add(0.09, 0.32, 0.012, bm(0xd02828), x - 0.2, D[1] * 0.78, fy + fz * 0.006); }
  if (kind === 'cabinet') for (let k = 0; k < 3; k++) { add(D[0] * .86, 0.015, 0.012, dark, x, D[1] * (0.22 + k * 0.28), fy); add(0.2, 0.04, 0.03, steel, x, D[1] * (0.34 + k * 0.28), fy + fz * 0.014); }
  if (kind === 'crate' || kind === 'toolbox') {
    add(D[0] * 1.02, 0.08, D[2] * 1.02, sm(new THREE.Color(def.color).multiplyScalar(0.7).getHex(), .8, .3), x, D[1] - 0.04, z);
    add(D[0] * .96, 0.07, 0.012, dark, x, D[1] * .3, fy); add(D[0] * .96, 0.07, 0.012, dark, x, D[1] * .75, fy);
    if (kind === 'toolbox') add(0.35, 0.05, 0.02, bm(0xe8c040), x, D[1] * .5, fy + fz * .01);
  }
  if (kind === 'weapon') {
    add(D[0] * 1.02, 0.07, D[2] * 1.02, sm(0x2b3524, .8, .3), x, D[1] - 0.035, z);
    add(0.5, 0.1, 0.012, bm(0xe8c040), x, D[1] * .55, fy);
    add(0.1, 0.06, 0.05, steel, x - 0.45, D[1] * .8, fy + fz * 0.02); add(0.1, 0.06, 0.05, steel, x + 0.45, D[1] * .8, fy + fz * 0.02);
  }
  if (kind === 'vault') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 8, 20), sm(0xd0a040, .3, .8)); ring.position.set(x, D[1] * .52, fy + fz * .03); lvGroup.add(ring);
    for (let k = 0; k < 4; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.05, 0.05), sm(0xd0a040, .3, .8)); sp.position.set(x, D[1] * .52, fy + fz * .03); sp.rotation.z = k * Math.PI / 4; lvGroup.add(sp); }
    add(D[0] * 1.04, 0.1, D[2] * 1.04, sm(0x4a3810, .6, .6), x, 0.05, z);
  }
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({ color: kind === 'vault' ? 0xffb020 : 0xff7a1a }));
  led.position.set(x, D[1] + 0.12, z); lvGroup.add(led);
  const hx = D[0] / 2 + 0.05, hz = D[2] / 2 + 0.05;
  lv.cols.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
  return { kind: 'box', ckind: kind, name: def.name, cap: def.cap, x, z, searched: false, items: [], mesh: m, led, time: def.time, vault: false, corpse: false };
}
function updateLed(c) {
  if (!c.led) return;
  const col = !c.searched ? (c.vault ? (player.hasKey ? 0x40ff80 : 0xffb020) : (c.corpse ? 0xffcc40 : 0xff7a1a)) : (c.items.length ? 0x35c26a : 0x222222);
  c.led.material.color.setHex(col);
}
function makeCorpse(m) {
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffcc40 }));
  led.position.set(m.x, 0.45, m.z); lvGroup.add(led);
  const c = { kind: 'box', ckind: 'corpse', name: 'Тело: ' + m.cfg.name, cap: 3, x: m.x, z: m.z, searched: false, items: rollCorpse(), mesh: null, led, time: 1.0, vault: false, corpse: true };
  lv.items.push(c);
}

function buildLevel() {
  disposeLevel();
  lvGroup = new THREE.Group(); scene.add(lvGroup);
  const N = Math.min(12, 7 + Math.floor((save.day - 1) / 2));
  const H = Array.from({ length: N + 1 }, () => Array(N).fill(true));
  const V = Array.from({ length: N }, () => Array(N + 1).fill(true));
  const vis = Array.from({ length: N }, () => Array(N).fill(false));
  const st = [[0, 0]]; vis[0][0] = true;
  while (st.length) {
    const [x, z] = st[st.length - 1], nb = [];
    if (x > 0 && !vis[z][x - 1]) nb.push([x - 1, z]);
    if (x < N - 1 && !vis[z][x + 1]) nb.push([x + 1, z]);
    if (z > 0 && !vis[z - 1][x]) nb.push([x, z - 1]);
    if (z < N - 1 && !vis[z + 1][x]) nb.push([x, z + 1]);
    if (!nb.length) { st.pop(); continue; }
    const [nx, nz] = pick(nb);
    if (nx < x) V[z][x] = false; else if (nx > x) V[z][x + 1] = false; else if (nz < z) H[z][x] = false; else H[z + 1][x] = false;
    vis[nz][nx] = true; st.push([nx, nz]);
  }
  for (let i = 0; i < N * N * 0.3; i++) {
    if (Math.random() < 0.5) H[ri(1, N - 1)][ri(0, N - 1)] = false; else V[ri(0, N - 1)][ri(1, N - 1)] = false;
  }
  for (let i = 0; i < Math.floor(N / 2); i++) {
    const w = ri(2, 3), h = ri(2, 3), x = ri(0, N - w), z = ri(0, N - h);
    if (x === 0 && z === 0) continue;
    for (let dz = 0; dz < h; dz++) for (let dx = 1; dx < w; dx++) V[z + dz][x + dx] = false;
    for (let dz = 1; dz < h; dz++) for (let dx = 0; dx < w; dx++) H[z + dz][x + dx] = false;
  }

  lv = { N, H, V, walls: [], cols: [], items: [], monsters: [], lamps: [], pool: [], propSides: new Set(), parts: [], zone: [], curZone: '', projs: [], flames: [], notePlaced: new Set(), exp: Array.from({ length: N }, () => Array(N).fill(false)), time: 0, spawnT: 75, ambT: 12, vx: 0, vz: 0 };

  const dist = bfsDist(0, 0);
  let far = 0, farI = 1;
  dist.forEach((d, i) => { if (d > far) { far = d; farI = i; } });
  lv.vx = farI % N; lv.vz = Math.floor(farI / N);
  lv.zone = assignZones(N, farI);

  // Стены
  const wg = new Geo(), trim = new Geo(), signs = [];
  const addBoxWall = (x0, x1, z0, z1) => {
    wg.box((x0 + x1) / 2, WALL_H / 2, (z0 + z1) / 2, x1 - x0, WALL_H, z1 - z0, 1 / 3.3, 1 / WALL_H);
    const b = { minX: x0, maxX: x1, minZ: z0, maxZ: z1 };
    lv.walls.push(b); lv.cols.push(b);
  };
  for (let z = 0; z <= N; z++) for (let x = 0; x < N; x++) if (H[z][x]) addBoxWall(x * CELL - WALL_T / 2, (x + 1) * CELL + WALL_T / 2, z * CELL - WALL_T / 2, z * CELL + WALL_T / 2);
  for (let z = 0; z < N; z++) for (let x = 0; x <= N; x++) if (V[z][x]) addBoxWall(x * CELL - WALL_T / 2, x * CELL + WALL_T / 2, z * CELL - WALL_T / 2, (z + 1) * CELL + WALL_T / 2);

  // Гермопроёмы между зонами: стойки, перемычка, жёлтая окантовка, табличка
  const T = WALL_T, PW = 1.6, LH = 0.7, zn = (x, z) => lv.zone[z * N + x];
  for (let z = 1; z < N; z++) for (let x = 0; x < N; x++) {
    if (H[z][x]) continue;
    const a = zn(x, z - 1), b = zn(x, z); if (a === b) continue;
    const x0 = x * CELL, x1 = x0 + CELL, zc = z * CELL, mx = (x0 + x1) / 2;
    addBoxWall(x0 - T / 2, x0 + PW, zc - T / 2, zc + T / 2); addBoxWall(x1 - PW, x1 + T / 2, zc - T / 2, zc + T / 2);
    wg.box(mx, WALL_H - LH / 2, zc, CELL - 2 * PW, LH, T, 1 / 3.3, 1 / WALL_H, (WALL_H - LH) / WALL_H);
    trim.box(mx, WALL_H - LH - 0.03, zc, CELL - 2 * PW, 0.06, T + 0.08, 0.8, 1 / 0.06);
    signs.push({ x: mx, z: zc + T / 2 + 0.012, ry: 0, t: a }); signs.push({ x: mx, z: zc - T / 2 - 0.012, ry: Math.PI, t: b });
  }
  for (let z = 0; z < N; z++) for (let x = 1; x < N; x++) {
    if (V[z][x]) continue;
    const a = zn(x - 1, z), b = zn(x, z); if (a === b) continue;
    const xc = x * CELL, z0 = z * CELL, z1 = z0 + CELL, mz = (z0 + z1) / 2;
    addBoxWall(xc - T / 2, xc + T / 2, z0 - T / 2, z0 + PW); addBoxWall(xc - T / 2, xc + T / 2, z1 - PW, z1 + T / 2);
    wg.box(xc, WALL_H - LH / 2, mz, T, LH, CELL - 2 * PW, 1 / 3.3, 1 / WALL_H, (WALL_H - LH) / WALL_H);
    trim.box(xc, WALL_H - LH - 0.03, mz, T + 0.08, 0.06, CELL - 2 * PW, 0.8, 1 / 0.06);
    signs.push({ x: xc + T / 2 + 0.012, z: mz, ry: Math.PI / 2, t: a }); signs.push({ x: xc - T / 2 - 0.012, z: mz, ry: -Math.PI / 2, t: b });
  }
  const wallMesh = new THREE.Mesh(wg.build(), wallMat); wallMesh.userData.keep = true; wallMesh.castShadow = wallMesh.receiveShadow = true; lvGroup.add(wallMesh);
  const trimMesh = new THREE.Mesh(trim.build(), trimMat); trimMesh.userData.keep = true; trimMesh.receiveShadow = true; lvGroup.add(trimMesh);
  for (const s of signs) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.5), zoneSignMat(s.t));
    m.position.set(s.x, WALL_H - LH / 2, s.z); m.rotation.y = s.ry; lvGroup.add(m);
  }

  // Пол и потолок
  const S = N * CELL;
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(S, S), corridorFloorMat(S));
  fl.receiveShadow = true; fl.userData.keep = true;
  fl.rotation.x = -Math.PI / 2; fl.position.set(S / 2, 0, S / 2); lvGroup.add(fl);
  const ct = ceilTex.clone(); ct.needsUpdate = true; ct.repeat.set(S / 4, S / 4);
  const cl = new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.95 }));
  cl.userData.keep = true;
  cl.rotation.x = Math.PI / 2; cl.position.set(S / 2, WALL_H, S / 2); lvGroup.add(cl);
  buildZoneFloors();
  addFloorDetails(lvGroup, lv, CELL);
  // потолочные балки
  const ribs = new Geo();
  for (let i = 0; i <= N; i++) { ribs.box(S / 2, WALL_H - 0.12, i * CELL, S, 0.24, 0.32); ribs.box(i * CELL, WALL_H - 0.12, S / 2, 0.32, 0.24, S); }
  { const rm = new THREE.Mesh(ribs.build(), ribMat); rm.userData.keep = true; rm.castShadow = true; rm.receiveShadow = true; lvGroup.add(rm); }

  // Светильники: плафон есть в каждой клетке, горит лишь часть. Настоящий свет выдаётся пулом ближайших ламп.
  const cellsIdx = [];
  for (let i = 1; i < N * N; i++) if (i !== farI) cellsIdx.push(i);
  shuffle(cellsIdx);
  const nLit = Math.max(8, Math.round(N * N * 0.3));
  const litArr = cellsIdx.slice(0, nLit - 1); litArr.push(farI);
  const lit = new Set(litArr);
  for (let i = 1; i < N * N; i++) {
    const cx = (i % N + 0.5) * CELL, cz = (Math.floor(i / N) + 0.5) * CELL, zk = lv.zone[i];
    if (lit.has(i)) {
      const red = litArr.indexOf(i) < 3, lc = red ? 0xff2a18 : ZONES[zk].lamp, bad = !red && i !== farI && Math.random() < 0.4;
      const fx = addFixture(lvGroup, zk, red, cx, cz, WALL_H, red ? 0xff3a22 : lc, bad ? 'bad' : 'lit');
      lv.lamps.push({ x: cx, z: cz, y: fx.y, color: lc, base: red ? 30 : (i === farI ? 42 : 38), red, bad, ph: rand(0, 6), mesh: fx.mesh });
    } else addFixture(lvGroup, zk, false, cx, cz, WALL_H, 0, 'dead');
  }
  addFixture(lvGroup, 'corridor', false, CELL / 2, CELL / 2, WALL_H, 0xc8ffd8, 'lit');
  lv.pool = [];
  for (let k = 0; k < 8; k++) { const L = new THREE.PointLight(0xffffff, 0, 15, 2); L.position.set(0, WALL_H - 0.5, 0); lvGroup.add(L); lv.pool.push({ L, lamp: null, f: 0 }); }
  lvGroup.add(new THREE.HemisphereLight(0xcfe0f0, 0x3a2e24, 0.55));
  lv.dust = createDust(lvGroup);
  // Шлюз убежища (в стиле самого убежища)
  lv.door = buildAirlockDoor(lvGroup, CELL, WALL_T);
  lv.items.push({ kind: 'door', x: 1.2, z: CELL / 2, time: 0.7 });
  // Цветные полосы зон, потолочные короба
  wallStripes(lvGroup, lv, CELL, WALL_T);
  ceilingDecor(lvGroup, lv, CELL, WALL_H);

  // Трубы и мусор
  for (let i = 0; i < N * 2; i++) {
    const cx = ri(0, N - 1), cz = ri(0, N - 1), alongX = Math.random() < 0.5;
    const big = lv.zone[cz * N + cx] === 'generator';
    const m = new THREE.Mesh(new THREE.CylinderGeometry(big ? 0.2 : 0.11, big ? 0.2 : 0.11, CELL, 8), big ? sm(0x6a2a1c, .7, .5) : pipeMat);
    m.position.set((cx + 0.5) * CELL + (alongX ? 0 : rand(-2.4, 2.4)), WALL_H - 0.5, (cz + 0.5) * CELL + (alongX ? rand(-2.4, 2.4) : 0));
    if (alongX) m.rotation.z = Math.PI / 2; else m.rotation.x = Math.PI / 2;
    lvGroup.add(m);
  }
  const deb = new Geo();
  for (let i = 0; i < N * N * 2; i++) { const s = rand(0.2, 0.55); deb.box(rand(1, S - 1), s / 2, rand(1, S - 1), s, s, s * rand(.6, 1.3), 0.5); }
  { const dm = new THREE.Mesh(deb.build(), debrisMat); dm.userData.keep = true; dm.castShadow = dm.receiveShadow = true; lvGroup.add(dm); }
  for (let i = 0; i < N * 2; i++) addDecal(rand(1, S - 1), rand(1, S - 1), rand(1.2, 3));

  // Реквизит и настенный декор по зонам
  placeProps();
  placeDecor();

  // Контейнеры (у каждого — собственный инвентарь)
  const free = [];
  for (let i = 1; i < N * N; i++) if (i !== farI) free.push(i);
  shuffle(free);
  const nBoxes = Math.min(free.length, 10 + Math.floor(N * 1.5));
  const keyCandidates = free.slice(0, nBoxes).filter(i => dist[i] > far * 0.35);
  const keyCell = keyCandidates.length ? pick(keyCandidates) : free[0];
  for (let k = 0; k < nBoxes; k++) {
    const i = free[k], zk = lv.zone[i];
    const c = makeContainer(pick(ZONES[zk].cont), i % N, Math.floor(i / N));
    c.items = rollLoot(zk, c.cap);
    // деревянные ящики — главный источник древесины
    if (c.ckind === 'crate' && !c.items.some(it => it.id === 'wood') && Math.random() < 0.6) {
      if (c.items.length >= c.cap) c.items = c.items.filter(it => it.id !== 'note').slice(0, c.cap - 1);
      addTo(c.items, c.cap, 'wood', ri(2, 4));
    }
    if (i === keyCell) { c.items.unshift({ id: 'key', n: 1 }); if (c.items.length > c.cap) c.items.length = c.cap; }
    else if (Math.random() < 0.1) c.items = [];
    lv.items.push(c);
  }
  // Чертёж АС «Вал» — спрятан в одном из ящиков, пока его не принесли в убежище
  lv.bpPlaced = false;
  if (!save.blueprints.asval && Math.random() < 0.8) {
    const boxes = lv.items.filter(c => c.kind === 'box' && !c.items.some(it => it.id === 'key'));
    const pref = boxes.filter(c => ['crate', 'toolbox', 'weapon', 'cabinet'].includes(c.ckind));
    const tgt = pick(pref.length ? pref : boxes);
    if (tgt) {
      tgt.items = tgt.items.filter(it => it.id !== 'note');
      tgt.items.unshift({ id: 'bpVal', n: 1 });
      if (tgt.items.length > tgt.cap) tgt.items.length = tgt.cap;
      lv.bpPlaced = true;
    }
  }
  const vault = makeContainer('vault', lv.vx, lv.vz);
  vault.vault = true;
  addTo(vault.items, vault.cap, 'scrap', ri(7, 11)); addTo(vault.items, vault.cap, 'meds', 2); addTo(vault.items, vault.cap, 'band', 2);
  { const xa = pick(['ammoR', 'shells', 'fuel', 'ammoV']); addTo(vault.items, vault.cap, xa, lootAmt(xa, 'armory')); }
  addTo(vault.items, vault.cap, 'ammo', ri(8, 12)); addTo(vault.items, vault.cap, 'batt', 2); addTo(vault.items, vault.cap, 'food', 2); addTo(vault.items, vault.cap, 'wood', ri(3, 5));
  const nt = unreadNote(); if (nt >= 0) vault.items.push({ id: 'note', n: 1, ref: nt });
  lv.items.push(vault);
  for (const c of lv.items) if (c.kind === 'box') updateLed(c);

  // Склеиваем статику в крупные меши (быстрее рендер, особенно с тенями)
  bakeStatic(lvGroup, CELL * 3);

  // Монстры
  const mcount = Math.min(10, 3 + Math.floor(save.day * 0.8) + Math.floor(N / 4));
  const spawnCells = [];
  for (let i = 1; i < N * N; i++) if (dist[i] >= 4) spawnCells.push(i);
  for (let k = 0; k < mcount && spawnCells.length; k++) {
    const i = spawnCells.splice(Math.floor(Math.random() * spawnCells.length), 1)[0];
    spawnGroup(pickType(), (i % N + 0.5) * CELL + rand(-1.5, 1.5), (Math.floor(i / N) + 0.5) * CELL + rand(-1.5, 1.5));
  }
}
function pickType() {
  const d = save.day;
  const w = { walker: 100, runner: d >= 3 ? 40 : 0, brute: d >= 5 ? 16 : 0, spider: 28, rat: d >= 2 ? 22 : 0, spitter: d >= 3 ? 22 : 0, bloater: d >= 4 ? 16 : 0 };
  let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const k in w) { r -= w[k]; if (r < 0) return k; }
  return 'walker';
}
function addDecal(x, z, s) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), bloodMat);
  m.rotation.x = -Math.PI / 2; m.rotation.z = rand(0, 6.28); m.position.set(x, 0.025 + Math.random() * 0.005, z);
  lvGroup.add(m);
}

/* ====================== КОЛЛИЗИИ И ЛУЧИ ====================== */
function resolve(pos, r) {
  for (let it = 0; it < 2; it++) for (const b of lv.cols) {
    if (pos.x + r < b.minX || pos.x - r > b.maxX || pos.z + r < b.minZ || pos.z - r > b.maxZ) continue;
    const cx = Math.max(b.minX, Math.min(pos.x, b.maxX)), cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2), p = r - d; pos.x += dx / d * p; pos.z += dz / d * p; }
    else {
      const l = pos.x - b.minX, rr = b.maxX - pos.x, t = pos.z - b.minZ, bt = b.maxZ - pos.z, m = Math.min(l, rr, t, bt);
      if (m === l) pos.x = b.minX - r; else if (m === rr) pos.x = b.maxX + r; else if (m === t) pos.z = b.minZ - r; else pos.z = b.maxZ + r;
    }
  }
}
function rayBox(ox, oz, dx, dz, b, maxT) {
  let t0 = 0, t1 = maxT;
  if (Math.abs(dx) < 1e-9) { if (ox < b.minX || ox > b.maxX) return Infinity; }
  else { let a = (b.minX - ox) / dx, c = (b.maxX - ox) / dx; if (a > c) { const t = a; a = c; c = t; } t0 = Math.max(t0, a); t1 = Math.min(t1, c); }
  if (Math.abs(dz) < 1e-9) { if (oz < b.minZ || oz > b.maxZ) return Infinity; }
  else { let a = (b.minZ - oz) / dz, c = (b.maxZ - oz) / dz; if (a > c) { const t = a; a = c; c = t; } t0 = Math.max(t0, a); t1 = Math.min(t1, c); }
  return t0 > t1 ? Infinity : t0;
}
function losClear(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
  if (L < 0.01) return true;
  const ux = dx / L, uz = dz / L;
  for (const b of lv.walls) if (rayBox(ax, az, ux, uz, b, L) < L) return false;
  return true;
}
function rayCols(ox, oz, ux, uz, maxT) {
  let best = Infinity;
  for (const b of lv.cols) { const t = rayBox(ox, oz, ux, uz, b, maxT); if (t < best) best = t; }
  return best;
}
function raySphere(o, d, c, r) {
  const lx = c[0] - o.x, ly = c[1] - o.y, lz = c[2] - o.z, tca = lx * d.x + ly * d.y + lz * d.z;
  if (tca < 0) return null;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  if (d2 > r * r) return null;
  return tca - Math.sqrt(r * r - d2);
}

/* ====================== МОНСТРЫ ====================== */
function bx(w, h, d, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }
function buildMonster(type) {
  const c = MT[type];
  if (c.kind === 'spider') return buildSpider(c);
  if (c.kind === 'rat') return buildRat(c);
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const skin = new THREE.MeshStandardMaterial({ color: c.skin, roughness: 0.85 });
  const flesh = new THREE.MeshStandardMaterial({ color: 0x5c2a2a, roughness: 0.8 });
  const cloth = new THREE.MeshStandardMaterial({ color: pick(c.clothes), roughness: 0.95 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x25272c, roughness: 0.95 });
  const white = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.8 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffd34d });
  const mkLeg = x => { const l = new THREE.Group(); l.position.set(x, 0.85, 0); l.add(bx(0.2, 0.85, 0.22, pants, 0, -0.42, 0)); l.add(bx(0.22, 0.1, 0.32, flesh, 0, -0.85, 0.05)); g.add(l); return l; };
  const legL = mkLeg(-0.15), legR = mkLeg(0.15);
  const upper = new THREE.Group(); upper.position.set(0, 0.85, 0); g.add(upper);
  upper.add(bx(0.56, 0.72, 0.32, cloth, 0, 0.38, 0));
  upper.add(bx(0.3, 0.3, 0.02, flesh, 0.1, 0.4, 0.17));
  upper.add(bx(0.13, 0.09, 0.01, white, -0.14, 0.56, 0.165));
  const head = new THREE.Group(); head.position.set(0, 0.85, 0.06); upper.add(head);
  head.add(bx(0.26, 0.3, 0.28, skin, 0, 0.12, 0));
  head.add(bx(0.2, 0.09, 0.2, flesh, 0, -0.06, 0.05));
  head.add(bx(0.05, 0.035, 0.02, eyeMat, -0.07, 0.16, 0.145));
  head.add(bx(0.05, 0.035, 0.02, eyeMat, 0.07, 0.16, 0.145));
  if (Math.random() < 0.4) {
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.6 }));
    hat.position.set(0, 0.24, 0); head.add(hat);
  }
  const mkArm = x => {
    const a = new THREE.Group(); a.position.set(x, 0.68, 0);
    a.add(bx(0.15, 0.42, 0.15, cloth, 0, -0.2, 0)); a.add(bx(0.12, 0.55, 0.12, skin, 0, -0.65, 0)); a.add(bx(0.14, 0.16, 0.14, skin, 0, -0.98, 0));
    upper.add(a); return a;
  };
  const armL = mkArm(-0.37), armR = mkArm(0.37);
  if (type === 'brute') upper.scale.x = 1.35;
  g.scale.setScalar(c.scale);
  g.userData = { legL, legR, armL, armR, upper, head, eyeMat };
  if (type === 'spitter') { eyeMat.color.setHex(0xb6ff3a); decorateSpitter(upper, head, g.userData); }
  if (type === 'bloater') { eyeMat.color.setHex(0xff6a2a); decorateBloater(upper, head, g.userData); }
  return g;
}
function spawnMonster(type, x, z) {
  const mesh = buildMonster(type); mesh.traverse(o => { if (o.isMesh) o.castShadow = true; }); lvGroup.add(mesh);
  const c = MT[type];
  const m = { type, cfg: c, mesh, x, z, yaw: rand(0, 6.28), hp: c.hp, state: 'wander', wt: null, pause: rand(0, 2), cd: 0, stun: 0, lost: 0, lx: 0, lz: 0, tx: 0, tz: 0, arrived: false, wait: 0, phase: rand(0, 6), swing: 0, dead: false, fall: 0, pathT: 0, next: null, pcell: -1, off: rand(0, 6), groanT: rand(5, 12), wtT: 0, hx: 0, hz: 1, leap: 0, leapCD: rand(0, 2), leapDx: 0, leapDz: 0, leapV: 8, leapHit: false, air: 0, spitT: 0, spitCD: rand(0, 2), burn: 0, burnT: 0, exploded: false };
  lv.monsters.push(m); mesh.position.set(x, 0, z);
  return m;
}
function spawnGroup(type, x, z) {
  const n = MT[type].pack || 1, out = [];
  for (let i = 0; i < n; i++) out.push(spawnMonster(type, x + (n > 1 ? rand(-1.3, 1.3) : 0), z + (n > 1 ? rand(-1.3, 1.3) : 0)));
  return out;
}
function spheres(m) {
  const s = m.cfg.scale, k = m.cfg.kind, a = m.air || 0;
  if (k === 'spider') { const fx = Math.sin(m.yaw), fz = Math.cos(m.yaw); return [{ c: [m.x, 0.55 * s + a, m.z], r: 0.5 * s }, { c: [m.x + fx * 0.5 * s, 0.5 * s + a, m.z + fz * 0.5 * s], r: 0.3 * s, head: true }, { c: [m.x - fx * 0.5 * s, 0.6 * s + a, m.z - fz * 0.5 * s], r: 0.45 * s }]; }
  if (k === 'rat') return [{ c: [m.x, 0.2 * s, m.z], r: 0.3 * s }];
  const f = m.cfg.fat || 1;
  if (f > 1) return [{ c: [m.x, 1.55 * s, m.z], r: 0.26 * s, head: true }, { c: [m.x, 1.12 * s, m.z], r: 0.4 * s * f }, { c: [m.x, 0.6 * s, m.z], r: 0.32 * s }];
  return [{ c: [m.x, 1.55 * s, m.z], r: 0.26 * s, head: true }, { c: [m.x, 1.12 * s, m.z], r: 0.4 * s }, { c: [m.x, 0.6 * s, m.z], r: 0.32 * s }];
}
function alertNear(m) {
  for (const o of lv.monsters) {
    if (o === m || o.dead || o.state === 'chase') continue;
    if (Math.hypot(o.x - m.x, o.z - m.z) < 16) { o.state = 'investigate'; o.tx = player.x; o.tz = player.z; o.arrived = false; }
  }
}
function stepToward(m, gx, gz, speed, dt) {
  const mc = cellOf(m.x), mz = cellOf(m.z), tc = cellOf(gx), tz = cellOf(gz);
  let px = gx, pz = gz;
  if (mc !== tc || mz !== tz) {
    m.pathT -= dt; const key = mc * 64 + mz;
    if (m.pathT <= 0 || m.pcell !== key) { m.next = bfsNext(mc, mz, tc, tz); m.pathT = 0.4; m.pcell = key; }
    if (m.next) { px = (m.next[0] + 0.5) * CELL; pz = (m.next[1] + 0.5) * CELL; }
  }
  const dx = px - m.x, dz = pz - m.z, d = Math.hypot(dx, dz);
  if (d < 0.02) return 0;
  const step = Math.min(d, speed * dt), ox = m.x, oz = m.z;
  m.x += dx / d * step; m.z += dz / d * step; resolve(m, 0.42);
  m.hx = dx / d; m.hz = dz / d;
  return Math.hypot(m.x - ox, m.z - oz);
}
function updateMonster(m, dt) {
  const cfg = m.cfg, p = player, ud = m.mesh.userData;
  if (m.dead) {
    m.fall = Math.min(1, m.fall + dt * 2.2);
    if (ud.die) { ud.die(m.fall); m.mesh.position.y = 0; return; }
    m.mesh.rotation.x = -m.fall * 1.5; m.mesh.position.y = 0.12 * m.fall; return;
  }
  m.cd = Math.max(0, m.cd - dt); m.stun = Math.max(0, m.stun - dt);
  if (m.burn > 0) {
    m.burn -= dt; m.burnT -= dt;
    const sc = m.cfg.scale;
    if (Math.random() < dt * 14) flameP(m.x + rand(-0.25, 0.25), rand(0.2, 1.5) * sc, m.z + rand(-0.25, 0.25), 0, 1.6, 0, 0.5, 0.55 * sc);
    if (m.burnT <= 0) { m.burnT = 0.3; hurtMonster(m, 2.6, m.x, 1, m.z, true); if (m.dead) return; }
  }
  const dx = p.x - m.x, dz = p.z - m.z, dist = Math.hypot(dx, dz);
  let los = null; const getLos = () => (los === null ? (los = losClear(m.x, m.z, p.x, p.z)) : los);
  let sees = false;
  const sr = cfg.sight * (p.flash ? 1 : 0.45) * (p.crouch ? 0.7 : 1);
  if (dist < sr) {
    const dot = (dx * Math.sin(m.yaw) + dz * Math.cos(m.yaw)) / (dist || 1);
    if ((dot > 0.1 || dist < 3.5) && getLos()) sees = true;
  }
  const hearR = p.noise * cfg.hear * (dist < 45 && getLos() ? 1 : 0.55);
  if (sees) {
    if (m.state !== 'chase') { m.state = 'chase'; voice(m, dist, clamp(Math.sin(Math.atan2(m.x - p.x, m.z - p.z) - p.yaw) * -1, -1, 1)); alertNear(m); }
    m.lost = 0; m.lx = p.x; m.lz = p.z;
  } else if (m.state === 'chase') {
    m.lost += dt;
    if (m.lost > 4 || Math.hypot(m.lx - m.x, m.lz - m.z) < 1) { if (m.lost > 1.5) { m.state = 'investigate'; m.tx = m.lx; m.tz = m.lz; m.arrived = false; } }
  } else if (dist < hearR) {
    if (m.state !== 'investigate' || Math.hypot(m.tx - p.x, m.tz - p.z) > 3) { m.state = 'investigate'; m.tx = p.x; m.tz = p.z; m.arrived = false; }
  }

  let speed = 0, gx = m.x, gz = m.z;
  if (m.stun > 0) speed = 0;
  else if (m.state === 'chase') {
    gx = sees ? p.x : m.lx; gz = sees ? p.z : m.lz; speed = cfg.chase;
    if (sees && (dist < cfg.range * 0.85 || (cfg.spit && dist < cfg.spit.keep))) speed = 0;
  } else if (m.state === 'investigate') {
    gx = m.tx; gz = m.tz;
    if (Math.hypot(gx - m.x, gz - m.z) < 1.5) {
      if (!m.arrived) { m.arrived = true; m.wait = rand(2, 4); }
      m.wait -= dt;
      if (m.wait <= 0) { m.state = 'wander'; m.wt = null; m.pause = 0; }
    } else speed = cfg.walk * 1.6;
  } else {
    if (m.pause > 0) m.pause -= dt;
    else {
      m.wtT += dt;
      if (!m.wt || m.wtT > 16) {
        const cx = clamp(cellOf(m.x) + ri(-4, 4), 0, lv.N - 1), cz = clamp(cellOf(m.z) + ri(-4, 4), 0, lv.N - 1);
        m.wt = { x: (cx + 0.5) * CELL + rand(-1.5, 1.5), z: (cz + 0.5) * CELL + rand(-1.5, 1.5) }; m.wtT = 0;
      }
      gx = m.wt.x; gz = m.wt.z; speed = cfg.walk;
      if (Math.hypot(gx - m.x, gz - m.z) < 1.3) { m.wt = null; m.pause = rand(0.5, 3.5); speed = 0; }
    }
  }
  if (cfg.leapDur) {
    m.leapCD -= dt;
    if (m.leap > 0) {
      speed = 0; m.leap -= dt;
      const prog = clamp(1 - m.leap / cfg.leapDur, 0, 1);
      m.x += m.leapDx * m.leapV * dt; m.z += m.leapDz * m.leapV * dt; resolve(m, 0.42);
      m.yaw = Math.atan2(m.leapDx, m.leapDz); m.air = Math.sin(prog * Math.PI) * 1.0;
      if (!m.leapHit && Math.hypot(p.x - m.x, p.z - m.z) < 1.4 && m.air < 1.7) { m.leapHit = true; hurtPlayer(cfg.dmg * rand(0.9, 1.3)); }
      if (m.leap <= 0) { m.air = 0; m.cd = Math.max(m.cd, 0.5); }
    } else if (sees && m.state === 'chase' && m.leapCD <= 0 && m.stun <= 0 && dist > 2.6 && dist < 7.5 && getLos()) {
      m.leap = cfg.leapDur; m.leapCD = cfg.leapCD + rand(0, 1.5); m.leapHit = false;
      m.leapDx = dx / dist; m.leapDz = dz / dist; m.leapV = clamp((dist + 0.4) / cfg.leapDur, 6, 15);
      voice(m, dist, 0); speed = 0;
    }
  }
  let moved = 0;
  if (speed > 0) moved = stepToward(m, gx, gz, speed, dt);
  if (m.leap > 0) moved = 0.001;
  for (const o of lv.monsters) {
    if (o === m || o.dead) continue;
    const ox = m.x - o.x, oz = m.z - o.z, od = Math.hypot(ox, oz);
    if (od < 0.9 && od > 0.001) { m.x += ox / od * (0.9 - od) * 0.5; m.z += oz / od * (0.9 - od) * 0.5; }
  }
  if (m.state === 'chase' && sees) m.yaw = turn(m.yaw, Math.atan2(dx, dz), dt * 6);
  else if (moved > 0) m.yaw = turn(m.yaw, Math.atan2(m.hx, m.hz), dt * 4);

  if (sees && dist < cfg.range && m.cd <= 0 && m.swing <= 0 && m.stun <= 0 && m.leap <= 0) { m.swing = cfg.swing || 0.4; m.cd = cfg.cd; }
  if (m.swing > 0) {
    m.swing -= dt;
    if (m.swing <= 0) {
      if (cfg.explode) { m.hp = 0; m.dead = true; m.mesh.userData.eyeMat.color.setHex(0); explodeMonster(m); return; }
      if (Math.hypot(p.x - m.x, p.z - m.z) < cfg.range + 0.6) hurtPlayer(cfg.dmg * rand(0.8, 1.2));
    }
  }
  if (cfg.spit) {
    m.spitCD -= dt;
    if (m.spitT > 0) { m.spitT -= dt; if (m.spitT <= 0 && m.stun <= 0) fireSpit(m); }
    else if (sees && m.stun <= 0 && m.spitCD <= 0 && dist >= cfg.spit.min && dist <= cfg.spit.max && getLos()) {
      m.spitT = 0.55; m.spitCD = cfg.spit.cd + rand(0, 1.2); m.yaw = Math.atan2(dx, dz); gurgle(dist, 0);
    }
  }
  m.groanT -= dt;
  if (m.groanT <= 0) {
    m.groanT = m.state === 'chase' ? rand(2.5, 5) : rand(9, 18);
    const ang = Math.atan2(m.x - p.x, m.z - p.z) - p.yaw;
    voice(m, dist, clamp(-Math.sin(ang), -1, 1));
  }
  m.phase += moved * 2.6;
  const amp = clamp(moved / dt / 2.6, 0, 1);
  if (ud.anim) { ud.anim(m, amp, m.state === 'chase', time); m.mesh.position.set(m.x, m.air || 0, m.z); m.mesh.rotation.y = m.yaw; return; }
  ud.legL.rotation.x = Math.sin(m.phase) * 0.8 * amp;
  ud.legR.rotation.x = -Math.sin(m.phase) * 0.8 * amp;
  const chase = m.state === 'chase';
  ud.upper.rotation.x = cfg.hunch + (chase ? 0.15 : 0);
  let ax = (chase ? cfg.arm : -0.3) + Math.sin(time * 1.5 + m.off) * 0.08;
  if (m.swing > 0) { const t = 1 - m.swing / 0.4; ax = -2.0 + t * 2.4; }
  ud.armL.rotation.x = ax + Math.sin(m.phase + Math.PI) * 0.4 * amp;
  ud.armR.rotation.x = ax - Math.sin(m.phase + Math.PI) * 0.4 * amp;
  ud.armL.rotation.z = 0.1; ud.armR.rotation.z = -0.1;
  ud.head.rotation.y = chase ? 0 : Math.sin(time * 0.7 + m.off) * 0.4;
  ud.head.rotation.z = Math.sin(time * 3.1 + m.off) * 0.1;
  if (ud.belly) {
    const sp = m.swing > 0 ? 20 : 3 + (1 - clamp(dist / 10, 0, 1)) * 6, pz = 0.5 + 0.5 * Math.sin(time * sp + m.off);
    ud.belly.emissiveIntensity = 0.3 + pz * 1.3; ud.core.scale.setScalar(0.9 + pz * 0.2); ud.bellyMesh.scale.set(1.15 + pz * 0.04, 1 + pz * 0.05, 1.05 + pz * 0.04);
  }
  if (ud.sacMat) {
    ud.sacMat.emissiveIntensity = 0.7 + 0.4 * Math.sin(time * 4 + m.off) + (m.spitT > 0 ? 1.2 : 0);
    ud.mouth.scale.y = m.spitT > 0 ? 2.6 : 1; if (m.spitT > 0) { ud.armL.rotation.x = ud.armR.rotation.x = -1.4; ud.head.rotation.x = -0.35; } else ud.head.rotation.x = 0;
    for (let i = 0; i < ud.sacs.length; i++) ud.sacs[i].scale.setScalar(1 + Math.sin(time * 5 + i * 2 + m.off) * 0.07);
  }
  m.mesh.position.set(m.x, Math.abs(Math.sin(m.phase)) * 0.05 * amp, m.z);
  m.mesh.rotation.y = m.yaw;
}

/* ====================== БОЙ ====================== */
function hurtPlayer(d) {
  const p = player;
  p.hp -= d; p.shake = Math.max(p.shake, 1.2); p.burst = Math.max(p.burst, 14); p.hurtFlash = 1;
  sfx.hurt(); $('dmg').style.transition = 'none'; $('dmg').style.opacity = 0.9;
  requestAnimationFrame(() => { $('dmg').style.transition = 'opacity .5s'; $('dmg').style.opacity = 0; });
  p.prog = 0;
  if (p.hp <= 0) { p.hp = 0; endSortie('dead'); }
}
function spawnParts(x, y, z, n, color, speed, life) {
  for (let i = 0; i < n; i++) {
    let pt = lv.parts.find(q => q.life <= 0);
    if (!pt) {
      if (lv.parts.length > 90) break;
      const mat = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), mat);
      lvGroup.add(mesh); pt = { mesh, mat, vx: 0, vy: 0, vz: 0, life: 0 }; lv.parts.push(pt);
    }
    pt.mat.color.setHex(color); pt.mesh.visible = true; pt.mesh.position.set(x, y, z);
    pt.vx = rand(-1, 1) * speed; pt.vy = rand(0, 1) * speed; pt.vz = rand(-1, 1) * speed; pt.life = life * rand(0.6, 1);
  }
}
function updateParts(dt) {
  for (const q of lv.parts) {
    if (q.life <= 0) continue;
    q.life -= dt; q.vy -= 9 * dt;
    q.mesh.position.x += q.vx * dt; q.mesh.position.y += q.vy * dt; q.mesh.position.z += q.vz * dt;
    if (q.mesh.position.y < 0.03) { q.mesh.position.y = 0.03; q.vx = q.vy = q.vz = 0; }
    if (q.life <= 0) q.mesh.visible = false;
  }
}
function hurtMonster(m, dmg, hx, hy, hz, fire) {
  if (m.dead) return;
  m.hp -= dmg;
  if (!fire) { spawnParts(hx, hy, hz, 10, m.cfg.kind === 'spider' || m.cfg.voice === 'gurgle' ? 0x4f8a1e : 0x7a0e0e, 2.5, 0.8); sfx.hit(); }
  $('cross').classList.add('hit'); setTimeout(() => $('cross').classList.remove('hit'), 120);
  if (m.hp <= 0) {
    m.dead = true; m.burn = 0; m.mesh.userData.eyeMat.color.setHex(0x000000);
    player.kills++; save.kills++; addDecal(m.x, m.z, m.cfg.scale < 1 ? 1.3 : 2.6);
    if (!save.bestiary) save.bestiary = {};
    const firstKill = !save.bestiary[m.type];
    save.bestiary[m.type] = (save.bestiary[m.type] || 0) + 1;
    if (firstKill) { store(); setTimeout(() => toast('📕 Новая запись в альманахе: ' + m.cfg.name + ' (стол в убежище)', 'info'), 900); }
    if (!m.cfg.noLoot && !m.cfg.explode) makeCorpse(m);
    toast((m.cfg.kind && m.cfg.kind !== 'human' ? 'Убит: ' : 'Бывший убит: ') + m.cfg.name, 'good'); sfx.thud();
    if (m.cfg.explode) explodeMonster(m);
  } else {
    if (!fire) m.stun = 0.18;
    if (m.state !== 'chase') { m.state = 'chase'; m.lost = 0; m.lx = player.x; m.lz = player.z; alertNear(m); }
  }
}
/* ---------- Огонь, взрывы, плевки ---------- */
const FLAME_COLS = [new THREE.Color(0xfff1a8), new THREE.Color(0xff9a28), new THREE.Color(0xe0420a), new THREE.Color(0x1a0802)];
let flameGeo = null;
function flameP(x, y, z, vx, vy, vz, life, size) {
  if (!lv || !lvGroup) return;
  if (!flameGeo) flameGeo = new THREE.IcosahedronGeometry(0.5, 0);
  let q = lv.flames.find(f => f.life <= 0);
  if (!q) {
    if (lv.flames.length > 140) return;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const mesh = new THREE.Mesh(flameGeo, mat); lvGroup.add(mesh);
    q = { mesh, mat, life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 1, spin: 0 }; lv.flames.push(q);
  }
  q.life = q.max = life * rand(0.8, 1.15); q.size = size; q.vx = vx; q.vy = vy; q.vz = vz; q.spin = rand(-4, 4);
  q.mesh.position.set(x, y, z); q.mesh.visible = true; q.mesh.rotation.set(rand(0, 6), rand(0, 6), 0);
}
function updateFlames(dt) {
  for (const q of lv.flames) {
    if (q.life <= 0) continue;
    q.life -= dt;
    if (q.life <= 0) { q.mesh.visible = false; continue; }
    const t = 1 - q.life / q.max, k = Math.max(0, 1 - 2.2 * dt);
    q.vx *= k; q.vy = q.vy * k + 1.8 * dt; q.vz *= k;
    q.mesh.position.x += q.vx * dt; q.mesh.position.y += q.vy * dt; q.mesh.position.z += q.vz * dt;
    q.mesh.scale.setScalar(q.size * (0.45 + t * 1.5)); q.mesh.rotation.x += q.spin * dt;
    const c = q.mat.color;
    if (t < 0.25) c.copy(FLAME_COLS[0]).lerp(FLAME_COLS[1], t / 0.25);
    else if (t < 0.6) c.copy(FLAME_COLS[1]).lerp(FLAME_COLS[2], (t - 0.25) / 0.35);
    else c.copy(FLAME_COLS[2]).lerp(FLAME_COLS[3], (t - 0.6) / 0.4);
    q.mat.opacity = 0.95 * (1 - t * t);
  }
}
function fireFlame() {
  const p = player;
  p.burst = Math.max(p.burst, 30); p.flashT = 0.12; p.shake = Math.max(p.shake, 0.08); sfx.flame();
  camera.getWorldDirection(_dir);
  const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
  const ox = camera.position.x + _dir.x * 0.75 + rx * 0.16, oy = camera.position.y + _dir.y * 0.75 - 0.2, oz = camera.position.z + _dir.z * 0.75 + rz * 0.16;
  const fe = aimE(), fsp = 1 - 0.6 * fe;   // при прицеливании струя уже и бьёт дальше
  for (let i = 0; i < 5; i++) {
    const sp = rand(14, 19) * (1 + 0.15 * fe);
    flameP(ox, oy, oz, _dir.x * sp + rand(-1.4, 1.4) * fsp, _dir.y * sp + rand(-1, 1.4) * fsp, _dir.z * sp + rand(-1.4, 1.4) * fsp, 0.5, rand(0.35, 0.6));
  }
  const hc = Math.hypot(_dir.x, _dir.z) || 1e-6, fx = _dir.x / hc, fz = _dir.z / hc;
  for (const m of lv.monsters) {
    if (m.dead) continue;
    const dx = m.x - p.x, dz = m.z - p.z, d = Math.hypot(dx, dz);
    if (d > 6.4 + 2 * fe) continue;
    if (d > 1.1 && (dx * fx + dz * fz) / d < 0.84 + 0.09 * fe) continue;
    if (!losClear(p.x, p.z, m.x, m.z)) continue;
    m.burn = 3.4;
    hurtMonster(m, 6.5, m.x, 1, m.z, true);
    if (!m.dead) { m.x += fx * 0.05; m.z += fz * 0.05; }
  }
}
function explodeMonster(m) {
  if (m.exploded) return;
  m.exploded = true; m.mesh.visible = false;
  const R = m.cfg.explode.r, p = player;
  for (let i = 0; i < 16; i++) { const a = rand(0, 6.28), sp = rand(2, 7); flameP(m.x, rand(0.5, 1.4), m.z, Math.cos(a) * sp, rand(0.5, 3), Math.sin(a) * sp, 0.8, rand(0.9, 1.7)); }
  spawnParts(m.x, 1, m.z, 30, 0xff8a2a, 6, 0.9); spawnParts(m.x, 1, m.z, 16, 0x7a2a0e, 5, 1.1);
  addDecal(m.x, m.z, 4.8); sfx.boom();
  const d = Math.hypot(p.x - m.x, p.z - m.z);
  if (d < R && losClear(m.x, m.z, p.x, p.z)) hurtPlayer(m.cfg.explode.dmg * (1 - (d / R) * 0.6));
  p.shake = Math.max(p.shake, clamp(3 - d * 0.25, 0, 3)); p.burst = Math.max(p.burst, 60);
  for (const o of lv.monsters) {
    if (o === m || o.dead) continue;
    const od = Math.hypot(o.x - m.x, o.z - m.z);
    if (od < R && losClear(m.x, m.z, o.x, o.z)) { o.burn = 2.5; hurtMonster(o, 75 * (1 - (od / R) * 0.5), o.x, 1, o.z, true); if (!o.dead) o.stun = 0.5; }
  }
  alertNear(m);
}
function fireSpit(m) {
  const p = player, sc = m.cfg.scale;
  const ox = m.x + Math.sin(m.yaw) * 0.4, oz = m.z + Math.cos(m.yaw) * 0.4, oy = 1.35 * sc;
  const ty = Math.max(0.55, p.eye - 0.35), dx = p.x - ox, dz = p.z - oz, dy = ty - oy, L = Math.hypot(dx, dy, dz) || 1, sp = 9.5;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0xa6ff3a, fog: false }));
  mesh.position.set(ox, oy, oz); lvGroup.add(mesh);
  lv.projs.push({ mesh, x: ox, y: oy, z: oz, vx: dx / L * sp, vy: dy / L * sp, vz: dz / L * sp, life: 3, dmg: m.cfg.spit.dmg, tr: 0 });
  sfx.spit();
}
function updateProjs(dt) {
  const p = player;
  for (let i = lv.projs.length - 1; i >= 0; i--) {
    const q = lv.projs[i], nx = q.x + q.vx * dt, ny = q.y + q.vy * dt, nz = q.z + q.vz * dt;
    q.life -= dt; let dead = q.life <= 0 || ny < 0.05 || ny > 3.3, hit = false;
    if (!dead) {
      const dl = Math.hypot(nx - q.x, nz - q.z);
      if (dl > 1e-6 && (rayCols(q.x, q.z, (nx - q.x) / dl, (nz - q.z) / dl, dl) < dl || !losClear(q.x, q.z, nx, nz))) dead = true;
    }
    if (!dead && Math.hypot(nx - p.x, nz - p.z) < 0.55 && ny > p.eye - 1.45 && ny < p.eye + 0.25) { hit = true; dead = true; }
    q.x = nx; q.y = ny; q.z = nz; q.mesh.position.set(nx, ny, nz);
    q.tr -= dt; if (q.tr <= 0) { q.tr = 0.05; spawnParts(nx, ny, nz, 1, 0x7dff3a, 0.4, 0.35); }
    if (dead) {
      spawnParts(nx, ny, nz, 9, 0x7dff3a, 2.4, 0.5);
      lvGroup.remove(q.mesh); q.mesh.geometry.dispose(); q.mesh.material.dispose(); lv.projs.splice(i, 1);
      if (hit) { hurtPlayer(q.dmg); toast('Кислота!', 'bad'); }
    }
  }
}
const _dir = new THREE.Vector3();
const SHOT = {
  pistol: { burst: 42, kick: 1, shake: 0.25, pitch: 0.018, sp: 0.012, csp: 0.004, pellets: 1, pierce: 1 },
  rifle: { burst: 62, kick: 1.7, shake: 0.6, pitch: 0.034, sp: 0.004, csp: 0.0008, pellets: 1, pierce: 2 },
  shotgun: { burst: 64, kick: 2.1, shake: 0.9, pitch: 0.05, sp: 0.06, csp: 0.045, pellets: 7, pierce: 1 },
  asval: { burst: 11, kick: 0.55, shake: 0.12, pitch: 0.0075, sp: 0.016, csp: 0.006, pellets: 1, pierce: 1 }
};
function shoot() {
  const p = player, W = cw();
  if (W.melee) { melee(); return; }
  if (p.weapon === 'shotgun' && p.reloadT > 0 && p.mag > 0 && p.gunCD <= 0) p.reloadT = 0;   // можно прервать зарядку выстрелом
  if (p.gunCD > 0 || p.reloadT > 0 || p.swingT > 0) return;
  if (p.mag <= 0) {
    p.gunCD = 0.3; WA.dry(p.weapon);
    if (bagCount(W.ammo) > 0) reload();
    else toast(`${ITEMS[W.ammo].name}: закончились! ${p.weapon === 'pistol' ? `Бейте ${WEAPONS[p.melee].name.toLowerCase()} (${bindName('melee')})` : 'Смените оружие (' + bindName('w1') + '–' + bindName('w3') + ')'}`, 'bad');
    return;
  }
  p.mag--; p.gunCD = W.cd;
  if (p.weapon === 'flame') { fireFlame(); if (p.mag === 0 && bagCount(W.ammo) > 0) toast(`Бак пуст — ${bindName('reload')}`, 'info'); return; }
  const id = p.weapon, S = SHOT[id], ae = aimE(), AM = AIM[id];
  p.burst = Math.max(p.burst, S.burst); p.kick = S.kick * (1 - 0.35 * ae); p.flashT = 0.06; p.shake = Math.max(p.shake, S.shake * (1 - 0.4 * ae));
  p.pitch += S.pitch * (1 - (1 - AM.recoil) * ae) * (id === 'asval' ? rand(0.6, 1.4) : 1); p.yaw += id === 'asval' ? rand(-0.0025, 0.0025) : 0; sfx[id === 'pistol' ? 'shot' : id]();
  if (id === 'rifle') { p.cycleDelay = 0.12; p.cycleT = 0; p.cycleDur = 0.9; } else if (id === 'shotgun') { p.cycleDelay = 0.2; p.cycleT = 0; p.cycleDur = 0.62; }
  camera.getWorldDirection(_dir);
  const base = _dir.clone(), o = camera.position, sp = (p.crouch ? S.csp : S.sp) * (1 - (1 - AM.spread) * ae), hits = new Map();
  for (let k = 0; k < S.pellets; k++) {
    const d = base.clone();
    d.x += rand(-sp, sp); d.y += rand(-sp, sp); d.z += rand(-sp, sp); d.normalize();
    const hc = Math.hypot(d.x, d.z) || 1e-6;
    const wd = rayCols(o.x, o.z, d.x / hc, d.z / hc, 70) / hc;
    const list = [];
    for (const m of lv.monsters) {
      if (m.dead) continue;
      let bt = Infinity, bh = false;
      for (const sph of spheres(m)) { const t = raySphere(o, d, sph.c, sph.r); if (t !== null && t < bt) { bt = t; bh = !!sph.head; } }
      if (bt < Infinity) list.push({ m, t: bt, head: bh });
    }
    list.sort((x, y) => x.t - y.t);
    let n = 0;
    for (const h of list) {
      if (h.t >= wd || n >= S.pierce) break;
      let dm = id === 'rifle' ? (h.head ? 230 : 100) : id === 'shotgun' ? (h.head ? 32 : 17) * clamp(1.3 - h.t / 15, 0.22, 1) : (id === 'asval' ? (h.head ? 64 : 24) : (h.head ? 95 : 34));
      if (n > 0) dm *= 0.6;
      const a = hits.get(h.m) || { dmg: 0, x: 0, y: 0, z: 0, dx: d.x, dz: d.z };
      a.dmg += dm; a.x = o.x + d.x * h.t; a.y = o.y + d.y * h.t; a.z = o.z + d.z * h.t; hits.set(h.m, a); n++;
    }
    if (!n && wd < 70 && k === 0) WA.wall();
    if (!n && wd < 70) spawnParts(o.x + d.x * wd, o.y + d.y * wd, o.z + d.z * wd, id === 'shotgun' ? 2 : 5, 0xffcf80, 2, 0.35);
  }
  for (const [m, a] of hits) {
    hurtMonster(m, a.dmg, a.x, a.y, a.z);
    if (id === 'shotgun' && !m.dead) { m.stun = 0.4; m.x += a.dx * 0.5; m.z += a.dz * 0.5; resolve(m, 0.42); }
    if (id === 'rifle' && !m.dead) m.stun = 0.3;
  }
  if (p.mag === 0 && bagCount(W.ammo) > 0) toast(`Магазин пуст — ${bindName('reload')}`, 'info');
}
function reload() {
  const p = player, W = cw();
  if (W.melee || p.reloadT > 0 || p.mag >= W.mag || bagCount(W.ammo) <= 0) return false;
  let dur = W.reload;
  if (p.weapon === 'shotgun') { const n = Math.min(W.mag - p.mag, bagCount(W.ammo)); p.reloadN = n; dur = 0.35 + n * 0.42 + 0.6; }
  p.reloadT = p.reloadMax = dur; p.cycleT = -1; p.cycleDelay = 0; return true;
}
function melee() {
  const p = player, id = p.melee, M = MELEE[id];
  if (p.meleeCD > 0 || p.reloadT > 0) return;
  p.meleeCD = M.cd; p.swingT = p.swingMax = M.swing; p.burst = Math.max(p.burst, M.noise); sfx.swing(id);
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), targets = [];
  for (const m of lv.monsters) {
    if (m.dead) continue;
    const dx = m.x - p.x, dz = m.z - p.z, d = Math.hypot(dx, dz);
    if (d < M.range * Math.max(1, m.cfg.scale * 0.8) && (dx * fx + dz * fz) / (d || 1) > M.dot && losClear(p.x, p.z, m.x, m.z)) targets.push({ m, d });
  }
  targets.sort((a, b) => a.d - b.d);
  let sneakKills = 0;
  for (const { m } of targets.slice(0, M.hits)) {
    const unaware = M.sneak && m.state !== 'chase', dmg = unaware ? M.dmg * M.sneak : M.dmg;
    hitKind = id; hurtMonster(m, dmg, m.x, 1.2, m.z); hitKind = null;
    if (unaware && m.dead) sneakKills++;
    if (!m.dead) { m.stun = M.stun; m.x += fx * M.push; m.z += fz * M.push; resolve(m, 0.42); }
    p.shake = Math.max(p.shake, 0.4);
  }
  if (sneakKills) { p.burst = Math.min(p.burst, 5); toast('🔪 Бесшумное убийство', 'good'); }
}
function applyHeal(id) {
  const p = player;
  p.hp = Math.min(p.maxHp, p.hp + HEAL[id]); sfx.heal();
  toast(`${ITEMS[id].name}: +${HEAL[id]} здоровья`, 'good');
}
function heal() {
  const p = player;
  if (p.hp >= p.maxHp) { toast('Здоровье полное', 'info'); return; }
  const miss = p.maxHp - p.hp, b = bagCount('band'), m = bagCount('meds');
  let id = null;
  if (b > 0 && (miss <= 30 || m === 0)) id = 'band'; else if (m > 0) id = 'meds';
  if (!id) { toast('Нет аптечек и бинтов', 'bad'); return; }
  bagRemove(id, 1); applyHeal(id); invChanged();
}
function toggleFlash() {
  const p = player;
  if (!p.flash && p.batt <= 0 && bagCount('batt') <= 0) { toast('Нет батарей', 'bad'); return; }
  p.flash = !p.flash; sfx.empty();
  if (p.flash && p.batt <= 0) swapBattery();
}
function swapBattery() {
  const p = player;
  if (bagCount('batt') > 0) { bagRemove('batt', 1); p.batt = 100; toast('Батарея фонаря заменена', 'info'); invChanged(); return true; }
  return false;
}

/* ====================== ИНТЕРФЕЙС ВНУТРИ ИГРЫ ====================== */
function toast(msg, cls = 'info') {
  const d = document.createElement('div'); d.className = 'toast ' + cls; d.textContent = msg;
  const box = $('toasts'); box.appendChild(d);
  while (box.children.length > 5) box.removeChild(box.firstChild);
  setTimeout(() => d.remove(), 3800);
}
let noteTimer = 0;
function showNote(i) {
  $('noteTitle').textContent = '📄 ' + NOTES[i][0]; $('noteText').textContent = NOTES[i][1];
  show('noteBox'); clearTimeout(noteTimer); noteTimer = setTimeout(() => show('noteBox', false), 12000);
}
function recordNote(i) {
  if (!save.notes.includes(i)) { save.notes.push(i); store(); }
  invNote = i; showNote(i);
}
function objective() {
  const p = player;
  if (p.vault) return '◆ ЦЕЛЬ: вернитесь к шлюзу убежища (зелёная метка)';
  if (!p.hasKey) return '◆ ЦЕЛЬ: найдите карту доступа к хранилищу (💳 лежит в одном из контейнеров)';
  return '◆ ЦЕЛЬ: откройте хранилище (янтарная метка на карте)';
}
const mini = $('mini'), mc = mini.getContext('2d');
function drawMini() {
  const S = mini.width, N = lv.N, sc = S / (N * CELL), cs = CELL * sc;
  const ex = (x, z) => x >= 0 && z >= 0 && x < N && z < N && lv.exp[z][x];
  mc.clearRect(0, 0, S, S); mc.fillStyle = 'rgba(0,0,0,.65)'; mc.fillRect(0, 0, S, S);
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) if (lv.exp[z][x]) {
    mc.fillStyle = ZONES[lv.zone[z * N + x]].color + '4d'; mc.fillRect(x * cs, z * cs, cs, cs);
  }
  mc.strokeStyle = 'rgba(190,210,220,.9)'; mc.lineWidth = 1.5; mc.beginPath();
  for (let z = 0; z <= N; z++) for (let x = 0; x < N; x++) if (lv.H[z][x] && (ex(x, z) || ex(x, z - 1))) { mc.moveTo(x * cs, z * cs); mc.lineTo((x + 1) * cs, z * cs); }
  for (let z = 0; z < N; z++) for (let x = 0; x <= N; x++) if (lv.V[z][x] && (ex(x, z) || ex(x - 1, z))) { mc.moveTo(x * cs, z * cs); mc.lineTo(x * cs, (z + 1) * cs); }
  mc.stroke();
  for (const it of lv.items) {
    if (it.kind !== 'box' || it.corpse || it.vault || !ex(cellOf(it.x), cellOf(it.z))) continue;
    mc.fillStyle = it.searched ? (it.items.length ? '#35c26a' : '#666') : '#ff9a3a'; mc.fillRect(it.x * sc - 1.5, it.z * sc - 1.5, 3, 3);
  }
  mc.fillStyle = '#4ade80'; mc.fillRect(0, (CELL / 2 - 1.5) * sc, 4, 3 * sc);
  if (player.hasKey || ex(lv.vx, lv.vz)) {
    const vx = (lv.vx + 0.5) * cs, vz = (lv.vz + 0.5) * cs;
    mc.fillStyle = player.vault ? '#777' : '#ffb020'; mc.beginPath();
    mc.moveTo(vx, vz - 6); mc.lineTo(vx + 6, vz); mc.lineTo(vx, vz + 6); mc.lineTo(vx - 6, vz); mc.fill();
  }
  mc.save(); mc.translate(player.x * sc, player.z * sc); mc.rotate(-player.yaw);
  mc.fillStyle = '#fff'; mc.beginPath(); mc.moveTo(0, -6); mc.lineTo(4.5, 5); mc.lineTo(-4.5, 5); mc.closePath(); mc.fill(); mc.restore();
}
let hudWb = '', lastScope = -1, lastCross = -1;
const el = { hp: $('hpBar'), st: $('stBar'), bt: $('btBar'), nz: $('noiseBar') };
function updateHUD() {
  const p = player;
  el.hp.style.width = (p.hp / p.maxHp * 100) + '%'; $('hpTxt').textContent = Math.ceil(p.hp);
  el.st.style.width = (p.stam / p.maxStam * 100) + '%'; el.st.style.background = p.exhausted ? '#a05030' : '#e0b83d';
  el.bt.style.width = (p.flash || p.batt > 0 ? p.batt : 0) + '%'; el.bt.style.opacity = p.flash ? 1 : 0.45;
  el.nz.style.width = clamp(p.noise / 42 * 100, 4, 100) + '%';
  el.nz.style.background = p.noise > 25 ? '#ff5a4a' : p.noise > 10 ? '#f0c14a' : '#8fe3a0';
  const W = cw();
  $('magTxt').textContent = W.melee ? '⚔' : p.reloadT > 0 ? '…' : p.mag; $('ammoTxt').textContent = W.melee ? '∞' : bagCount(W.ammo);
  const wb = SLOTS.map((sl, i) => { const id = slotWeapon(sl.id); return `<span class="wslot ${id && id === p.weapon ? 'on' : ''} ${id ? '' : 'none'}"><b>${i + 1}</b>${id ? WEAPONS[id].icon : '·'}</span>`; }).join('');
  if (wb !== hudWb) { hudWb = wb; $('wpnBar').innerHTML = wb; }
  $('wpnTxt').textContent = cw().short;
  $('invTxt').textContent = `🍞${bagCount('food')}  💊${bagCount('meds')}  🩹${bagCount('band')}  🔩${bagCount('scrap')}  🪵${bagCount('wood')}  🔋${bagCount('batt')}${p.hasKey ? '  💳' : ''}  · 🎒${p.bag.length}/${p.bagCap}`;
  $('objective').textContent = objective();
  const zk = lv.curZone && ZONES[lv.curZone];
  $('zoneInfo').innerHTML = zk ? `<span class="zonedot" style="background:${zk.color}"></span>${zk.name}` : '';
  const t = Math.floor(lv.time);
  $('sortieInfo').textContent = `Вылазка №${save.sorties + 1} · ${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')} · бывших вокруг: ${lv.monsters.filter(m => !m.dead).length}`;
}

/* ====================== ИНВЕНТАРЬ: ИНТЕРФЕЙС ====================== */
const itemName = s => (s.id === 'note' ? NOTES[s.ref][0] : ITEMS[s.id].name);
function slotsHTML(list, cap, side) {
  let h = '';
  for (let i = 0; i < cap; i++) {
    const s = list[i];
    if (!s) { h += '<div class="slot empty"></div>'; continue; }
    const d = ITEMS[s.id], sel = invSel && invSel.side === side && invSel.idx === i;
    h += `<div class="slot ${sel ? 'sel' : ''} ${s.id === 'key' || s.id === 'bpVal' ? 'key' : ''}" data-slot="1" data-side="${side}" data-idx="${i}" title="${itemName(s)}">
      <span class="ic">${d.icon}</span>${s.n > 1 ? `<span class="n">${s.n}</span>` : ''}<span class="nm">${itemName(s)}</span></div>`;
  }
  return h;
}
function playerLook() {
  const p = player, u = save.up;
  return {
    weapon: p.weapon, weaponName: cw().name, primary: slotWeapon('primary'), melee: p.melee, hp: p.hp, maxHp: p.maxHp, flash: p.flash, batt: p.batt,
    bagCap: p.bagCap, bagUsed: p.bag.length,
    up: { light: u.light | 0, hp: u.hp | 0, stam: u.stam | 0, boots: u.boots | 0, bag: u.bag | 0 },
    has: { food: bagCount('food'), meds: bagCount('meds'), band: bagCount('band'), batt: bagCount('batt'), key: bagCount('key'), bpVal: bagCount('bpVal') }
  };
}
const wStatsHTML = st => `<div class="wstats">${st.map(([n, v]) => `<div><span>${n}</span><i><b style="width:${v}%"></b></i></div>`).join('')}</div>`;
function weaponInfo(id) {
  if (id === 'pistol') return PISTOL_CARD;
  if (id === 'pipe') return PIPE_CARD;
  return WCRAFT.find(w => w.id === id) || { name: WEAPONS[id].name, desc: '', stats: [] };
}
function equipHTML() {
  const p = player;
  return SLOTS.map((sl, i) => {
    const id = slotWeapon(sl.id), W = id && WEAPONS[id], sel = invSel && invSel.side === 'eq' && invSel.slot === sl.id;
    const sub = !W ? 'пусто' : W.melee ? 'ближний бой · ∞' : `${p.mags[id]}/${W.mag} + ${bagCount(W.ammo)}`;
    return `<div class="eqslot ${sel ? 'sel' : ''} ${W ? '' : 'none'} ${id && id === p.weapon ? 'on' : ''}" data-eq="${sl.id}" title="${sl.name}">
      <span class="eqk">${kbd('w' + (i + 1))}</span><span class="eqt">${sl.short}</span>
      <span class="eqic">${W ? W.icon : '＋'}</span><span class="eqn">${W ? W.name : 'пусто'}</span><span class="eqa">${sub}</span></div>`;
  }).join('');
}
function eqDetailHTML(slot) {
  const sl = SLOTS.find(x => x.id === slot), id = slotWeapon(slot), W = id && WEAPONS[id], p = player;
  if (!W) return `<div class="flex gap-3 items-start"><div class="text-4xl">＋</div><div class="flex-1"><div class="font-bold">${sl.name} — пусто</div>
    <div class="text-white/65 text-xs my-1">${sl.empty || 'Нет оружия для этого слота.'}</div></div></div>`;
  const info = weaponInfo(id), btn = [];
  if (p.weapon !== id) btn.push(`<button class="btn sm main" data-act="hold">✋ Взять в руки <kbd>${bindName('w' + (SLOTS.indexOf(sl) + 1))}</kbd></button>`);
  const alts = SLOT_OPTIONS[slot].filter(o => o !== id && isOwned(o));
  alts.forEach(o => btn.push(`<button class="btn sm" data-act="equip" data-id="${o}">⇄ ${WEAPONS[o].icon} ${WEAPONS[o].name}</button>`));
  const foot = alts.length ? '<div class="text-[10px] text-white/45 mt-1.5">Замените оружие в слоте на другое из арсенала. Новое оружие собирается на верстаке в убежище.</div>' : (slot === 'pistol' ? '<div class="text-[10px] text-white/45 mt-1.5">Пистолет — запасное оружие, оно всегда с вами.</div>' : '<div class="text-[10px] text-white/45 mt-1.5">Других подходящих предметов в арсенале нет — соберите их на верстаке в убежище.</div>');
  return `<div class="flex gap-3 items-start"><div class="text-4xl">${W.icon}</div><div class="flex-1">
    <div class="font-bold">${info.name}${p.weapon === id ? ' <span class="text-emerald-300 text-xs">· в руках</span>' : ''}<span class="text-white/40 text-xs"> · ${sl.name}</span></div>
    <div class="text-white/65 text-xs my-1">${info.desc}</div>${wStatsHTML(info.stats)}
    <div class="flex flex-wrap gap-2 mt-2">${btn.join('')}</div>${foot}</div></div>`;
}
function renderInv() {
  const p = player, c = invCont;
  $('invEquip').innerHTML = equipHTML();
  $('invTitle').textContent = c ? `🗄 ${c.name}` : '🎒 Инвентарь';
  $('bagCnt').textContent = `${p.bag.length} / ${p.bagCap} ячеек`;
  $('invBag').innerHTML = slotsHTML(p.bag, p.bagCap, 'bag');
  show('btnTakeAll', !!c && c.items.length > 0);
  if (c) {
    $('rightTitle').textContent = `🗄 ${c.name} · ${c.items.length}/${c.cap}`;
    $('invRight').innerHTML = `<div class="slots">${slotsHTML(c.items, c.cap, 'cont')}</div>`;
  } else {
    $('rightTitle').textContent = invTab === 'model' ? '🧍 Внешний вид' : '🧍 Снаряжение';
    const zk = ZONES[lv.curZone] || ZONES.corridor;
    const tabs = `<div class="flex gap-1.5 mb-2"><button class="btn sm ${invTab === 'model' ? 'main' : ''}" data-act="tab-model">🧍 3D-модель</button><button class="btn sm ${invTab === 'stats' ? 'main' : ''}" data-act="tab-stats">📋 Снаряжение</button></div>`;
    if (invTab === 'model') $('invRight').innerHTML = tabs + '<div id="plHost"></div>';
    else $('invRight').innerHTML = tabs + `
      <div class="stat"><span>❤ Здоровье</span><b>${Math.ceil(p.hp)} / ${p.maxHp}</b></div>
      <div class="stat"><span>⚡ Выносливость</span><b>${Math.round(p.stam)} / ${Math.round(p.maxStam)}</b></div>
      ${WEAPON_ORDER.filter(isOwned).map(id => `<div class="stat"><span>${WEAPONS[id].icon} ${WEAPONS[id].name}${id === p.weapon ? ' ◀' : ''}</span><b>${p.mags[id]} / ${WEAPONS[id].mag} + ${bagCount(WEAPONS[id].ammo)}</b></div>`).join('')}
      <div class="stat"><span>${WEAPONS[p.melee].icon} ${WEAPONS[p.melee].name}${p.weapon === p.melee ? ' ◀' : ''}</span><b>${bindName('melee')} · удар</b></div>
      <div class="stat"><span>🔦 Фонарь</span><b>${Math.round(p.batt)}% · ${p.flash ? 'вкл' : 'выкл'}</b></div>
      ${!save.blueprints.asval ? `<div class="stat"><span>📐 Чертёж АС «Вал»</span><b>${bagCount('bpVal') ? 'в рюкзаке' : 'не найден'}</b></div>` : ''}
      <div class="stat"><span>💳 Карта доступа</span><b>${p.vault ? 'использована' : p.hasKey ? 'есть' : 'нет'}</b></div>
      <div class="stat"><span>☠ Убито за вылазку</span><b>${p.kills}</b></div>
      <div class="stat"><span>📍 Местоположение</span><b style="color:${zk.color}">${zk.name}</b></div>
      <div class="text-xs text-white/50 mt-3">Подойдите к ящику, шкафу или телу и нажмите ${kbd('interact')} — откроется содержимое. Игра на паузе, пока открыт инвентарь.</div>`;
    if (invTab === 'model') {
      if (!plViewer) plViewer = new PlayerViewer();
      plViewer.setLook(playerLook());
      $('plHost').appendChild(plViewer.root); plViewer.start();
    }
  }
  // подробности
  let sel = null;
  if (invSel && invSel.side === 'eq') { $('invDetail').innerHTML = eqDetailHTML(invSel.slot); return; }
  if (invSel) { const list = invSel.side === 'bag' ? p.bag : (c ? c.items : null); sel = list && list[invSel.idx]; if (!sel) invSel = null; }
  let html;
  if (!sel) {
    html = invNote !== null
      ? `<div class="font-bold text-amber-200 mb-1">📄 ${NOTES[invNote][0]}</div><div class="text-white/85 leading-relaxed">${NOTES[invNote][1]}</div><div class="text-xs text-white/45 mt-2">Записка добавлена в дневник.</div>`
      : '<div class="text-white/50">Выберите предмет, чтобы увидеть описание и действия. Двойной клик — быстрое действие (использовать / переложить).</div>';
  } else {
    const d = ITEMS[sel.id], btn = [];
    if (invSel.side === 'bag') {
      if (d.use) btn.push(`<button class="btn sm main" data-act="use">${d.use}</button>`);
      if (c) { btn.push(`<button class="btn sm" data-act="move">⇨ Положить${sel.n > 1 ? ' всё' : ''}</button>`); if (sel.n > 1) btn.push('<button class="btn sm" data-act="move1">⇨ Положить 1</button>'); }
      if (sel.id !== 'key' && sel.id !== 'bpVal') btn.push('<button class="btn sm danger" data-act="drop">🗑 Выбросить</button>');
    } else {
      btn.push(`<button class="btn sm main" data-act="move">${sel.id === 'note' ? '📖 Прочитать' : '⇦ Взять' + (sel.n > 1 ? ' всё' : '')}</button>`);
      if (sel.n > 1) btn.push('<button class="btn sm" data-act="move1">⇦ Взять 1</button>');
    }
    html = `<div class="flex gap-3 items-start"><div class="text-4xl">${d.icon}</div><div class="flex-1">
      <div class="font-bold">${itemName(sel)}${sel.n > 1 ? ` <span class="text-white/60">×${sel.n}</span>` : ''}${sel.n > 1 || d.max > 1 ? `<span class="text-white/40 text-xs"> · стек до ${d.max}</span>` : ''}</div>
      <div class="text-white/65 text-xs my-1">${d.desc}</div><div class="flex flex-wrap gap-2 mt-2">${btn.join('')}</div></div></div>`;
  }
  $('invDetail').innerHTML = html;
}
function openInventory(cont) {
  if (state !== 'sortie' || invOpen) return;
  running = false; invOpen = true; invCont = cont || null; invSel = null; invNote = null;
  Object.keys(keys).forEach(k => keys[k] = false); fireHeld = false; aiming = false; player.aimT = 0;
  player.prog = 0; show('prompt', false);
  if (document.pointerLockElement) document.exitPointerLock();
  if (cont) { sfx.open(); }
  show('scr-inv'); renderInv();
}
function closeInventory() {
  if (!invOpen) return;
  invOpen = false; invCont = null; invSel = null; show('scr-inv', false);
  if (state === 'sortie') resumeGame();
}
function takeFromCont(idx, amount) {
  const p = player, c = invCont, s = c && c.items[idx]; if (!s) return;
  if (s.id === 'note') { recordNote(s.ref); c.items.splice(idx, 1); invSel = null; sfx.pick(); updateLed(c); invChanged(); return; }
  const id = s.id, moved = moveStack(c.items, p.bag, p.bagCap, idx, amount || s.n);
  if (!moved) { toast('Рюкзак полон — освободите ячейку', 'bad'); return; }
  p.loot[id] = (p.loot[id] || 0) + moved;
  if (id === 'key') { toast('Карта доступа получена', 'good'); }
  if (id === 'bpVal') { toast('📐 Чертёж АС «Вал» найден! Принесите его в убежище', 'good'); }
  sfx.pick(); updateLed(c);
  if (!c.items[idx] || c.items[idx].id !== id) invSel = null;
  invChanged();
}
function storeToCont(idx, amount) {
  const p = player, c = invCont, s = p.bag[idx]; if (!s || !c) return;
  const id = s.id, moved = moveStack(p.bag, c.items, c.cap, idx, amount || s.n);
  if (!moved) { toast('В контейнере нет места', 'bad'); return; }
  sfx.click(); updateLed(c);
  if (!p.bag[idx] || p.bag[idx].id !== id) invSel = null;
  invChanged();
}
function useBagItem(idx) {
  const p = player, s = p.bag[idx]; if (!s) return;
  const id = s.id;
  if (id === 'food' || id === 'meds' || id === 'band') {
    if (p.hp >= p.maxHp) { toast('Здоровье полное', 'info'); return; }
    bagRemove(id, 1); applyHeal(id);
  } else if (id === 'batt') {
    if (p.batt > 90) { toast('Фонарь ещё заряжен', 'info'); return; }
    bagRemove(id, 1); p.batt = 100; p.flash = true; toast('Батарея фонаря заменена', 'good'); sfx.pick();
  } else if (id === 'ammo' || id === 'ammoR' || id === 'ammoV' || id === 'shells' || id === 'fuel') {
    const wid = WEAPON_ORDER.find(w => WEAPONS[w].ammo === id);
    if (!isOwned(wid)) { toast('Нет подходящего оружия — его можно собрать на верстаке', 'info'); return; }
    if (!isEquipped(wid)) equipWeapon(wid, true);
    if (p.weapon !== wid) switchWeapon(wid, true);
    if (p.mag >= cw().mag) { toast('Магазин полон', 'info'); return; }
    reload(); toast('Перезарядка…', 'info'); closeInventory(); return;
  } else return;
  if (!p.bag[idx] || p.bag[idx].id !== id) invSel = null;
  invChanged();
}
function invAction(act) {
  const p = player;
  if (act === 'close') return closeInventory();
  if (act === 'takeall') {
    if (!invCont) return;
    for (let i = 0; i < invCont.items.length;) {
      const before = invCont.items.length;
      takeFromCont(i, 0);
      if (invCont.items.length >= before) i++;   // стек остался (не влез) — идём дальше
    }
    invSel = null; renderInv(); return;
  }
  if (!invSel) return;
  const { side, idx } = invSel;
  if (act === 'use') useBagItem(idx);
  else if (act === 'drop') { const s = p.bag[idx]; if (s && s.id !== 'key' && s.id !== 'bpVal') { p.bag.splice(idx, 1); invSel = null; sfx.click(); toast('Выброшено: ' + itemName(s), 'info'); invChanged(); } }
  else if (act === 'move') { if (side === 'cont') takeFromCont(idx, 0); else storeToCont(idx, 0); }
  else if (act === 'move1') { if (side === 'cont') takeFromCont(idx, 1); else storeToCont(idx, 1); }
  renderInv();
}
$('scr-inv').addEventListener('click', e => {
  const eq = e.target.closest('[data-eq]');
  if (eq) { invSel = { side: 'eq', slot: eq.dataset.eq }; sfx.click(); renderInv(); return; }
  const ab = e.target.closest('[data-act]');
  if (ab && ab.dataset.act === 'equip') { equipWeapon(ab.dataset.id); renderInv(); return; }
  if (ab && ab.dataset.act === 'hold') { if (invSel && invSel.side === 'eq') { const id = slotWeapon(invSel.slot); if (id) switchWeapon(id); } renderInv(); return; }
  const s = e.target.closest('[data-slot]');
  if (s) { invSel = { side: s.dataset.side, idx: +s.dataset.idx }; sfx.click(); renderInv(); return; }
  const b = e.target.closest('[data-act]');
  if (b && b.dataset.act.startsWith('tab-')) { invTab = b.dataset.act.slice(4); sfx.click(); renderInv(); return; }
  if (b) invAction(b.dataset.act);
});
$('scr-inv').addEventListener('dblclick', e => {
  const eq = e.target.closest('[data-eq]');
  if (eq) { const id = slotWeapon(eq.dataset.eq); invSel = { side: 'eq', slot: eq.dataset.eq }; if (id) switchWeapon(id); renderInv(); return; }
  const s = e.target.closest('[data-slot]'); if (!s) return;
  invSel = { side: s.dataset.side, idx: +s.dataset.idx };
  if (s.dataset.side === 'cont') invAction('move');
  else if (invCont) invAction('move');
  else invAction('use');
});

/* ---------- Освещение: пул ближайших ламп, мерцание, шлюз ---------- */
function updateLamps(dt, t) {
  const p = player, ls = lv.lamps, pool = lv.pool;
  for (const l of ls) l.d = (l.x - p.x) ** 2 + (l.z - p.z) ** 2;
  const want = ls.slice().sort((a, b) => a.d - b.d).slice(0, pool.length), wset = new Set(want);
  for (const s of pool) if (s.lamp && !wset.has(s.lamp)) { s.f -= dt * 3; if (s.f <= 0) { s.f = 0; s.lamp = null; } }
  for (const l of want) if (!pool.some(s => s.lamp === l)) {
    const s = pool.find(q => !q.lamp);
    if (s) { s.lamp = l; s.f = 0; s.L.color.setHex(l.color); s.L.position.set(l.x, l.y, l.z); }
  }
  for (const s of pool) {
    const l = s.lamp; if (!l) { s.L.intensity = 0; continue; }
    if (wset.has(l)) s.f = Math.min(1, s.f + dt * 3);
    let k = 1;
    if (l.red) k = 0.45 + 0.55 * Math.abs(Math.sin(t * 2.2 + l.ph));
    else if (l.bad) { k = Math.random() < 0.06 ? 0.1 : (Math.sin(t * 30 + l.ph) > 0.97 ? 0.3 : 1); l.mesh.material.color.setHex(k < 0.5 ? 0x2a2a2a : l.color); }
    s.L.intensity = l.base * k * s.f;
  }
  const pulse = 0.65 + 0.35 * Math.sin(t * 2.4);
  lv.door.light.intensity = 14 + 16 * pulse; lv.door.lamp.scale.setScalar(0.8 + 0.3 * pulse);
  lv.dust.update(t, p.x, p.z);
}

/* ====================== ГЛАВНОЕ ОБНОВЛЕНИЕ ====================== */
function nearestItem() {
  const p = player, fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  let best = null, bd = 2.6;
  for (const it of lv.items) {
    const dx = it.x - p.x, dz = it.z - p.z, d = Math.hypot(dx, dz);
    const lim = it.kind === 'door' ? 3.2 : bd;
    if (d < lim && (d < 1.2 || (dx * fx + dz * fz) / d > 0.35) && d < bd + (it.kind === 'door' ? 0.6 : 0)) { best = it; bd = d; }
  }
  return best;
}
function update(dt) {
  const p = player; time += dt; lv.time += dt;
  if (keys.ArrowLeft) p.yaw += 2 * dt; if (keys.ArrowRight) p.yaw -= 2 * dt;
  if (keys.ArrowUp) p.pitch = clamp(p.pitch + 1.5 * dt, -1.4, 1.4); if (keys.ArrowDown) p.pitch = clamp(p.pitch - 1.5 * dt, -1.4, 1.4);
  p.crouch = down('crouch');
  const f = (down('forward') ? 1 : 0) - (down('back') ? 1 : 0), s = (down('right') ? 1 : 0) - (down('left') ? 1 : 0);
  const moving = f !== 0 || s !== 0;
  const wantSprint = down('sprint') && moving && !p.crouch;
  if (p.exhausted && p.stam > 30) p.exhausted = false;
  const sprinting = wantSprint && !p.exhausted && p.stam > 0;
  // прицеливание: плавный переход 0→1; бег, перезарядка и удар ближним оружием сбивают прицел
  const AM = AIM[p.weapon], wantAim = aiming && !sprinting && p.reloadT <= 0 && p.swingT <= 0 && !cw().melee;
  p.aimT = clamp(p.aimT + (wantAim ? 1 : -1.3) * dt / AM.time, 0, 1);
  const ae = aimE();
  const sp = (p.crouch ? 1.9 : sprinting ? 6.2 : 3.7) * (1 - (1 - AM.move) * ae);
  let tx = 0, tz = 0;
  if (moving) {
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    tx = fx * f + rx * s; tz = fz * f + rz * s; const l = Math.hypot(tx, tz); tx = tx / l * sp; tz = tz / l * sp;
  }
  const k = Math.min(1, dt * 9); p.vx += (tx - p.vx) * k; p.vz += (tz - p.vz) * k;
  p.x += p.vx * dt; p.z += p.vz * dt; resolve(p, 0.38);
  const spd = Math.hypot(p.vx, p.vz);
  if (sprinting) { p.stam -= 26 * dt; if (p.stam <= 0) { p.stam = 0; p.exhausted = true; toast('Вы выдохлись!', 'bad'); } }
  else p.stam = Math.min(p.maxStam, p.stam + (moving ? 15 : 24) * dt);

  const base = moving ? (p.crouch ? 4 : sprinting ? 17 : 9) : 2;
  p.burst = Math.max(0, p.burst - 55 * dt);
  const noiseMul = 1 - 0.15 * p.boots;
  p.noise = Math.max(base * noiseMul, p.burst * (1 - 0.05 * p.boots));
  if (spd > 0.5) {
    p.stepT -= dt * spd;
    if (p.stepT <= 0) { p.stepT = 1.9; sfx.step(p.crouch ? 0.02 : sprinting ? 0.11 : 0.055); }
  }
  if (p.flash) {
    p.batt -= dt * 100 / p.battDur;
    if (p.batt <= 0) { p.batt = 0; if (!swapBattery()) { p.flash = false; toast('Фонарь разрядился!', 'bad'); } }
  }
  const flick = p.flash ? (p.batt < 20 ? (Math.random() < 0.15 ? 0.2 : 0.75) : 1) : 0;
  spot.intensity = 170 * flick;
  if (fireHeld && cw().auto && !invOpen) shoot();
  p.gunCD = Math.max(0, p.gunCD - dt); p.meleeCD = Math.max(0, p.meleeCD - dt); p.swingT = Math.max(0, p.swingT - dt);
  p.kick = Math.max(0, p.kick - dt * 7); p.flashT = Math.max(0, p.flashT - dt);
  let rp = -1, cp = -1;
  if (p.reloadT > 0) {
    p.reloadT -= dt; rp = clamp(1 - p.reloadT / (p.reloadMax || 1), 0, 1);
    p.cycleT = -1; p.cycleDelay = 0;
    if (p.reloadT <= 0 && p.weapon !== 'shotgun') { const W = cw(), n = Math.min(W.mag - p.mag, bagCount(W.ammo)); p.mag += n; bagRemove(W.ammo, n); invChanged(); }   // дробовик заряжается по одному патрону — в событиях анимации
  } else if (p.cycleT >= 0) {
    if (p.cycleDelay > 0) p.cycleDelay -= dt;
    else { p.cycleT += dt / p.cycleDur; if (p.cycleT >= 1) { cp = 1; p.cycleT = -1; } else cp = p.cycleT; }
  }
  gunLight.intensity = p.flashT > 0 ? (p.weapon === 'flame' ? 40 + Math.random() * 45 : p.weapon === 'asval' ? 22 : 70) : 0;
  for (const k in muzzles) muzzles[k].visible = p.flashT > 0 && k === p.weapon;
  if (p.weapon === 'flame') { muzzles.flame.scale.setScalar(0.8 + Math.random() * 0.9); if (pilotMesh) pilotMesh.scale.z = 1.4 + Math.random() * 0.9; }

  p.eye += ((p.crouch ? 1.05 : 1.65) - p.eye) * Math.min(1, dt * 8);
  p.bobT += spd * dt * 2.2;
  const bob = settings.bob ? Math.sin(p.bobT) * 0.035 * Math.min(1, spd / 3.7) : 0;
  let shx = 0, shy = 0;
  if (p.shake > 0) { if (settings.shake) { shx = rand(-1, 1) * p.shake * 0.05; shy = rand(-1, 1) * p.shake * 0.05; } p.shake = Math.max(0, p.shake - dt * 2.5); }
  camera.position.set(p.x + shx, p.eye + bob + shy, p.z);
  // оптика винтовки: лёгкое покачивание прицела (слабее, если присесть)
  const swayK = AM.scope ? ae * (p.crouch ? 0.35 : 1) : 0;
  const swx = swayK ? (Math.sin(time * 1.1) * 0.0016 + Math.sin(time * 2.7) * 0.0007) * swayK : 0, swy = swayK ? (Math.sin(time * 0.9 + 1) * 0.0014 + Math.sin(time * 2.1) * 0.0006) * swayK : 0;
  camera.rotation.set(p.pitch + swy, p.yaw + swx, 0);
  const fovT = settings.fov * (1 - (1 - AM.zoom) * ae);
  if (Math.abs(camera.fov - fovT) > 0.01) { camera.fov = fovT; camera.updateProjectionMatrix(); }
  const scopeK = AM.scope ? clamp((ae - 0.4) / 0.45, 0, 1) : 0;
  if (scopeK !== lastScope) { lastScope = scopeK; $('scope').style.opacity = scopeK; }
  const crossO = AM.scope ? 1 - clamp(ae * 2, 0, 1) : 1 - 0.8 * ae;
  if (crossO !== lastCross) { lastCross = crossO; $('cross').style.opacity = crossO; }
  const swingP = p.swingT > 0 ? 1 - p.swingT / (p.swingMax || 0.32) : 0;
  for (const k in wgroups) {
    wgroups[k].visible = k === p.weapon && p.swingT <= 0 && !(AM.scope && ae > 0.8);
    if (k === p.weapon) wgroups[k].rotation.y = WVM[k].ry * (1 - ae);   // при прицеливании ствол смотрит строго вперёд
  }
  // ближний бой: поза в руках и взмах (замах → быстрый диагональный удар справа налево)
  for (const k in mgroups) {
    const mg = mgroups[k], on = k === p.melee && (p.swingT > 0 || p.weapon === k);
    mg.visible = on; if (!on) continue;
    const cf = MVM[k], lerp = (a, b, t) => a + (b - a) * t;
    const A = { p: [cf.p[0] + 0.1, cf.p[1] + 0.09, cf.p[2] + 0.04], r: [cf.r[0] + 0.95, cf.r[1] - 0.5, cf.r[2] - 0.75] };
    const B = { p: [cf.p[0] - 0.42, cf.p[1] - 0.07, cf.p[2] - 0.1], r: [cf.r[0] - 0.8, cf.r[1] + 0.95, cf.r[2] + 0.55] };
    let from = cf, to = A, t = 0;
    if (p.swingT > 0) {
      if (swingP < 0.22) { from = cf; to = A; t = swingP / 0.22; t = t * t * (3 - 2 * t); }
      else { from = A; to = B; t = (swingP - 0.22) / 0.78; t = 1 - Math.pow(1 - t, 3); }
    } else t = 0;
    const idle = p.swingT > 0 ? 0 : 1, sway = Math.sin(time * 1.3) * 0.004 * idle;
    mg.position.set(lerp(from.p[0], to.p[0], t), lerp(from.p[1], to.p[1], t) + sway, lerp(from.p[2], to.p[2], t));
    mg.rotation.set(lerp(from.r[0], to.r[0], t), lerp(from.r[1], to.r[1], t), lerp(from.r[2], to.r[2], t));
  }
  const hid = cw().melee ? p.weapon : (p.swingT > 0 ? p.melee : p.weapon);
  hands.update(dt, { weapon: hid, reloadP: hid === p.weapon ? rp : -1, cycleP: hid === p.weapon ? cp : -1, kick: p.kick, empty: p.mag <= 0 && p.reloadT <= 0, n: p.reloadN,
    onEvent: (wid, name) => { WA.event(wid, name); if (name === 'shellin') { const W = cw(); if (p.weapon === 'shotgun' && p.mag < W.mag && bagCount(W.ammo) > 0) { p.mag++; bagRemove(W.ammo, 1); invChanged(); } } } });
  const rl = p.reloadT > 0 ? Math.sin((1 - p.reloadT / (p.reloadMax || 1.3)) * Math.PI) * 0.3 : 0;
  const wcf = WVM[p.weapon], bk = 1 - 0.85 * ae;
  const axp = -wcf.p[0], ayp = -0.012 - (wcf.p[1] + wcf.s * AM.sy);   // положение вьюмодели, при котором мушка/оптика — по центру экрана
  vm.position.set(0.22 + (axp - 0.22) * ae + Math.sin(p.bobT * 0.5) * 0.008 * bk, -0.12 + (ayp + 0.12) * ae + Math.abs(Math.sin(p.bobT)) * 0.008 * bk - rl * 0.18, -0.45 + (AM.z + 0.45) * ae + p.kick * 0.07 * (1 - 0.6 * ae));
  vm.rotation.x = p.kick * 0.22 * (1 - 0.5 * ae) + rl * 0.5;

  // разведка карты и зона
  const cx = cellOf(p.x), cz = cellOf(p.z);
  lv.exp[cz][cx] = true;
  for (let d = 0; d < 4; d++) if (canGo(cx, cz, d)) lv.exp[cz + DZ[d]][cx + DX[d]] = true;
  const zk = lv.zone[cz * lv.N + cx];
  if (zk !== lv.curZone) { lv.curZone = zk; toast('📍 ' + ZONES[zk].name, 'info'); }

  // взаимодействие
  const it = nearestItem();
  const holding = down('interact');
  if (it) {
    let txt, canHold = true;
    if (it.kind === 'door') txt = bindName('interact') + ' (держать) — вернуться в убежище' + (p.vault ? ' (вылазка выполнена)' : '');
    else if (it.searched) { txt = `${bindName('interact')} — открыть: ${it.name} (${it.items.length ? it.items.length + ' предм.' : 'пусто'})`; canHold = false; }
    else if (it.vault && !p.hasKey) { txt = 'Хранилище заперто. Нужна карта доступа 💳'; canHold = false; }
    else txt = it.vault ? `${bindName('interact')} (держать) — вскрыть хранилище картой` : `${bindName('interact')} (держать) — обыскать: ${it.name}`;
    $('promptText').textContent = txt; show('prompt');
    if (holding && canHold) {
      p.prog += dt / it.time; p.burst = Math.max(p.burst, it.vault ? 14 : 8);
      if (p.prog >= 1) {
        p.prog = 0;
        if (it.kind === 'door') { sfx.door(); endSortie('return'); return; }
        it.searched = true;
        if (it.vault) { bagRemove('key', 1); invChanged(); p.vault = true; toast('Хранилище вскрыто! Карта использована', 'good'); }
        updateLed(it); openInventory(it); return;
      }
    } else p.prog = Math.max(0, p.prog - dt * 2);
    $('promptBar').style.width = (p.prog * 100) + '%';
  } else { show('prompt', false); p.prog = 0; }
  for (const c of lv.items) if (c.kind === 'box' && c.vault && !c.searched) updateLed(c);

  let danger = 0;
  for (const m of lv.monsters) {
    updateMonster(m, dt);
    if (!m.dead && m.state === 'chase') danger = Math.max(danger, clamp(1 - Math.hypot(m.x - p.x, m.z - p.z) / 16, 0, 1));
  }
  $('danger').style.opacity = danger * 0.7;
  bunkerAmbient.setTension(danger);
  p.heartT -= dt;
  if (danger > 0.25 && p.heartT <= 0) { p.heartT = 1.15 - danger * 0.65; sfx.heart(0.3 + danger * 0.5); }
  lv.spawnT -= dt;
  const alive = lv.monsters.filter(m => !m.dead).length;
  if (lv.spawnT <= 0) {
    lv.spawnT = 75;
    if (alive < 12) {
      for (let tries = 0; tries < 20; tries++) {
        const x = (ri(0, lv.N - 1) + 0.5) * CELL, z = (ri(0, lv.N - 1) + 0.5) * CELL;
        if (Math.hypot(x - p.x, z - p.z) > 22 && !losClear(x, z, p.x, p.z)) {
          for (const m of spawnGroup(pickType(), x, z)) { m.state = 'investigate'; m.tx = p.x; m.tz = p.z; m.arrived = false; }
          toast('Где-то хлопнула гермодверь...', 'bad'); break;
        }
      }
    }
  }
  updateLamps(dt, time);
  lv.ambT -= dt;
  if (lv.ambT <= 0) {
    lv.ambT = rand(12, 28); const pan = rand(-1, 1);
    if (Math.random() < 0.5) { tone(rand(120, 220), 0.9, 'square', 0.04, -40, pan); noise(0.5, 0.05, 800, pan); }
    else growl(rand(22, 30), pan, 1.2);
  }
  updateParts(dt); updateFlames(dt); updateProjs(dt);
  if (Math.floor(time * 5) !== Math.floor((time - dt) * 5)) drawMini();
  updateHUD();
}

/* ====================== ВЫЛАЗКА: СТАРТ / КОНЕЦ ====================== */
function startSortie() {
  const fed = save.food > 0; if (fed) save.food--;
  const p = player, up = save.up;
  p.maxHp = 100 + 20 * up.hp; if (!fed) p.maxHp = Math.round(p.maxHp * 0.65);
  p.hp = p.maxHp; p.maxStam = 100 * (1 + 0.25 * up.stam); p.stam = p.maxStam; p.exhausted = false;
  p.battDur = 150 * (1 + 0.3 * up.light); p.batt = 100; p.flash = true; p.boots = up.boots;
  const meds = Math.min(save.meds, 2), band = Math.min(save.band, 2), batt = Math.min(save.batt, 2);
  save.meds -= meds; save.band -= band; save.batt -= batt;
  p.bagCap = 8 + 2 * up.bag; p.bag = [];
  p.mags = { pistol: 0, rifle: 0, shotgun: 0, flame: 0, asval: 0 };
  for (const wid of WEAPON_ORDER) {
    if (!isOwned(wid)) continue;
    const W = WEAPONS[wid], k = W.ammo, n = Math.min(save[k], CARRY[k]);
    save[k] -= n; p.mags[wid] = Math.min(W.mag, n);
    if (n - p.mags[wid] > 0) save[k] += bagAdd(k, n - p.mags[wid]);
  }
  store();
  fixEquip();
  p.weapon = isEquipped(save.wpn) ? save.wpn : 'pistol';
  bagAdd('meds', meds); bagAdd('band', band); bagAdd('batt', batt);
  p.loot = {}; p.hasKey = false; p.vault = false; p.kills = 0;
  p.vx = p.vz = 0; p.noise = 2; p.burst = 0; p.reloadT = 0; p.prog = 0; p.shake = 0; p.aimT = 0; aiming = false;
  invOpen = false; invCont = null; invSel = null; invNote = null; show('scr-inv', false);
  leaveHubScene();
  buildLevel();
  p.x = CELL / 2; p.z = CELL / 2; p.yaw = -Math.PI / 2; p.pitch = 0;
  lv.exp[0][0] = true; lv.curZone = 'airlock'; lv.dust.reset(p.x, p.z);
  state = 'sortie'; running = false;
  menuMusic.stop(1.0); syncMusic();
  hideHubUI(); show('scr-menu', false); show('scr-result', false);
  show('hud'); show('vig'); show('prompt', false); show('noteBox', false);
  $('toasts').innerHTML = '';
  const sector = pick(SECTORS) + '-' + ri(2, 29);
  openLock(`Вылазка №${save.sorties + 1}`,
    `Сеть бункеров, сектор ${sector}. Живых здесь нет — только вы. Коридоры разделены гермопроёмами на зоны: жилые блоки, медпункты, склады, серверные… В каждой — своя добыча. Найдите 💳 карту доступа, откройте хранилище и вернитесь к зелёному шлюзу. <b>${bindName('inventory')}</b> — инвентарь, <b>${bindName('interact')}</b> — обыск, <b>${bindName('aim')}</b> — прицел.` +
    (lv.bpPlaced ? ' <br><span style="color:#9fe8ff">📐 Ходят слухи: в одном из ящиков этой сети лежит чертёж АС «Вал».</span>' : '') +
    (fed ? '' : ' <br><span style="color:#ff8c80">Вы голодны: здоровье снижено.</span>'), 'Начать вылазку');
  if (save.day === 1) setTimeout(() => { if (state === 'sortie') toast(`Подсказка: красться (${bindName('crouch')}) — тише, бег (${bindName('sprint')}) — слышно далеко`, 'info'); }, 4000);
  camera.position.set(p.x, p.eye, p.z); camera.rotation.set(0, p.yaw, 0);
  drawMini(); updateHUD();
}
function endSortie(kind) {
  const p = player;
  running = false; fireHeld = false; aiming = false; player.aimT = 0; state = 'result'; invOpen = false; show('scr-inv', false);
  bunkerAmbient.stop(3);
  if (document.pointerLockElement) document.exitPointerLock();
  show('lockHint'); show('scr-lock', false); show('hud', false); show('vig', false);
  $('danger').style.opacity = 0;
  let title, emoji, html = '';
  const carried = {};
  for (const s of p.bag) if (STASH_KEYS.includes(s.id)) carried[s.id] = (carried[s.id] || 0) + s.n;
  for (const wid of WEAPON_ORDER) if (p.mags[wid] > 0) { const k = WEAPONS[wid].ammo; carried[k] = (carried[k] || 0) + p.mags[wid]; }
  const fmt = o => Object.entries(o).filter(([, n]) => n > 0).map(([k, n]) => `${LABELS[k]} ×${n}`).join(' · ') || 'ничего';
  if (kind === 'return') {
    for (const k of STASH_KEYS) save[k] += carried[k] || 0;
    const gotBp = bagCount('bpVal') > 0 && !save.blueprints.asval; if (gotBp) save.blueprints.asval = true;
    title = 'Вы вернулись!'; emoji = '🚪';
    html = `<p>Шлюз захлопнулся за спиной. В убежище тихо, как всегда: вы здесь один, и можно наконец перевести дух.</p>
      <p class="mt-3">Найдено за вылазку: <b>${fmt(p.loot)}</b></p>
      <p>Сдано на склад: <b>${fmt(carried)}</b></p>
      <p>Убито бывших: <b>${p.kills}</b></p>
      <p>${p.vault ? '✅ Хранилище вскрыто.' : '❌ Хранилище осталось закрытым.'}</p>
      ${gotBp ? '<p class="mt-2" style="color:#9fe8ff">📐 <b>Чертёж АС «Вал» доставлен!</b> Теперь автомат можно собрать на верстаке.</p>' : ''}`;
  } else if (kind === 'dead') {
    save.deaths++; title = 'Вы погибли'; emoji = '💀';
    html = `<p>Бывшие нашли вас в темноте. Вы очнулись у шлюза — аварийная автоматика втянула вас внутрь, но всё снаряжение и добыча потеряны.</p>
      <p class="mt-3">Потеряно: <b>${fmt(carried)}</b>${bagCount('bpVal') ? ' · 📐 чертёж АС «Вал» (придётся искать снова)' : ''}</p><p>Убито бывших: <b>${p.kills}</b></p>`;
  } else {
    title = 'Вылазка прервана'; emoji = '🏃';
    html = `<p>Вы бросили вылазку и добрались до шлюза. Всё, что несли с собой, осталось в коридорах.</p>`;
  }
  save.day++; save.sorties++; store();
  $('resEmoji').textContent = emoji; $('resTitle').textContent = title; $('resBody').innerHTML = html;
  show('scr-result');
}

/* ====================== ЭКРАНЫ ====================== */
function openLock(title, text, btn) {
  $('lockTitle').textContent = title; $('lockText').innerHTML = text; $('btnLockGo').textContent = btn;
  $('lockHint').textContent = ''; show('scr-lock');
}
function pauseGame() {
  if (state !== 'sortie' || !running) return;
  running = false; Object.keys(keys).forEach(k => keys[k] = false); fireHeld = false; aiming = false; player.aimT = 0;
  openLock('Пауза', 'Бывшие тоже замерли — но только пока вы не вернётесь.', 'Продолжить');
  if (document.pointerLockElement) document.exitPointerLock();
}
function resumeGame() {
  initAudio();
  if (fallback) { running = true; show('scr-lock', false); return; }
  try { const r = dom.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { fallback = true; running = true; show('scr-lock', false); }
}
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === dom;
  if (state === 'hub') { if (locked) lockErrors = 0; else if (hubMode === 'walk' && !fallback) hubPause(); return; }
  if (locked) { lockErrors = 0; running = true; show('scr-lock', false); }
  else if (running && state === 'sortie') pauseGame();
});
document.addEventListener('pointerlockerror', () => {
  lockErrors++;
  if (state === 'hub') { if (lockErrors >= 2) { fallback = true; hubSetMode('walk'); show('scr-hubpause', false); } else hubPause(); return; }
  if (state !== 'sortie' || invOpen) return;
  if (lockErrors >= 2) { fallback = true; running = true; show('scr-lock', false); toast('Захват мыши недоступен: используйте мышь/стрелки для обзора', 'info'); }
  else {
    if ($('scr-lock').classList.contains('off')) openLock('Пауза', 'Нажмите «Продолжить», чтобы вернуться в игру.', 'Продолжить');
    $('lockHint').textContent = 'Не удалось захватить мышь. Нажмите ещё раз через секунду.';
  }
});
$('btnLockGo').onclick = resumeGame;
$('btnLockQuit').onclick = () => { if (state === 'sortie') endSortie('abandon'); };
addEventListener('blur', () => pauseGame());

/* ====================== УБЕЖИЩЕ: 3D-КОМНАТА ====================== */
let hub = null, hubMode = 'pause', hubNear = null, hubStation = null;
const hp = { x: 5.5, z: 7.3, yaw: 0, pitch: 0, vx: 0, vz: 0, bobT: 0, stepT: 0, eye: 1.65, sit: false };
const REST_LINES = [
  'Матрас пахнет сыростью и хозяйственным мылом. Где-то за стеной тихо гудит генератор — этот звук уже стал колыбельной. Ты закрываешь глаза и считаешь шаги до шлюза. Девяносто три.',
  'Над головой мигает гирлянда — ты включил её сам, просто чтобы в убежище стало чуть теплее. Ты вспоминаешь коридоры сети и стараешься не вспоминать, как светились глаза в темноте. Получается плохо, но ты всё равно засыпаешь.',
  'Медведь на подушке смотрит на тебя пластиковыми глазами. Ты давно решил, что он остаётся «охранять». Усмехаешься и обещаешь вернуться с вылазки с консервами.',
  'Часы на стене тикают ровно. Единственный звук в убежище, который не вызывает тревоги. Ты отдыхаешь — ровно столько, сколько позволяет совесть.',
  'Сон приходит быстро и без снов. Это лучшее, что можно получить в мире, где за дверью бродят Бывшие. Утром — снова за шлюз.',
  'За стеной шипит радио. Если очень захотеть, в этом шипении можно расслышать слова. Ты знаешь, что там только помехи, и всё равно накрываешься одеялом с головой.'
];
const PROMPTS = {
  bench: 'Верстак — крафт оружия, мебели и улучшения',
  bed: 'Кровать — отдохнуть',
  table: 'Стол — записи, сводка и альманах',
  shelf: 'Стеллаж — запасы убежища',
  chair: 'Стул — присесть',
  radio: 'Радио — включить / сменить волну',
  candle: 'Свеча — зажечь / задуть',
  painting: 'Картина — рассмотреть',
  door: 'Шлюз — выйти на вылазку'
};
const STATION_TITLES = { bench: '🛠 Верстак', bed: '🛏 Кровать', table: '📖 Стол — записи, сводка и альманах Бывших', shelf: '📦 Стеллаж — запасы убежища' };

function hideHubUI() {
  radioOff();
  show('hubhud', false); show('scr-hubpause', false); show('scr-station', false);
  $('hfade').style.opacity = 0;
}
function hubSetMode(m) {
  hubMode = m; show('hcross', m === 'walk');
  if (m !== 'walk') { Object.keys(keys).forEach(k => keys[k] = false); fireHeld = false; aiming = false; player.aimT = 0; show('hPrompt', false); }
}
function enterHubScene() {
  if (!hub) hub = createHubRoom();
  disposeLevel();
  scene.add(hub.group);
  scene.background = new THREE.Color(0x080605); scene.fog = null;
  ambient.color.set(0xffe2bd); ambBase = 1.4; ambient.intensity = ambBase * settings.bright;
  vm.visible = false; spot.visible = false; gunLight.visible = false;
  camera.fov = settings.fov; camera.updateProjectionMatrix(); $('scope').style.opacity = 0; lastScope = -1; lastCross = -1;
  hub.refresh(save); hp.sit = false; hp.eye = 1.65; candleLit = true; hub.setCandle(true); hub.setRadio(false);
  const s = hub.spawn; hp.x = s.x; hp.z = s.z; hp.yaw = s.yaw; hp.pitch = s.pitch; hp.vx = hp.vz = 0;
  camera.position.set(hp.x, 1.65, hp.z); camera.rotation.set(hp.pitch, hp.yaw, 0);
}
function leaveHubScene() {
  radioOff();
  if (hub) scene.remove(hub.group);
  scene.background = new THREE.Color(FOG_COL); scene.fog = new THREE.FogExp2(FOG_COL, FOG_DENS);
  ambient.color.set(AMB_COL); ambBase = AMB_INT; ambient.intensity = ambBase * settings.bright;
  vm.visible = true; spot.visible = true; gunLight.visible = true;
}
function renderHubHud() {
  $('hubDay').textContent = save.day; $('hSort').textContent = save.sorties; $('hKills').textContent = save.kills; $('hDeaths').textContent = save.deaths;
  $('hubChips').innerHTML = STASH_KEYS.map(k => `<span class="chip" title="${LABELS[k]}">${ITEMS[k].icon} <b>${save[k]}</b></span>`).join('');
}
function hubResume() {
  initAudio();
  show('scr-hubpause', false); show('scr-station', false);
  hubSetMode('walk');
  if (fallback) return;
  try { const r = dom.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { fallback = true; }
}
function hubPause() {
  if (state !== 'hub' || hubMode === 'busy') return;
  hubSetMode('pause');
  $('hpDay').textContent = save.day;
  $('hubText').textContent = HUB_LINES[Math.min(HUB_LINES.length - 1, Math.floor((save.day - 1) / 2))];
  show('scr-hubpause');
}


/* ---------- Мебель: радио, свеча, стул, картина ---------- */
let candleLit = true;
const RADIO_WAVES = ['выключено', '🎵 музыка · 101.4 УКВ', '📡 эфирные помехи', '📟 сигнал сети'];
const RADIO_POS = { x: 1.6, z: 8.3 };
const RADIO_CHORDS = [[50, 53, 57, 62], [46, 50, 53, 58], [43, 46, 50, 55], [45, 49, 52, 57]];   // Dm · Bb · Gm · A
const MORSE = '··−·−−··−−−·−·  −·−−··−·−  ';
let radioWave = 0, radioTimer = 0, radioStep = 0, morseI = 0;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function radioVol() { return clamp(1.3 - Math.hypot(hp.x - RADIO_POS.x, hp.z - RADIO_POS.z) / 8, 0.22, 1); }
function radioTick() {
  radioTimer = 0;
  if (!radioWave || state !== 'hub' || !AC) { if (radioWave && state === 'hub') radioTimer = setTimeout(radioTick, 400); return; }
  const vf = radioVol(); let delay = 0.3;
  if (radioWave === 1) {
    // ламповая шкатулка: арпеджио по аккордам d-moll + бас + лёгкий шорох эфира
    const ch = RADIO_CHORDS[Math.floor(radioStep / 8) % RADIO_CHORDS.length], i = radioStep % 8;
    if (i === 0) { tone(mtof(ch[0] - 12), 1.6, 'sine', 0.09 * vf); tone(mtof(ch[0]), 1.4, 'triangle', 0.025 * vf); }
    if (i % 2 === 0) {
      const n = ch[(i / 2 + (Math.random() < 0.3 ? 1 : 0)) % ch.length] + 12;
      tone(mtof(n), 0.9, 'triangle', 0.055 * vf); tone(mtof(n + 12), 0.45, 'sine', 0.012 * vf);
    }
    if (i === 3 || i === 7) { const m = ch[Math.floor(Math.random() * ch.length)] + 24; tone(mtof(m), 0.7, 'sine', 0.035 * vf, -10); }
    noise(0.45, 0.012 * vf, 5200);
    if (Math.random() < 0.18) noise(0.03, 0.05 * vf, 6000);   // треск
    delay = 0.46;
  } else if (radioWave === 2) {
    // помехи: шипение, свист настройки, обрывки «голосов»
    noise(0.34, (0.035 + Math.random() * 0.04) * vf, rand(1800, 6500));
    const r = Math.random();
    if (r < 0.14) tone(rand(500, 1900), rand(0.2, 0.5), 'sine', 0.02 * vf, rand(-700, 700));
    else if (r < 0.26) { const n = ri(3, 7), f0 = rand(110, 190); for (let k = 0; k < n; k++) setTimeout(() => { if (radioWave === 2) { tone(f0 * rand(0.8, 1.6), 0.09, 'sawtooth', 0.018 * vf); noise(0.08, 0.03 * vf, 2600); } }, k * rand(110, 170)); }
    delay = 0.3;
  } else if (radioWave === 3) {
    // «сигнал сети»: азбука Морзе на несущей
    const ch = MORSE[morseI % MORSE.length]; morseI++;
    noise(0.2, 0.015 * vf, 4200);
    if (ch === '·') { tone(820, 0.09, 'sine', 0.06 * vf); delay = 0.2; }
    else if (ch === '−') { tone(820, 0.27, 'sine', 0.06 * vf); delay = 0.38; }
    else delay = 0.45;
    if (morseI % MORSE.length === 0) delay = 2.4;
  }
  radioStep++;
  radioTimer = setTimeout(radioTick, delay * 1000);
}
function radioOff() {
  if (radioTimer) clearTimeout(radioTimer); radioTimer = 0; radioWave = 0;
  if (hub) hub.setRadio(false);
}
function radioNext() {
  initAudio();
  radioWave = (radioWave + 1) % RADIO_WAVES.length; radioStep = 0; morseI = 0;
  if (radioTimer) { clearTimeout(radioTimer); radioTimer = 0; }
  hub.setRadio(radioWave > 0);
  noise(0.25, 0.1, 5000); tone(rand(500, 1500), 0.25, 'sine', 0.03, rand(-500, 500));   // щелчок + настройка
  toast('📻 Радио: ' + RADIO_WAVES[radioWave], radioWave ? 'good' : 'info');
  if (radioWave) radioTimer = setTimeout(radioTick, 380);
}
function sitDown() {
  const c = hub.chair;
  hp.sit = true; hp.x = c.x; hp.z = c.z; hp.vx = hp.vz = 0; hp.yaw = c.yaw; hp.pitch = -0.05;
  sfx.click();
}
function standUp() {
  const c = hub.chair;
  hp.sit = false; hp.x = c.x + Math.sin(c.theta) * 0.8; hp.z = c.z + Math.cos(c.theta) * 0.8; hp.vx = hp.vz = 0;
  sfx.click();
}
const PAINTING_LINES = [
  '🖼 «Свет над пустошью»: закат, холмы и одинокое дерево. Ты ловишь себя на том, что ищешь на холстике шлюз. Его там нет — и от этого немного легче.',
  '🖼 Мазки густые, краска потрескалась по углам. Кто бы это ни написал — он очень хотел вспомнить, как выглядит небо.',
  '🖼 Над холмом нарисовано солнце. Настоящее ты не видел уже… сколько? Лучше не считать.'
];
let paintI = 0;

/* ---------- Панели станций ---------- */
const upCard = k => {
  const u = UPS[k], l = save.up[k], maxed = l >= u.max, cost = u.cost(l);
  const pips = Array.from({ length: u.max }, (_, i) => `<span class="pip ${i < l ? 'on' : ''}"></span>`).join('');
  return `<div class="up"><div class="flex justify-between items-center"><b class="text-sm">${u.name}</b><span>${pips}</span></div>
    <div class="text-xs text-white/55 my-1">${u.desc}</div>
    <button class="btn sm" data-act="up" data-id="${k}" ${maxed || save.scrap < cost ? 'disabled' : ''}>${maxed ? 'Максимум' : 'Улучшить · ' + cost + ' 🔩'}</button></div>`;
};
let tableTab = 'notes', almSel = 'walker', benchTab = 'weapons';
const almKnown = id => !!(save.bestiary && save.bestiary[id]);
function almanacHTML() {
  const total = ALMANAC_ORDER.length, got = ALMANAC_ORDER.filter(almKnown).length;
  if (!ALMANAC_ORDER.includes(almSel)) almSel = ALMANAC_ORDER[0];
  const list = ALMANAC_ORDER.map(id => {
    const k = almKnown(id), c = MT[id];
    return `<button class="almcard ${almSel === id ? 'sel' : ''} ${k ? '' : 'unk'}" data-act="alm" data-id="${id}">
      <span class="almico">${k ? ALMANAC[id].icon : '❓'}</span>
      <span class="almtxt"><b>${k ? c.name : 'Неизвестно'}</b><i>${k ? 'убито: ' + save.bestiary[id] : 'не убит'}</i></span>
      ${k ? '' : '<span class="almlock">🔒</span>'}</button>`;
  }).join('');
  const id = almSel, k = almKnown(id), c = MT[id], a = ALMANAC[id];
  const bar = (n, v, max, txt) => `<div><span>${n}${txt ? ' · <b>' + txt + '</b>' : ''}</span><i><b style="width:${Math.min(100, v / max * 100)}%"></b></i></div>`;
  let info;
  if (k) {
    const dmg = c.explode ? c.explode.dmg : c.dmg, dang = '☠'.repeat(a.danger) + '<span style="opacity:.25">' + '☠'.repeat(5 - a.danger) + '</span>';
    info = `<div class="flex justify-between items-start gap-2 mb-1"><div><div class="text-lg font-black text-amber-200">${a.icon} ${c.name}</div><div class="text-[11px] text-white/55">${a.cls}</div></div>
        <div class="text-right"><div class="text-sm" style="color:#ff8c80" title="Опасность">${dang}</div><div class="text-[10px] text-white/45">убито вами: <b class="text-white/80">${save.bestiary[id]}</b></div></div></div>
      <div class="wstats my-2">
        ${bar('Здоровье', c.hp, 170, c.hp)}${bar('Урон', dmg, 45, dmg + (c.explode ? ' (взрыв)' : ''))}
        ${bar('Скорость погони', c.chase, 5.6, c.chase.toFixed(1) + ' м/с')}${bar('Зрение', c.sight, 16, c.sight + ' м')}
      </div>
      <div class="almmeta"><span>📍 ${a.zones}</span><span>📅 ${a.since}</span><span>🎯 ${a.weak}</span></div>
      <h4 class="almh">📜 Досье</h4><p class="almp">${a.lore}</p>
      <h4 class="almh">🧠 Поведение</h4><p class="almp">${a.behavior}</p>
      <h4 class="almh">💡 Как выжить</h4><ul class="almul">${a.tips.map(t => `<li>${t}</li>`).join('')}</ul>`;
  } else {
    info = `<div class="text-lg font-black text-white/70">❓ Неизвестное существо</div>
      <div class="text-[11px] text-white/45 mb-3">Запись заблокирована</div>
      <div class="almlocked"><div class="text-4xl mb-2">🔒</div>
        <p class="text-sm text-white/70 leading-relaxed">В альманахе пока только силуэт. Данные об этом существе откроются, когда вы убьёте его в сети бункеров — досье, характеристики и 3D-модель.</p></div>`;
  }
  return `<div class="alm-head"><h3 class="font-bold text-sm text-emerald-300">📕 Альманах Бывших <span class="text-white/50 text-xs">(открыто ${got} / ${total})</span></h3>
      <div class="almprog"><i style="width:${got / total * 100}%"></i></div></div>
    <div class="alm-grid"><div class="alm-list">${list}</div>
      <div class="alm-view"><div class="alm-stage"><canvas id="almCanvas" title="Потяните мышью, чтобы повернуть"></canvas>
        ${k ? '<div class="plv-hint">Потяните мышью, чтобы повернуть модель</div>' : '<div class="plv-hint">Силуэт · убейте, чтобы открыть</div>'}</div></div>
      <div class="alm-info">${info}</div></div>`;
}
function furnitureHTML() {
  const cards = FURNITURE.map(f => {
    const have = save.furniture[f.id], can = save.wood >= f.cost;
    return `<div class="wcard ${have ? 'have' : ''}">
      <canvas class="wprev" data-furn="${f.id}" title="Потяните мышью, чтобы повернуть"></canvas>
      <div class="wbody">
        <div class="flex justify-between items-start gap-2"><b class="text-sm">${f.icon} ${f.name}</b>${have ? '<span class="wtag">✓ в убежище</span>' : ''}</div>
        <div class="text-[11px] text-white/55 leading-snug my-1">${f.desc}</div>
        ${have
          ? `<div class="text-[11px] text-emerald-300/90 mt-1.5">${f.hint}</div>`
          : `<div class="flex items-center gap-2 mt-2"><button class="btn sm main" data-act="fcraft" data-id="${f.id}" ${can ? '' : 'disabled'}>🔨 Сделать · ${f.cost} 🪵</button>${can ? '' : `<span class="text-[10px] text-white/45">не хватает: ${f.cost - save.wood} 🪵</span>`}</div>`}
      </div></div>`;
  }).join('');
  const got = FURNITURE.filter(f => save.furniture[f.id]).length;
  return `<div class="chip mb-3">🪵 Древесина: <b>${save.wood}</b></div>
    <h3 class="font-bold mb-2 text-sm text-emerald-300">🪑 Мебель для убежища <span class="text-white/50 text-xs">(${got} / ${FURNITURE.length})</span></h3>
    <div class="space-y-2">${cards}</div>
    <p class="text-xs text-white/45 mt-3">Древесину находят в ящиках в сети бункеров — особенно в деревянных ящиках на складах и в коридорах. Вся мебель делается только из неё и сразу появляется в убежище.</p>`;
}
function stationHTML(id) {
  if (id === 'bench') {
    const btabs = `<div class="set-tabs" style="max-width:30rem"><button data-act="btab" data-id="weapons" class="${benchTab === 'weapons' ? 'on' : ''}">🔫 Оружие и мастерская</button><button data-act="btab" data-id="furniture" class="${benchTab === 'furniture' ? 'on' : ''}">🪑 Мебель</button></div>`;
    if (benchTab === 'furniture') return btabs + furnitureHTML();
    const statsHTML = st => `<div class="wstats">${st.map(([n, v]) => `<div><span>${n}</span><i><b style="width:${v}%"></b></i></div>`).join('')}</div>`;
    const slotName = id => SLOTS.find(x => x.id === WEAPONS[id].slot).name;
    const starter = (pc, id, slotN, tail) => `<div class="wcard have">
        <canvas class="wprev" data-wpn="${id}" title="Потяните мышью, чтобы повернуть"></canvas>
        <div class="wbody">
          <div class="flex justify-between items-start gap-2"><b class="text-sm">${pc.name}</b><span class="wtag">✓ стартовое</span></div>
          <div class="text-[11px] text-white/55 leading-snug my-1">${pc.desc}</div>
          ${statsHTML(pc.stats)}
          <div class="text-[11px] text-emerald-300/90 mt-1.5">${tail}${id === 'pipe' ? equipCtl('pipe') : ''}</div>
        </div></div>`;
    // кнопка/метка слота для собранного оружия ближнего боя и основного
    const equipCtl = id => isEquipped(id)
      ? ` <span class="wtag" style="margin-left:.4rem">⚔ в слоте «${slotName(id)}»</span>`
      : ` <button class="btn sm main" style="margin-left:.4rem" data-act="hubequip" data-id="${id}">⚔ Экипировать в слот «${slotName(id)}»</button>`;
    const pcard = starter(PISTOL_CARD, 'pistol', 2, `Слот «Пистолет» · клавиша ${kbd('w2')}`)
      + starter(PIPE_CARD, 'pipe', 3, `Слот «Ближний бой» · клавиша ${kbd('w3')} · быстрый удар ${kbd('melee')}.`);
    const wcards = WCRAFT.map(w => {
      const have = save.weapons[w.id], can = save.scrap >= w.cost;
      const locked = w.blueprint && !save.blueprints[w.blueprint];
      if (locked) {
        return `<div class="wcard locked">
        <div class="wprev-wrap"><canvas class="wprev dark" data-wpn="${w.id}"></canvas><span class="lockico">🔒</span></div>
        <div class="wbody">
          <div class="flex justify-between items-start gap-2"><b class="text-sm">${w.name}</b><span class="wtag" style="color:#ffcf7a">📐 нет чертежа</span></div>
          <div class="text-[11px] text-white/55 leading-snug my-1">Секретная разработка. Чтобы собрать это оружие, нужно найти его <b>чертёж</b> — он спрятан в ящиках сети бункеров. Исследуйте контейнеры (особенно ящики, оружейные и инструментальные) и вернитесь в убежище с находкой.</div>
          <div class="wstats" style="opacity:.35">${w.stats.map(([n]) => `<div><span>${n}</span><i><b style="width:0%"></b></i></div>`).join('')}</div>
          <div class="mt-2"><button class="btn sm" disabled>🔒 Чертёж не найден</button></div>
        </div></div>`;
      }
      return `<div class="wcard ${have ? 'have' : ''}">
        <canvas class="wprev" data-wpn="${w.id}" title="Потяните мышью, чтобы повернуть"></canvas>
        <div class="wbody">
          <div class="flex justify-between items-start gap-2"><b class="text-sm">${w.name}</b>${have ? '<span class="wtag">✓ в арсенале</span>' : w.blueprint ? '<span class="wtag" style="color:#9fe8ff">📐 чертёж найден</span>' : ''}</div>
          <div class="text-[11px] text-white/55 leading-snug my-1">${w.desc}</div>
          ${statsHTML(w.stats)}
          ${have
            ? `<div class="text-[11px] text-emerald-300/90 mt-1.5">${w.melee ? `Слот «Ближний бой» · клавиша ${kbd('w3')}.` : `Патроны — ниже, в мастерской. Слот «Основное» · клавиша ${kbd('w1')}.`}${equipCtl(w.id)}</div>`
            : `<div class="flex items-center gap-2 mt-2"><button class="btn sm main" data-act="wcraft" data-id="${w.id}" ${can ? '' : 'disabled'}>🔨 Собрать · ${w.cost} 🔩</button><span class="text-[10px] text-white/45">${w.giveTxt}</span></div>`}
        </div></div>`;
    }).join('');
    const craft = CRAFT.filter(c => !c.need || save.weapons[c.need]).map(c => `<button class="btn sm" style="width:100%" data-act="craft" data-id="${c.id}" ${save.scrap < c.cost ? 'disabled' : ''}>${c.name}</button>`).join('');
    return btabs + `<div class="bench-grid">
      <div><div class="chip mb-3">🔩 Металлолом: <b>${save.scrap}</b></div>
        <h3 class="font-bold mb-2 text-sm text-emerald-300">🔫 Крафт оружия</h3><div class="space-y-2 mb-4">${pcard}${wcards}</div>
        <h3 class="font-bold mb-2 text-sm text-emerald-300">🛠 Мастерская</h3><div class="grid sm:grid-cols-2 gap-2">${craft}</div>
        <p class="text-xs text-white/45 mt-3">Металлолом приносят с вылазок. Из него выходят оружие, патроны, бинты, аптечки и батареи.</p></div>
      <div><h3 class="font-bold mb-2 text-sm text-emerald-300">⬆ Улучшения</h3><div class="space-y-2">${Object.keys(UPS).map(upCard).join('')}</div></div></div>`;
  }
  if (id === 'table') {
    const tabs = `<div class="set-tabs" style="max-width:26rem"><button data-act="tab" data-id="notes" class="${tableTab === 'notes' ? 'on' : ''}">📻 Сводка и дневник</button><button data-act="tab" data-id="almanac" class="${tableTab === 'almanac' ? 'on' : ''}">📕 Альманах Бывших</button></div>`;
    if (tableTab === 'almanac') return tabs + almanacHTML();
    const jr = save.notes.length
      ? save.notes.map(i => `<div class="noteitem" data-act="note" data-id="${i}">📄 ${NOTES[i][0]}</div>`).join('')
      : '<div class="text-white/45 text-sm">Пока пусто. Записки найдутся в ящиках и хранилищах. Всего их ' + NOTES.length + '.</div>';
    return tabs + `<div class="grid md:grid-cols-2 gap-4">
      <div><h3 class="font-bold mb-2 text-sm text-emerald-300">📻 Сводка дня ${save.day}</h3>
        <p class="text-sm text-white/80 leading-relaxed">${HUB_LINES[Math.min(HUB_LINES.length - 1, Math.floor((save.day - 1) / 2))]}</p></div>
      <div><h3 class="font-bold mb-2 text-sm text-emerald-300">📖 Дневник находок <span class="text-white/50 text-xs">(${save.notes.length} / ${NOTES.length})</span></h3>
        <div style="max-height:11rem;overflow:auto">${jr}</div>
        <div id="stNote" class="text-sm text-white/80 mt-2 leading-relaxed"></div></div></div>`;
  }
  if (id === 'shelf') {
    const cap = 8 + 2 * save.up.bag;
    return `<div class="grid md:grid-cols-2 gap-4">
      <div>${STASH_KEYS.map(k => `<div class="stat"><span>${LABELS[k]}</span><b>${save[k]}</b></div>`).join('')}</div>
      <div class="text-sm">${save.food > 0
        ? `<span class="text-white/60">Рацион: −1 🍞 перед вылазкой. С собой: до 2 аптечек, 2 бинтов, 2 батарей и 24 патронов.</span>`
        : `<span style="color:#ff8c80">Еды нет! Вы выйдете голодным: −35% к здоровью.</span>`}
        <div class="text-white/60 mt-2">🎒 Рюкзак: <b>${cap}</b> ячеек.</div>
        <p class="text-xs text-white/45 mt-3">Банки, аптечки, патроны и батареи на полках соответствуют вашим запасам.</p></div></div>`;
  }
  if (id === 'bed') {
    return `<div class="grid md:grid-cols-2 gap-4">
      <div>
        <div class="stat"><span>День</span><b>${save.day}</b></div>
        <div class="stat"><span>Вылазок</span><b>${save.sorties}</b></div>
        <div class="stat"><span>Убито бывших</span><b>${save.kills}</b></div>
        <div class="stat"><span>Потерь</span><b>${save.deaths}</b></div>
        <button class="btn main mt-4" data-act="rest">😴 Прилечь и отдохнуть</button></div>
      <div><div id="stRest" class="rest-text">Узкая кровать у стены. Единственное место в убежище, где можно ненадолго забыть о коридорах.</div></div></div>`;
  }
  return '';
}
let previewer = null, almViewer = null, furnPreviewer = null;
function renderStation() {
  if (!hubStation) return;
  $('stBody').innerHTML = stationHTML(hubStation);
  if (hubStation === 'bench' && benchTab === 'weapons') {
    try {
      if (!previewer) previewer = new WeaponPreviewer(['pistol', 'pipe', ...WCRAFT.map(w => w.id)]);
      previewer.attach([...document.querySelectorAll('#stBody canvas[data-wpn]')]); previewer.start();
    } catch (err) { console.warn('weapon preview failed', err); }
  } else if (previewer) previewer.stop();
  if (hubStation === 'bench' && benchTab === 'furniture') {
    try {
      if (!furnPreviewer) furnPreviewer = new FurniturePreviewer(FURNITURE.map(f => f.id));
      furnPreviewer.attach([...document.querySelectorAll('#stBody canvas[data-furn]')]); furnPreviewer.start();
    } catch (err) { console.warn('furniture preview failed', err); }
  } else if (furnPreviewer) furnPreviewer.stop();
  if (hubStation === 'table' && tableTab === 'almanac') {
    try {
      if (!almViewer) almViewer = new MonsterViewer(tp => { const m = buildMonster(tp); m.userData.almHunch = MT[tp].hunch; return m; });
      almViewer.mount($('almCanvas'), almSel, almKnown(almSel));
    } catch (err) { console.warn('almanac viewer failed', err); }
  } else if (almViewer) almViewer.stop();
}
function openStation(id) {
  hubStation = id; hubSetMode('panel');
  if (document.pointerLockElement) document.exitPointerLock();
  $('stTitle').textContent = STATION_TITLES[id]; renderStation();
  show('scr-station'); sfx.open();
}
function closeStation() {
  if (hubMode !== 'panel') return;
  hubStation = null; if (previewer) previewer.stop(); if (furnPreviewer) furnPreviewer.stop(); if (almViewer) almViewer.stop(); show('scr-station', false); hubResume();
}
$('stClose').onclick = closeStation;
$('scr-station').addEventListener('click', e => {
  if (e.target === $('scr-station')) { closeStation(); return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = b.dataset.id, act = b.dataset.act;
  let changed = false;
  if (act === 'tab') { tableTab = id; sfx.click(); renderStation(); return; }
  if (act === 'btab') { benchTab = id; sfx.click(); renderStation(); return; }
  if (act === 'alm') { almSel = id; sfx.click(); renderStation(); return; }
  if (act === 'craft') {
    const c = CRAFT.find(x => x.id === id);
    if (c && save.scrap >= c.cost) { save.scrap -= c.cost; for (const k in c.give) save[k] += c.give[k]; changed = true; sfx.pick(); }
  } else if (act === 'wcraft') {
    const w = WCRAFT.find(x => x.id === id);
    if (w && !save.weapons[id] && save.scrap >= w.cost && (!w.blueprint || save.blueprints[w.blueprint])) { save.scrap -= w.cost; save.weapons[id] = true; for (const k in w.give) save[k] += w.give[k]; save.equip[WEAPONS[id].slot] = id; if (!WEAPONS[id].melee) save.wpn = id; changed = true; sfx.heal(); setTimeout(() => sfx.pick(), 120); }
  } else if (act === 'fcraft') {
    const f = FURNITURE.find(x => x.id === id);
    if (f && !save.furniture[id] && save.wood >= f.cost) {
      save.wood -= f.cost; save.furniture[id] = true; changed = true; sfx.heal();
      if (id === 'candle') { candleLit = true; hub.setCandle(true); }
      toast(`${f.icon} ${f.name} — готово! ${f.hint}`, 'good');
    }
  } else if (act === 'hubequip') {
    const W = WEAPONS[id];
    if (W && W.slot !== 'pistol' && isOwned(id) && !isEquipped(id)) { save.equip[W.slot] = id; if (!W.melee) save.wpn = id; changed = true; sfx.pick(); }
  } else if (act === 'up') {
    const u = UPS[id], l = save.up[id], cost = u.cost(l);
    if (l < u.max && save.scrap >= cost) { save.scrap -= cost; save.up[id]++; changed = true; sfx.heal(); }
  } else if (act === 'note') {
    $('stNote').innerHTML = `<b class="text-amber-200">${NOTES[id][0]}</b><br>${NOTES[id][1]}`; sfx.click();
  } else if (act === 'rest') {
    const f = $('hfade'); f.style.opacity = 1; sfx.heal();
    setTimeout(() => { const r = $('stRest'); if (r) r.textContent = pick(REST_LINES); f.style.opacity = 0; }, 900);
  }
  if (changed) { store(); renderStation(); hub.refresh(save); renderHubHud(); }
});

/* ---------- Взаимодействие, ввод, обновление ---------- */
function hubInteract() {
  if (hubMode === 'walk' && hp.sit) { standUp(); return; }
  if (hubMode !== 'walk' || !hubNear) return;
  if (hubNear.furn) {
    const id = hubNear.id;
    if (id === 'chair') sitDown();
    else if (id === 'radio') radioNext();
    else if (id === 'candle') { candleLit = !candleLit; hub.setCandle(candleLit); sfx.click(); noise(0.18, 0.05, 1800); toast(candleLit ? '🕯 Свеча зажжена' : '🕯 Свеча погашена', 'info'); }
    else if (id === 'painting') { sfx.click(); toast(PAINTING_LINES[paintI++ % PAINTING_LINES.length], 'info'); }
    return;
  }
  if (hubNear.id === 'door') {
    hubSetMode('busy'); initAudio(); sfx.door();
    if (document.pointerLockElement) document.exitPointerLock();
    const f = $('hfade'); f.style.opacity = 1;
    setTimeout(() => { if (state !== 'hub') return; startSortie(); f.style.opacity = 0; }, 850);
    return;
  }
  openStation(hubNear.id);
}
function hubKey(e) {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (hubMode === 'panel') { if (e.code === 'Escape' || actionOf(e.code) === 'interact') closeStation(); return; }
  if (hubMode !== 'walk') return;
  keys[e.code] = true;
  if (actionOf(e.code) === 'interact') hubInteract();
  else if (e.code === 'Escape' && fallback) hubPause();
}
function updateHub(dt) {
  time += dt; const p = hp;
  let spd = 0;
  if (hubMode === 'walk') {
    if (keys.ArrowLeft) p.yaw += 2 * dt; if (keys.ArrowRight) p.yaw -= 2 * dt;
    if (keys.ArrowUp) p.pitch = clamp(p.pitch + 1.5 * dt, -1.4, 1.4); if (keys.ArrowDown) p.pitch = clamp(p.pitch - 1.5 * dt, -1.4, 1.4);
    const f = (down('forward') ? 1 : 0) - (down('back') ? 1 : 0), s = (down('right') ? 1 : 0) - (down('left') ? 1 : 0);
    const sp = down('sprint') ? 4.6 : 2.9;
    let tx = 0, tz = 0;
    if (f || s) {
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      tx = fx * f + rx * s; tz = fz * f + rz * s; const l = Math.hypot(tx, tz); tx = tx / l * sp; tz = tz / l * sp;
    }
    if (p.sit && (f || s)) standUp();      // любое движение — встать со стула
    if (p.sit) { tx = tz = 0; }
    const k = Math.min(1, dt * 9); p.vx += (tx - p.vx) * k; p.vz += (tz - p.vz) * k;
  } else { const k = Math.min(1, dt * 9); p.vx -= p.vx * k; p.vz -= p.vz * k; }
  if (p.sit) { p.vx = p.vz = 0; p.x = hub.chair.x; p.z = hub.chair.z; }
  else { p.x += p.vx * dt; p.z += p.vz * dt; hub.collide(p, 0.34); }
  spd = Math.hypot(p.vx, p.vz);
  p.eye += ((p.sit ? hub.chair.eye : 1.65) - p.eye) * Math.min(1, dt * 6);
  if (spd > 0.5) { p.stepT -= dt * spd; if (p.stepT <= 0) { p.stepT = 1.9; sfx.step(0.045); } }
  p.bobT += spd * dt * 2.2;
  const bob = settings.bob ? Math.sin(p.bobT) * 0.03 * Math.min(1, spd / 2.9) : 0;
  camera.position.set(p.x, p.eye + bob, p.z); camera.rotation.set(p.pitch, p.yaw, 0);

  let near = null;
  if (hubMode === 'walk' && !p.sit) {
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw); let bd = 1e9;
    for (const st of hub.stations) {
      if (st.enabled === false) continue;
      const d = Math.hypot(st.x - p.x, st.z - p.z); if (d >= st.reach) continue;
      const mx = st.marker[0] - p.x, mz = st.marker[2] - p.z, md = Math.hypot(mx, mz) || 1;
      if ((md < 1.1 || (mx * fx + mz * fz) / md > 0.35) && d < bd) { near = st; bd = d; }
    }
  }
  hubNear = near;
  if (near) {
    let txt = PROMPTS[near.id];
    if (near.id === 'radio') txt = 'Радио — ' + (radioWave ? 'сменить волну / выключить' : 'включить');
    if (near.id === 'candle') txt = 'Свеча — ' + (candleLit ? 'задуть' : 'зажечь');
    if (near.id === 'door' && save.food <= 0) txt += ' (без еды!)';
    $('hPromptText').textContent = txt; $('hPromptKey').textContent = bindName('interact');
    $('hPrompt').firstElementChild.classList.toggle('go', near.id === 'door');
    show('hPrompt');
  } else if (hp.sit && hubMode === 'walk') {
    $('hPromptText').textContent = 'Встать со стула (или просто пойти)'; $('hPromptKey').textContent = bindName('interact');
    $('hPrompt').firstElementChild.classList.remove('go'); show('hPrompt');
  } else show('hPrompt', false);
  hub.update(time, dt, near ? near.id : null);
}

function goHub() {
  menuMusic.stop(1.6); bunkerAmbient.stop(2);
  state = 'hub'; running = false; invOpen = false;
  show('scr-menu', false); show('scr-result', false); show('scr-lock', false); show('scr-inv', false); show('hud', false); show('vig', false);
  $('danger').style.opacity = 0; $('dmg').style.opacity = 0;
  if (document.pointerLockElement) document.exitPointerLock();
  enterHubScene();
  hideHubUI(); show('hubhud'); renderHubHud();
  hubStation = null; hubSetMode('pause'); hubPause();
}
function goMenu() {
  state = 'menu'; hideHubUI(); show('scr-result', false); show('scr-menu');
  if (document.pointerLockElement) document.exitPointerLock();
  applySettings(); refreshHints();
show('btnContinue', !!save);
}

$('btnMusic').onclick = () => { settings.music = !settings.music; storeSettings(); syncMusic(); sfx.click(); };
$('btnContinue').onclick = () => { initAudio(); goHub(); };
$('btnNew').onclick = () => {
  if (save && !confirm('Начать заново? Текущее сохранение будет удалено.')) return;
  save = JSON.parse(JSON.stringify(DEF_SAVE)); store(); initAudio(); goHub();
};
$('btnHelp').onclick = () => $('helpBox').classList.toggle('off');
$('hubMenu').onclick = goMenu;
$('hubEnter').onclick = hubResume;
$('btnResult').onclick = goHub;


/* ====================== НАСТРОЙКИ: ИНТЕРФЕЙС ====================== */
const SENS = () => 0.0022 * settings.sens * (camera.fov / settings.fov);   // при зуме чувствительность падает пропорционально
const SET_ROWS = [
  { tab: 'main', h: '🔊 Звук' },
  { tab: 'main', k: 'vol', t: 'Общая громкость', type: 'range', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
  { tab: 'main', k: 'music', t: 'Музыка в главном меню', type: 'check' },
  { tab: 'main', k: 'musicVol', t: 'Громкость музыки', type: 'range', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
  { tab: 'main', h: '🖥 Изображение' },
  { tab: 'main', k: 'fov', t: 'Поле зрения (FOV)', type: 'range', min: 60, max: 110, step: 1, fmt: v => v + '°' },
  { tab: 'main', k: 'bright', t: 'Яркость', type: 'range', min: 0.6, max: 2, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
  { tab: 'main', k: 'quality', t: 'Качество графики', type: 'select', opts: ['Низкое', 'Среднее', 'Высокое'] },
  { tab: 'main', k: 'shadows', t: 'Тени от фонаря', type: 'check' },
  { tab: 'main', k: 'bob', t: 'Покачивание камеры при ходьбе', type: 'check' },
  { tab: 'main', k: 'shake', t: 'Тряска камеры (выстрелы, удары)', type: 'check' },
  { tab: 'ctrl', h: '🖱 Мышь' },
  { tab: 'ctrl', k: 'sens', t: 'Чувствительность мыши', type: 'range', min: 0.3, max: 3, step: 0.05, fmt: v => '×' + (+v).toFixed(2) },
  { tab: 'ctrl', k: 'invertY', t: 'Инвертировать ось Y (взгляд вверх/вниз)', type: 'check' },
  { tab: 'ctrl', k: 'aimToggle', t: 'Прицеливание переключателем (а не удержанием)', type: 'check' }
];
// Переназначаемые действия: [id, подпись]
const BIND_GROUPS = [
  ['🚶 Движение', [['forward', 'Вперёд'], ['back', 'Назад'], ['left', 'Влево'], ['right', 'Вправо'], ['sprint', 'Бег'], ['crouch', 'Красться (держать)']]],
  ['🔫 Оружие', [['fire', 'Выстрел'], ['aim', 'Прицеливание'], ['reload', 'Перезарядка'], ['melee', 'Быстрый удар ближним оружием'],
    ['w1', 'Слот 1 — основное оружие'], ['w2', 'Слот 2 — пистолет'], ['w3', 'Слот 3 — ближний бой']]],
  ['🎒 Действия', [['interact', 'Использовать / обыскать (держать)'], ['inventory', 'Инвентарь'], ['flash', 'Фонарь'], ['heal', 'Лечение']]]
];
const BIND_LABEL = {}; BIND_GROUPS.forEach(([, l]) => l.forEach(([a, t]) => BIND_LABEL[a] = t));
let setTab = 'main', listening = null, suppressBindClick = 0, bindMsg = '';
function syncMusic() {
  menuMusic.setVolume(settings.vol * settings.musicVol);
  bunkerAmbient.setVolume(settings.vol * settings.musicVol * 1.15);
  if (state === 'menu' && settings.music) menuMusic.start(); else menuMusic.stop(1.4);
  if (state === 'sortie' && settings.music) bunkerAmbient.start(); else bunkerAmbient.stop(state === 'sortie' ? 1.5 : 2.5);
  const b = $('btnMusic'); if (b) b.textContent = settings.music ? '🎵 Музыка: вкл' : '🔇 Музыка: выкл';
}
function applySettings() {
  camera.fov = settings.fov; camera.updateProjectionMatrix();
  if (master) master.gain.value = settings.vol;
  syncMusic();
  renderer.setPixelRatio(QUALITY_PR[settings.quality] ?? 1); renderer.setSize(innerWidth, innerHeight);
  spot.castShadow = settings.shadows;
  ambient.intensity = ambBase * settings.bright;
}
function settingRowHTML(r) {
  if (r.h) return `<div class="set-h">${r.h}</div>`;
  const v = settings[r.k];
  if (r.type === 'range') return `<label class="set-row"><span>${r.t}</span><input type="range" data-set="${r.k}" min="${r.min}" max="${r.max}" step="${r.step}" value="${v}"><b data-val="${r.k}">${r.fmt(v)}</b></label>`;
  if (r.type === 'check') return `<label class="set-row"><span>${r.t}</span><input type="checkbox" data-set="${r.k}" ${v ? 'checked' : ''}><i class="sw"></i></label>`;
  return `<label class="set-row"><span>${r.t}</span><select data-set="${r.k}">${r.opts.map((o, i) => `<option value="${i}" ${i === +v ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;
}
function renderSettings() {
  const tabs = `<div class="set-tabs"><button data-tab="main" class="${setTab === 'main' ? 'on' : ''}">🖥 Общие</button><button data-tab="ctrl" class="${setTab === 'ctrl' ? 'on' : ''}">🎮 Управление</button></div>`;
  let body = '';
  if (setTab === 'main') body = SET_ROWS.filter(r => r.tab === 'main').map(settingRowHTML).join('');
  else {
    body = SET_ROWS.filter(r => r.tab === 'ctrl').map(settingRowHTML).join('');
    for (const [title, list] of BIND_GROUPS) {
      body += `<div class="set-h">${title}</div>` + list.map(([a, t]) => {
        const on = listening === a;
        return `<div class="bind-row"><span>${t}</span><button class="bind-btn ${on ? 'listen' : ''}" data-bind="${a}">${on ? 'Нажмите клавишу…' : bindName(a)}</button></div>`;
      }).join('');
    }
    body += `<p class="bind-note">${listening ? `Нажмите клавишу или кнопку мыши для действия «${BIND_LABEL[listening]}». <b>Esc</b> — отмена.` : (bindMsg || 'Нажмите на кнопку справа от действия, затем — на новую клавишу или кнопку мыши. Если клавиша уже занята, действия поменяются местами.')}</p>`
      + `<p class="bind-note">Неизменяемые: <kbd>Esc</kbd> — пауза · колесо мыши — смена оружия · стрелки — поворот камеры.</p>`;
  }
  const keepScroll = $('setBody').scrollTop;
  $('setBody').innerHTML = tabs + body; $('setBody').scrollTop = keepScroll;
}
function refreshHints() {
  const K = kbd, mv = `${K('forward')}${K('left')}${K('back')}${K('right')}`;
  $('hudHint').innerHTML = `${K('inventory')} инвентарь · ${K('aim')} прицел · ${K('heal')} лечение · ${K('flash')} фонарь · ${K('reload')} перезарядка · ${K('w1')}–${K('w3')}/колесо оружие`;
  $('hubHint').innerHTML = `${mv} ходьба · ${K('sprint')} быстрее · ${K('interact')} использовать · <kbd>Esc</kbd> пауза`;
  $('invCloseKey').textContent = bindName('inventory');
  $('hPromptKey').textContent = bindName('interact');
  $('helpBox').innerHTML = `
      <p>${mv} — ходьба · ${K('sprint')} — бег · ${K('crouch')} (держать) — красться</p>
      <p><kbd>Мышь</kbd> — обзор · ${K('fire')} — выстрел · ${K('aim')} — прицеливание (держать${settings.aimToggle ? ' / переключить' : ''}) · ${K('melee')} — быстрый удар ближним оружием</p>
      <p>${K('interact')} (держать) — обыск ящиков и тел, шлюз · ${K('interact')} — открыть уже обысканный контейнер</p>
      <p>${K('inventory')} / <kbd>I</kbd> — инвентарь (игра на паузе) · ${K('heal')} — лечение · ${K('flash')} — фонарь · ${K('reload')} — перезарядка</p>
      <p>${K('w1')} основное · ${K('w2')} пистолет · ${K('w3')} ближний бой · колесо мыши — смена оружия · огнемёт и АС «Вал» стреляют, пока ${K('fire')} зажата</p>
      <p>Прицеливание приближает картинку, уменьшает разброс и отдачу, но замедляет ход. У винтовки — настоящая оптика. Бег, перезарядка и удар ближним оружием сбивают прицел.</p>
      <p><kbd>Esc</kbd> — пауза · стрелки — поворот камеры · раскладку можно изменить в «Настройки → Управление»</p>
      <p class="text-amber-200/90 pt-2">Бывшие реагируют на <b>шум</b> и <b>свет</b>. У каждого контейнера — своё содержимое и ограниченное число ячеек: берите нужное, кладите лишнее обратно. Рюкзак тоже ограничен. Найдите карту доступа, откройте хранилище и вернитесь к шлюзу. Погибнете — потеряете всё, что несли.</p>
      <p class="text-amber-100/90">🪵 В ящиках (особенно деревянных) встречается <b>древесина</b>. На верстаке, во вкладке «Мебель», из неё делают свечу, стул, картину и радио — они появятся в убежище.</p>
      <p class="text-cyan-200/90">📐 На верстаке можно собрать винтовку, дробовик и огнемёт. А вот бесшумный <b>АС «Вал»</b> — только по чертежу, который спрятан в ящиках сети бункеров. Найдите его и донесите до убежища.</p>
      <p class="text-white/60">Сеть разбита на зоны: жилой блок, медпункт, столовая, склад, серверная, генераторная, оружейная. В каждой — своя обстановка и своя добыча. Ты здесь один — рассчитывай только на себя.</p>`;
}
function openSettings() { listening = null; bindMsg = ''; renderSettings(); show('scr-settings'); }
function closeSettings() { listening = null; show('scr-settings', false); storeSettings(); refreshHints(); }
function onSettingInput(e) {
  const el = e.target.closest('[data-set]'); if (!el) return;
  const row = SET_ROWS.find(r => r.k === el.dataset.set); if (!row) return;
  settings[row.k] = row.type === 'check' ? el.checked : +el.value;
  if (row.type === 'range') { const b = $('setBody').querySelector(`[data-val="${row.k}"]`); if (b) b.textContent = row.fmt(settings[row.k]); }
  applySettings(); storeSettings(); refreshHints();
}
function setBind(a, code) {
  const old = settings.binds[a]; bindMsg = '';
  if (old === code) return;
  for (const o in settings.binds) if (o !== a && settings.binds[o] === code) { settings.binds[o] = old; bindMsg = `«${keyName(code)}» уже была занята — действие «${BIND_LABEL[o]}» теперь на «${keyName(old)}».`; }
  settings.binds[a] = code; storeSettings(); refreshHints();
}
function finishListen(code) {
  if (code) setBind(listening, code);
  listening = null; if (code && code.startsWith('Mouse')) suppressBindClick = performance.now() + 350; renderSettings();
}
$('setBody').addEventListener('input', onSettingInput);
$('setBody').addEventListener('change', e => { onSettingInput(e); if (e.target.dataset.set === 'vol') { initAudio(); sfx.click(); } });
$('setBody').addEventListener('click', e => {
  const t = e.target.closest('[data-tab]');
  if (t) { setTab = t.dataset.tab; listening = null; sfx.click(); renderSettings(); return; }
  const b = e.target.closest('[data-bind]');
  if (b && performance.now() > suppressBindClick) { listening = listening === b.dataset.bind ? null : b.dataset.bind; bindMsg = ''; sfx.click(); renderSettings(); }
});
$('setClose').onclick = closeSettings;
$('setReset').onclick = () => {
  listening = null; bindMsg = '';
  if (setTab === 'ctrl') { settings.binds = Object.assign({}, DEF_BINDS); for (const k of ['sens', 'invertY', 'aimToggle']) settings[k] = DEF_SET[k]; }
  else for (const k of ['vol', 'music', 'musicVol', 'fov', 'bright', 'quality', 'shadows', 'bob', 'shake']) settings[k] = DEF_SET[k];
  applySettings(); storeSettings(); refreshHints(); renderSettings();
};
$('scr-settings').addEventListener('mousedown', e => { if (e.target === $('scr-settings')) closeSettings(); });
$('btnSettings').onclick = openSettings;
$('hubSettings').onclick = openSettings;
$('lockSettings').onclick = openSettings;
// перехват клавиш и кнопок мыши в режиме «назначить»
addEventListener('keydown', e => {
  if (listening) {
    e.stopImmediatePropagation(); e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Escape') finishListen(null);
    else if (!['MetaLeft', 'MetaRight', 'ContextMenu'].includes(e.code)) finishListen(e.code);
    return;
  }
  if (e.code === 'Escape' && !$('scr-settings').classList.contains('off')) { e.stopImmediatePropagation(); e.preventDefault(); closeSettings(); }
}, true);
addEventListener('mousedown', e => {
  if (!listening) return;
  const t = e.target;
  if (t.closest('#setClose, #setReset, [data-tab]') || !t.closest('#scr-settings .panel')) { listening = null; renderSettings(); return; }
  const b = t.closest('[data-bind]'); if (b && b.dataset.bind !== listening) return;   // клик по другой кнопке — просто переключит выбор
  e.preventDefault(); e.stopPropagation(); finishListen('Mouse' + e.button);
}, true);
addEventListener('mouseup', e => { if (listening || performance.now() < suppressBindClick) e.preventDefault(); }, true);
addEventListener('auxclick', e => { if (listening || performance.now() < suppressBindClick) e.preventDefault(); }, true);

/* ====================== ВВОД ====================== */
// Нажатие действия (в вылазке, игра идёт). Клавиши и кнопки мыши приходят сюда одинаково — по привязкам из настроек.
function pressAction(a) {
  if (a === 'inventory') openInventory(null);
  else if (a === 'interact') { const it = nearestItem(); if (it && it.kind === 'box' && it.searched) openInventory(it); }
  else if (a === 'flash') toggleFlash();
  else if (a === 'reload') reload();
  else if (a === 'heal') heal();
  else if (a === 'melee') melee();
  else if (a === 'fire') { fireHeld = true; if (!cw().auto) shoot(); }
  else if (a === 'aim') aiming = settings.aimToggle ? !aiming : true;
  else if (/^w[1-3]$/.test(a)) selectSlot(SLOTS[+a.slice(1) - 1].id);
}
function releaseAction(a) {
  if (a === 'fire') fireHeld = false;
  else if (a === 'aim' && !settings.aimToggle) aiming = false;
}
addEventListener('keydown', e => {
  if (state === 'hub') { hubKey(e); return; }
  if (state !== 'sortie') return;
  const act = actionOf(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code) || act) e.preventDefault();
  if (e.repeat) return;
  if (invOpen) {
    if (e.code === 'Escape' || act === 'inventory') closeInventory();
    return;
  }
  keys[e.code] = true;
  if (!running) return;
  if (e.code === 'Escape') { if (fallback) pauseGame(); return; }
  if (act) pressAction(act);
});
addEventListener('keyup', e => {
  keys[e.code] = false;
  if (state === 'sortie') releaseAction(actionOf(e.code));
});
addEventListener('mousemove', e => {
  if (state === 'hub') {
    if (hubMode !== 'walk' || !(locked || fallback)) return;
    hp.yaw -= (e.movementX || 0) * SENS(); hp.pitch = clamp(hp.pitch - (e.movementY || 0) * SENS() * (settings.invertY ? -1 : 1), -1.4, 1.4);
    return;
  }
  if (state !== 'sortie' || !running || !(locked || fallback)) return;
  const p = player;
  p.yaw -= (e.movementX || 0) * SENS(); p.pitch = clamp(p.pitch - (e.movementY || 0) * SENS() * (settings.invertY ? -1 : 1), -1.45, 1.45);
});
addEventListener('mousedown', e => {
  const code = 'Mouse' + e.button;
  if (state === 'hub') {
    if (hubMode !== 'walk') return;
    keys[code] = true; if (e.button !== 0 && e.button !== 2) e.preventDefault();
    if (actionOf(code) === 'interact') hubInteract();
    return;
  }
  if (state !== 'sortie' || !running) return;
  if (e.button !== 0 && e.button !== 2) e.preventDefault();   // СКМ / боковые кнопки: без автопрокрутки и навигации «назад»
  keys[code] = true;
  const act = actionOf(code); if (act) pressAction(act);
});
addEventListener('mouseup', e => {
  const code = 'Mouse' + e.button;
  keys[code] = false;
  if (e.button !== 0 && e.button !== 2 && (state === 'sortie' || state === 'hub')) e.preventDefault();
  if (state === 'sortie') releaseAction(actionOf(code));
});
addEventListener('auxclick', e => { if (state === 'sortie' || state === 'hub') e.preventDefault(); });
addEventListener('wheel', e => {
  if (state !== 'sortie' || !running) return;
  const own = equippedList(); if (own.length < 2) return;
  const i = own.indexOf(player.weapon);
  switchWeapon(own[(i + (e.deltaY > 0 ? 1 : -1) + own.length) % own.length]);
}, { passive: true });
addEventListener('contextmenu', e => e.preventDefault());

/* ====================== ЦИКЛ ====================== */
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state === 'hub') { updateHub(dt); renderer.render(scene, camera); return; }
  if (state !== 'sortie' || !lv) return;
  if (running) update(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

applySettings(); refreshHints();
show('btnContinue', !!save);
window.__bk = { hp, hubInteract, hubSetMode, get hub() { return hub; }, store, openStation, startSortie, player, get save() { return save; }, openInventory, pressAction, resumeGame, renderStation, get lv() { return lv; }, update, melee, switchWeapon, equipWeapon, stationHTML, goHub, hubStation: () => hubStation, set hs(v) { hubStation = v; } };
}
