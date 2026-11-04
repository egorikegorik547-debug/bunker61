// @ts-nocheck
// Звуки оружия: многослойный синтез (WebAudio) без внешних файлов.
// Выстрел = щелчок бойка + «крэк» + корпус + низкий удар + хвост бетонной реверберации.
// Механика = резонансы металла (инхармонические обертоны) + шум трения + глухие удары.
let AC: AudioContext | null = null;
let nb: AudioBuffer | null = null;
let bus: GainNode, revIn: GainNode;
let lastFlame = -9;
const R = (a: number, b: number) => a + Math.random() * (b - a);

/** Импульсный отклик бетонного бункера: ранние отражения + тёмный затухающий хвост */
function makeIR(ac: AudioContext) {
  const sr = ac.sampleRate, len = Math.floor(sr * 2.4), buf = ac.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let y = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr, env = Math.exp(-t * 2.9), k = 0.55 * Math.exp(-t * 2.2) + 0.06;
      y += ((Math.random() * 2 - 1) * env - y) * k; d[i] = y * 1.6;
    }
    for (const [ms, a] of [[9, 0.6], [17, 0.45], [29, 0.4], [44, 0.3], [63, 0.25], [90, 0.18]]) {
      const i = Math.floor((ms + ch * 3.7) / 1000 * sr); d[i] += a * (ch ? -1 : 1);
    }
  }
  return buf;
}

export function initWeaponAudio(ac: AudioContext, master: GainNode, noiseBuf: AudioBuffer) {
  if (AC === ac) return;
  AC = ac; nb = noiseBuf;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.2;
  comp.connect(master);
  bus = ac.createGain(); bus.gain.value = 0.9; bus.connect(comp);
  const conv = ac.createConvolver(); conv.buffer = makeIR(ac);
  const rg = ac.createGain(); rg.gain.value = 0.55;
  revIn = ac.createGain(); revIn.connect(conv); conv.connect(rg); rg.connect(comp);
}

interface NO { ft?: BiquadFilterType; f?: number; f2?: number; q?: number; v?: number; a?: number; pan?: number; rev?: number }
/** Всплеск шума с фильтром, у которого частота плавно «скользит» f → f2 */
function nz(d: number, dur: number, o: NO = {}) {
  if (!AC) return;
  const t = AC.currentTime + d, s = AC.createBufferSource(); s.buffer = nb; s.loop = true;
  const f = AC.createBiquadFilter(); f.type = o.ft || 'lowpass'; f.Q.value = o.q ?? 0.7;
  f.frequency.setValueAtTime(o.f ?? 2000, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, o.f2 ?? o.f ?? 2000), t + dur);
  const g = AC.createGain(), a = o.a ?? 0.001, v = o.v ?? 0.5;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g);
  let out: AudioNode = g;
  if (o.pan && AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = o.pan; out.connect(p); out = p; }
  out.connect(bus);
  if (o.rev) { const sg = AC.createGain(); sg.gain.value = o.rev; out.connect(sg); sg.connect(revIn); }
  s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.05);
}
interface PO { type?: OscillatorType; v?: number; a?: number; rev?: number; pan?: number }
/** Тон со скольжением высоты f1 → f2 */
function ps(d: number, f1: number, f2: number, dur: number, o: PO = {}) {
  if (!AC) return;
  const t = AC.currentTime + d, os = AC.createOscillator(), g = AC.createGain();
  os.type = o.type || 'sine'; os.frequency.setValueAtTime(f1, t); os.frequency.exponentialRampToValueAtTime(Math.max(18, f2), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.v ?? 0.3, t + (o.a ?? 0.001)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  os.connect(g);
  let out: AudioNode = g;
  if (o.pan && AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = o.pan; out.connect(p); out = p; }
  out.connect(bus);
  if (o.rev) { const sg = AC.createGain(); sg.gain.value = o.rev; out.connect(sg); sg.connect(revIn); }
  os.start(t); os.stop(t + dur + 0.03);
}
/** Звон металла: несколько неупорядоченных обертонов, быстро затухающих */
function ring(d: number, f: number, v: number, dec: number, rev = 0.15, parts = [1, 2.76, 5.4, 8.93]) {
  parts.forEach((m, i) => ps(d, f * m * R(0.99, 1.01), f * m * 0.985, dec / (1 + i * 0.7), { v: v / (1 + i * 0.9), a: 0.0006, rev: i ? 0 : rev }));
}
/** Металлический стук */
function clack(d: number, v: number, f = 1100, len = 0.05, rev = 0.2) {
  nz(d, len, { ft: 'bandpass', f: f * 1.4, f2: f, q: 2.6, v: v * 1.1, a: 0.0006, rev });
  nz(d, 0.006, { ft: 'highpass', f: 2500, v: v * 0.6, a: 0.0004 });
  ring(d, f * 1.15, v * 0.5, len * 5, rev * 0.8);
}
const thud = (d: number, v: number, f = 120, len = 0.09) => {
  ps(d, f * 1.5, f * 0.45, len, { v, a: 0.002 });
  nz(d, len * 0.7, { ft: 'lowpass', f: 700, f2: 150, v: v * 0.6, a: 0.001 });
};
/** Скрип/трение металла о металл */
const scrape = (d: number, dur: number, v: number, f0: number, f1: number, q = 1.4) => {
  nz(d, dur, { ft: 'bandpass', f: f0, f2: f1, q, v, a: dur * 0.2 });
  nz(d + dur * 0.1, dur * 0.8, { ft: 'highpass', f: 3500, f2: 5200, v: v * 0.18, a: dur * 0.3 });
};
/** Шорох ткани / подсумка */
const rustle = (d: number, dur: number, v: number) => {
  const n = Math.max(3, Math.round(dur * 22));
  for (let i = 0; i < n; i++) nz(d + (i / n) * dur + R(0, 0.012), R(0.015, 0.05), { ft: 'bandpass', f: R(1200, 3600), f2: R(700, 2200), q: 0.9, v: v * R(0.25, 1), a: 0.005 });
};
/** Падающая гильза */
function brass(d: number, big = false) {
  const f = big ? R(3600, 4400) : R(5200, 6800), k = big ? 1.4 : 1;
  const hops = [0, R(0.06, 0.08), R(0.12, 0.16), R(0.17, 0.22)];
  hops.forEach((h, i) => {
    const v = (0.22 - i * 0.05) * k;
    nz(d + h, 0.03, { ft: 'bandpass', f, f2: f * 0.9, q: 6, v, a: 0.0005, pan: R(-0.4, 0.4), rev: 0.25 });
    ps(d + h, f * 0.9, f * 0.85, 0.07, { v: v * 0.4, a: 0.0005 });
  });
}

/* ================= ВЫСТРЕЛЫ ================= */
function crackLayer(v: number, hi: number, lo: number, dur: number, rev: number) {
  nz(0, 0.004, { ft: 'highpass', f: 1400, v: v * 1.1, a: 0.0004 });
  nz(0, dur, { ft: 'bandpass', f: hi, f2: lo, q: 0.8, v: v * 0.95, a: 0.0006, rev: rev * 0.7 });
}
const SHOTS: Record<string, () => void> = {
  pistol() {
    const r = R(0.94, 1.07);
    crackLayer(0.95, 3400 * r, 1700, 0.035, 0.4);
    nz(0, 0.12, { ft: 'lowpass', f: 4200, f2: 300, v: 0.85, a: 0.0008, rev: 0.5 });
    ps(0, 210 * r, 55, 0.16, { v: 0.75, a: 0.001, rev: 0.2 });
    ps(0, 520, 130, 0.05, { type: 'triangle', v: 0.22 });
    nz(0.012, 0.6, { ft: 'lowpass', f: 1000, f2: 140, v: 0.2, a: 0.015, rev: 1 });
    brass(R(0.22, 0.3));
  },
  rifle() {
    const r = R(0.95, 1.05);
    crackLayer(1.15, 4600 * r, 1200, 0.07, 0.6);
    nz(0, 0.34, { ft: 'lowpass', f: 3800, f2: 160, v: 1.0, a: 0.001, rev: 0.7 });
    ps(0, 130 * r, 30, 0.55, { v: 0.95, a: 0.002, rev: 0.3 });
    ps(0, 82, 28, 0.5, { type: 'sawtooth', v: 0.28, a: 0.003 });
    ps(0, 2800, 700, 0.08, { type: 'square', v: 0.05 });          // сверхзвуковой «щелчок»
    nz(0.02, 1.5, { ft: 'lowpass', f: 900, f2: 90, v: 0.3, a: 0.04, rev: 1.3 });
    nz(0.09, 0.5, { ft: 'bandpass', f: 520, f2: 220, q: 0.6, v: 0.22, a: 0.02, rev: 1 });  // «эхо» коридора
  },
  shotgun() {
    const r = R(0.95, 1.05);
    crackLayer(1.1, 2600 * r, 800, 0.06, 0.6);
    nz(0, 0.42, { ft: 'lowpass', f: 3000, f2: 140, v: 1.2, a: 0.0008, rev: 0.8 });
    ps(0, 105 * r, 26, 0.6, { v: 1.0, a: 0.002, rev: 0.4 });
    ps(0, 62, 22, 0.55, { type: 'sawtooth', v: 0.4, a: 0.003 });
    nz(0.02, 1.4, { ft: 'lowpass', f: 700, f2: 80, v: 0.35, a: 0.04, rev: 1.4 });
    nz(0, 0.2, { ft: 'highpass', f: 1800, f2: 3500, v: 0.22, a: 0.001, rev: 0.3 });    // россыпь картечи
  },
  asval() {
    const r = R(0.92, 1.08);
    nz(0, 0.05, { ft: 'bandpass', f: 1100 * r, f2: 500, q: 0.9, v: 0.5, a: 0.0006, rev: 0.12 });     // «пфф» глушителя
    nz(0, 0.003, { ft: 'highpass', f: 2200, v: 0.18, a: 0.0003 });
    ps(0, 300 * r, 110, 0.05, { v: 0.2, a: 0.001 });
    // лязг подвижной рамы: вперёд-назад, главный звук подавленного автомата
    clack(0.006, 0.42, 900 * r, 0.04, 0.1);
    clack(0.032, 0.34, 640 * r, 0.04, 0.1);
    nz(0.01, 0.08, { ft: 'bandpass', f: 2200, f2: 1500, q: 1.5, v: 0.1, a: 0.002 });
    if (Math.random() < 0.45) brass(R(0.18, 0.3));
  },
  flame() {
    const now = AC!.currentTime;
    if (now - lastFlame > 0.35) {                                                   // воспламенение
      ps(0, 90, 40, 0.28, { v: 0.5, a: 0.02, rev: 0.4 });
      nz(0, 0.18, { ft: 'lowpass', f: 1800, f2: 200, v: 0.55, a: 0.004, rev: 0.6 });
      nz(0, 0.03, { ft: 'highpass', f: 3000, v: 0.3, a: 0.0005 });
    }
    lastFlame = now;
    nz(0, 0.26, { ft: 'bandpass', f: R(700, 900), f2: R(1800, 2400), q: 0.5, v: 0.34, a: 0.03, rev: 0.4 });  // струя
    nz(0, 0.3, { ft: 'lowpass', f: 520, f2: 180, v: 0.4, a: 0.025, rev: 0.5 });                                 // рёв пламени
    nz(0, 0.2, { ft: 'highpass', f: 4200, v: 0.14, a: 0.02 });                                                  // шипение газа
    for (let i = 0; i < 3; i++) nz(R(0, 0.2), 0.015, { ft: 'bandpass', f: R(1500, 3500), q: 3, v: 0.2, a: 0.0005 }); // потрескивание
  }
};

/* ================= МЕХАНИКА: события анимации ================= */
type Ev = () => void;
const EV: Record<string, Record<string, Ev>> = {
  pistol: {
    magrel: () => { clack(0, 0.4, 2400, 0.02, 0.05); thud(0.012, 0.25, 220, 0.04); },
    magout: () => { scrape(0, 0.1, 0.3, 1800, 900); thud(0.09, 0.3, 180, 0.06); rustle(0.05, 0.08, 0.1); },
    pouch: () => { rustle(0, 0.28, 0.3); clack(0.2, 0.18, 2200, 0.02, 0.05); },
    magin: () => { scrape(0, 0.07, 0.3, 1500, 2600); thud(0.06, 0.55, 150, 0.07); clack(0.062, 0.5, 1900, 0.035, 0.12); },
    slap: () => { thud(0, 0.6, 110, 0.08); nz(0, 0.05, { ft: 'lowpass', f: 1500, f2: 300, v: 0.35, a: 0.001 }); },
    slidebk: () => { scrape(0, 0.12, 0.42, 2200, 1100, 2); clack(0.115, 0.5, 1300, 0.05, 0.2); rustle(0, 0.1, 0.1); },
    slidefw: () => { nz(0, 0.015, { ft: 'highpass', f: 1800, v: 0.3 }); clack(0.01, 0.95, 1000, 0.07, 0.35); ring(0.012, 2100, 0.25, 0.25, 0.25); thud(0.012, 0.45, 160, 0.06); }
  },
  asval: {
    magrel: () => { clack(0, 0.5, 1700, 0.025, 0.1); rustle(0, 0.05, 0.12); },
    magout: () => { scrape(0, 0.12, 0.36, 1500, 800); thud(0.1, 0.34, 150, 0.07); },
    pouch: () => { rustle(0, 0.32, 0.34); clack(0.26, 0.15, 2000, 0.02, 0.05); },
    magin: () => { clack(0, 0.45, 1500, 0.03, 0.1); thud(0.075, 0.6, 130, 0.08); clack(0.077, 0.7, 1200, 0.05, 0.2); },
    slap: () => { thud(0, 0.55, 100, 0.09); },
    slidebk: () => { scrape(0, 0.13, 0.5, 1600, 700, 1.5); clack(0.12, 0.55, 800, 0.06, 0.2); },
    slidefw: () => { clack(0, 1.0, 750, 0.08, 0.35); ring(0.005, 1600, 0.3, 0.3, 0.3); thud(0.006, 0.5, 120, 0.07); }
  },
  rifle: {
    boltup: () => { scrape(0, 0.07, 0.3, 2000, 1400); clack(0.065, 0.6, 1000, 0.05, 0.25); },
    boltbk: () => { scrape(0, 0.2, 0.5, 1800, 800, 1.7); rustle(0, 0.18, 0.08); clack(0.19, 0.6, 700, 0.07, 0.3); },
    boltfw: () => { scrape(0, 0.18, 0.45, 800, 1700, 1.7); clack(0.17, 0.5, 900, 0.05, 0.2); },
    boltdn: () => { clack(0, 0.9, 760, 0.08, 0.35); ring(0.003, 1400, 0.25, 0.3, 0.3); thud(0.004, 0.5, 120, 0.07); },
    clipin: () => { clack(0, 0.55, 1900, 0.03, 0.15); scrape(0.02, 0.05, 0.2, 3000, 2000); },
    rounds: () => { for (let i = 0; i < 5; i++) { const d = 0.04 + i * 0.075; clack(d, 0.3, R(2300, 2900), 0.02, 0.1); thud(d + 0.005, 0.1, 260, 0.03); } },
    clipout: () => { ring(0, 2400, 0.3, 0.35, 0.3, [1, 2.4, 4.1]); ring(0.12, 2200, 0.15, 0.25, 0.2, [1, 2.4, 4.1]); },
    pouch: () => { rustle(0, 0.25, 0.28); }
  },
  shotgun: {
    shellgrab: () => { rustle(0, 0.14, 0.2); },
    shellin: () => { thud(0, 0.32, 260, 0.04); clack(0.005, 0.45, 2000, 0.025, 0.1); clack(0.06, 0.35, 1500, 0.02, 0.08); },
    pumpbk: () => { scrape(0, 0.1, 0.45, 1500, 800, 1.6); clack(0.09, 0.8, 650, 0.07, 0.35); ring(0.092, 1250, 0.25, 0.3, 0.3); },
    pumpfw: () => { clack(0.0, 0.85, 560, 0.08, 0.4); ring(0.004, 1000, 0.25, 0.35, 0.3); thud(0.005, 0.45, 110, 0.07); },
    eject: () => { nz(0, 0.05, { ft: 'bandpass', f: 1600, q: 3, v: 0.2, a: 0.001, rev: 0.3 }); thud(0.1, 0.12, 400, 0.04); thud(0.19, 0.08, 480, 0.04); }
  },
  flame: {
    tankrel: () => { clack(0, 0.55, 1300, 0.04, 0.2); clack(0.05, 0.4, 900, 0.04, 0.2); },
    tankout: () => { scrape(0, 0.14, 0.3, 700, 400); thud(0.12, 0.45, 90, 0.12); ring(0.12, 260, 0.2, 0.4, 0.3, [1, 1.9, 3.1]); },
    pouch: () => { rustle(0, 0.25, 0.3); ring(0.18, 210, 0.15, 0.5, 0.2, [1, 2.0, 3.3]); },
    tankin: () => { scrape(0, 0.1, 0.3, 450, 800); thud(0.1, 0.65, 85, 0.14); ring(0.1, 240, 0.32, 0.5, 0.35, [1, 1.9, 3.1]); },
    clamp: () => { clack(0, 0.6, 1500, 0.03, 0.15); clack(0.07, 0.55, 1100, 0.03, 0.15); },
    valve: () => { for (let i = 0; i < 3; i++) clack(i * 0.07, 0.12, 1800, 0.012, 0.05); nz(0.15, 0.5, { ft: 'highpass', f: 3500, f2: 5500, v: 0.2, a: 0.08 }); },
    ignite: () => { nz(0, 0.015, { ft: 'highpass', f: 3000, v: 0.3 }); ps(0.02, 70, 38, 0.35, { v: 0.5, a: 0.03, rev: 0.3 }); nz(0.02, 0.3, { ft: 'lowpass', f: 1200, f2: 180, v: 0.5, a: 0.02, rev: 0.5 }); }
  }
};

export const WA = {
  ready: () => !!AC,
  shot(id: string) { if (AC && SHOTS[id]) SHOTS[id](); },
  dry(id: string) {
    if (!AC) return;
    const heavy = id === 'rifle' || id === 'shotgun';
    clack(0, heavy ? 0.5 : 0.38, heavy ? 1500 : 2300, 0.02, 0.1); thud(0.004, heavy ? 0.22 : 0.12, 200, 0.03);
  },
  event(id: string, name: string) { if (AC && EV[id] && EV[id][name]) EV[id][name](); },
  /** достать оружие */
  draw(id: string) {
    if (!AC) return;
    rustle(0, 0.12, 0.2);
    if (id === 'pipe') { thud(0.05, 0.15, 160, 0.05); ring(0.05, 800, 0.08, 0.3, 0.1, [1, 2.3]); }
    else if (id === 'machete' || id === 'kukri') { scrape(0.02, 0.1, 0.2, 3000, 6000, 3); ring(0.1, id === 'kukri' ? 3100 : 2400, 0.1, 0.5, 0.2, [1, 2.9, 5.1]); }
    else if (id === 'flame') { thud(0.06, 0.25, 110, 0.08); ring(0.06, 260, 0.1, 0.3, 0.2, [1, 1.9]); }
    else { clack(0.06, 0.3, id === 'pistol' ? 2000 : 1100, 0.03, 0.1); thud(0.08, 0.2, 140, 0.06); }
  },
  swing(id: string) {
    if (!AC) return;
    if (id === 'kukri') {            // лёгкий клинок: высокий короткий свист
      nz(0, 0.16, { ft: 'bandpass', f: 2600, f2: 5200, q: 2.2, v: 0.2, a: 0.05 });
      nz(0.02, 0.1, { ft: 'highpass', f: 5000, v: 0.08, a: 0.04 });
    } else if (id === 'machete') {   // длиннее и ниже, с «звоном» полотна
      nz(0, 0.26, { ft: 'bandpass', f: 900, f2: 3000, q: 1.4, v: 0.3, a: 0.09 });
      nz(0.04, 0.2, { ft: 'highpass', f: 3500, f2: 5500, v: 0.08, a: 0.07 });
      ring(0.1, 1900, 0.04, 0.35, 0.2, [1, 2.2]);
    } else {                         // труба: низкий глухой «вууух»
      nz(0, 0.3, { ft: 'bandpass', f: 280, f2: 800, q: 0.9, v: 0.34, a: 0.12 });
      ps(0, 130, 75, 0.25, { v: 0.1, a: 0.08 });
      rustle(0, 0.1, 0.06);
    }
  },
  /** попадание в тело: kind — pipe | machete | kukri | bullet | big */
  flesh(kind = 'bullet', vol = 1) {
    if (!AC) return;
    nz(0, 0.1, { ft: 'lowpass', f: 1400, f2: 200, v: 0.55 * vol, a: 0.001, rev: 0.15 });
    ps(0, 160, 55, 0.1, { v: 0.4 * vol, a: 0.001 });
    nz(0.012, 0.07, { ft: 'bandpass', f: 600, f2: 300, q: 1.2, v: 0.25 * vol, a: 0.004 });     // «мокрый» хруст
    if (kind === 'pipe') { clack(0, 0.45 * vol, 780, 0.1, 0.25); ring(0.01, 520, 0.2 * vol, 0.5, 0.25, [1, 2.4, 4.3]); thud(0, 0.4 * vol, 90, 0.1); }
    else if (kind === 'machete' || kind === 'kukri') {
      nz(0, 0.12, { ft: 'bandpass', f: 2800, f2: 1200, q: 1.5, v: 0.32 * vol, a: 0.002 });
      ring(0.005, kind === 'kukri' ? 3000 : 2300, 0.08 * vol, 0.3, 0.15, [1, 2.9]);
    } else if (kind === 'big') thud(0, 0.5 * vol, 70, 0.14);
  },
  /** пуля в стену: «тюк» и короткий рикошет */
  wall(vol = 1) {
    if (!AC) return;
    nz(0.03, 0.04, { ft: 'bandpass', f: 2400, f2: 1500, q: 1.6, v: 0.16 * vol, a: 0.001, rev: 0.3 });
    nz(0.05, 0.1, { ft: 'lowpass', f: 1800, f2: 300, v: 0.1 * vol, a: 0.002 });
    if (Math.random() < 0.35) ps(0.04, 3400, 1500, 0.22, { v: 0.05 * vol, a: 0.002, rev: 0.3, pan: R(-0.5, 0.5) });
  }
};
