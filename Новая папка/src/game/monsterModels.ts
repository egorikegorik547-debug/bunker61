// @ts-nocheck
// Модели нестандартных монстров: паук-мутант и крыса-мутант.
// «Лицо» у всех смотрит в +Z (как у людей-монстров), eyeMat нужен для затухания глаз после смерти.
import * as THREE from 'three';

const std = (c, o = {}) => new THREE.MeshStandardMaterial({
  color: c, roughness: o.rough ?? 0.7, metalness: o.metal ?? 0.1, emissive: o.emissive ?? 0, emissiveIntensity: o.ei ?? 1
});
const UP = new THREE.Vector3(0, 1, 0);
function limb(par, a, b, r1, r2, mat, seg = 7) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, seg), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  par.add(m); return m;
}
function ball(par, mat, r, x, y, z, sx = 1, sy = 1, sz = 1, w = 12, h = 9) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, w, h), mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); par.add(m); return m;
}

/* ---------------- ПАУК-МУТАНТ ---------------- */
export function buildSpider(cfg) {
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const H = 0.55;
  const rig = new THREE.Group(); rig.position.y = H; g.add(rig);
  const chitin = std(0x1d1822, { rough: 0.38, metal: 0.25 }), plate = std(0x3b2d48, { rough: 0.45, metal: 0.2 });
  const leg = std(0x2a2330, { rough: 0.5, metal: 0.15 }), bone = std(0xd9d1b6, { rough: 0.5 });
  const blood = std(0xc41414, { emissive: 0x9a0c0c, ei: 0.9 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3030 });

  ball(rig, chitin, 0.3, 0, 0, 0.1, 1, 0.8, 1.1);                 // грудь
  ball(rig, plate, 0.2, 0, -0.02, 0.42, 1, 0.85, 1);              // голова
  const abd = ball(rig, chitin, 0.46, 0, 0.1, -0.56, 0.95, 0.85, 1.25, 16, 12); // брюшко
  ball(rig, blood, 0.1, 0, 0.47, -0.5, 0.9, 0.22, 1.5);           // знак на брюшке
  for (let k = 0; k < 6; k++) {                                   // бугры
    const a = k / 6 * Math.PI * 2;
    ball(rig, plate, 0.07, Math.cos(a) * 0.38, 0.12 + Math.sin(a) * 0.3, -0.56 + (k % 2) * 0.12, 1, 1, 1, 8, 6);
  }
  // глаза
  ball(rig, eyeMat, 0.05, -0.07, 0.07, 0.6); ball(rig, eyeMat, 0.05, 0.07, 0.07, 0.6);
  for (const s of [-1, 1]) {
    ball(rig, eyeMat, 0.028, s * 0.12, 0.13, 0.55, 1, 1, 1, 8, 6);
    ball(rig, eyeMat, 0.022, s * 0.15, 0.06, 0.52, 1, 1, 1, 8, 6);
    // клыки
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.2, 7), bone);
    f.position.set(s * 0.07, -0.13, 0.62); f.rotation.x = Math.PI + 0.35; rig.add(f);
    ball(rig, plate, 0.05, s * 0.07, -0.05, 0.57);
    // щупики
    limb(rig, [s * 0.1, -0.05, 0.5], [s * 0.14, -0.1, 0.78], 0.025, 0.015, leg);
  }
  // 8 ног
  const legs = [];
  const ang = [-0.78, -0.28, 0.24, 0.72];
  for (const s of [1, -1]) for (let i = 0; i < 4; i++) {
    const lg = new THREE.Group(); lg.position.set(0, 0, 0.3 - i * 0.2); lg.scale.x = s;
    const reach = i === 1 || i === 2 ? 1 : 0.9;
    limb(lg, [0.1, 0, 0], [0.5 * reach, 0.4, 0], 0.055, 0.042, leg);
    ball(lg, plate, 0.05, 0.5 * reach, 0.4, 0, 1, 1, 1, 8, 6);
    limb(lg, [0.5 * reach, 0.4, 0], [1.02 * reach, -H + 0.02, 0], 0.04, 0.012, leg);
    rig.add(lg);
    legs.push({ g: lg, ang: ang[i] * (i < 2 ? 1 : 1), ph: ((i % 2) * Math.PI) + (s > 0 ? 0 : Math.PI), i });
    lg.rotation.y = ang[i];
  }
  g.scale.setScalar(cfg.scale);
  const ud = {
    eyeMat, rig, legs, abd, kind: 'spider',
    anim(m, amp, chase, time) {
      const sp = chase ? 1.7 : 1;
      for (const l of legs) {
        const ph = m.phase * 1.7 * sp + l.ph;
        l.g.rotation.y = l.ang + Math.sin(ph) * 0.34 * amp;
        l.g.rotation.z = Math.max(0, Math.cos(ph)) * 0.5 * amp + Math.sin(time * 2.2 + l.i + l.ph) * 0.025
          + (chase ? 0.06 : 0);
      }
      rig.position.y = H + Math.sin(time * (chase ? 12 : 2.5) + m.off) * 0.012 * (1 + amp);
      rig.rotation.x = m.leap > 0 ? -0.55 : (chase ? 0.05 : 0);
      abd.scale.y = 0.85 + Math.sin(time * 3 + m.off) * 0.03;
    },
    die(f) {
      rig.rotation.z = f * Math.PI; rig.position.y = H - f * 0.14;
      for (const l of legs) { l.g.rotation.z = -f * 0.7; l.g.rotation.y = l.ang * (1 - f * 0.5); }
    }
  };
  g.userData = ud;
  return g;
}

/* ---------------- КРЫСА-МУТАНТ ---------------- */
export function buildRat(cfg) {
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const H = 0.17;
  const rig = new THREE.Group(); rig.position.y = H; g.add(rig);
  const fur = std(0x5a4a3d, { rough: 0.95 }), fur2 = std(0x3f342b, { rough: 0.95 });
  const pink = std(0xc98a8a, { rough: 0.8 }), bone = std(0xe8e2cc, { rough: 0.6 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3a2a });
  ball(rig, fur, 0.14, 0, 0, 0.02, 0.9, 0.82, 1.7);              // тело
  ball(rig, fur2, 0.13, 0, 0.015, -0.17, 0.95, 0.9, 1.1);        // зад
  ball(rig, fur, 0.095, 0, -0.01, 0.3, 0.9, 0.85, 1.3);          // голова
  const sn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 8), fur);
  sn.position.set(0, -0.025, 0.42); sn.rotation.x = Math.PI / 2; rig.add(sn);
  ball(rig, pink, 0.02, 0, -0.022, 0.49);
  for (const s of [-1, 1]) {
    ball(rig, pink, 0.05, s * 0.065, 0.075, 0.24, 1, 1, 0.25);   // уши
    ball(rig, eyeMat, 0.02, s * 0.048, 0.03, 0.36, 1, 1, 1, 8, 6);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.04, 0.008), bone);
    t.position.set(s * 0.016, -0.065, 0.45); rig.add(t);
  }
  // хвост
  limb(rig, [0, -0.02, -0.28], [0, -0.01, -0.5], 0.022, 0.014, pink, 6);
  const tail = limb(rig, [0, -0.01, -0.5], [0.09, 0.02, -0.72], 0.014, 0.006, pink, 6);
  // лапы
  const legs = [];
  for (const [x, z, fr] of [[-1, 1, 1], [1, 1, 1], [-1, -1, 0], [1, -1, 0]]) {
    const lg = new THREE.Group(); lg.position.set(x * 0.09, -0.05, z * 0.15 + 0.05);
    limb(lg, [0, 0, 0], [0, -0.12, 0.0], 0.028, 0.02, fur2, 6);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.07), pink); foot.position.set(0, -0.125, 0.025); lg.add(foot);
    rig.add(lg); legs.push({ g: lg, ph: (x * z > 0 ? 0 : Math.PI) });
  }
  g.scale.setScalar(cfg.scale);
  g.userData = {
    eyeMat, rig, legs, kind: 'rat',
    anim(m, amp, chase, time) {
      for (const l of legs) l.g.rotation.x = Math.sin(m.phase * 2.4 + l.ph) * 1.0 * amp;
      rig.position.y = H + Math.abs(Math.sin(m.phase * 2.4)) * 0.035 * amp;
      rig.rotation.x = Math.sin(m.phase * 2.4 * 2) * 0.06 * amp;
      rig.rotation.z = chase ? Math.sin(time * 14 + m.off) * 0.03 : 0;
      tail.rotation.y = Math.sin(time * 6 + m.off) * 0.2;
    },
    die(f) { rig.rotation.z = f * Math.PI; rig.position.y = H - f * 0.04; for (const l of legs) l.g.rotation.x = f * 0.5; }
  };
  return g;
}

/* ---------------- ДЕТАЛИ ДЛЯ ЛЮДЕЙ-МОНСТРОВ ---------------- */
// Взрывник: раздутое светящееся брюхо
export function decorateBloater(upper, head, ud) {
  const belly = std(0xa8703a, { rough: 0.55, emissive: 0xff4a10, ei: 0.6 });
  const b = ball(upper, belly, 0.44, 0, 0.3, 0.13, 1.15, 1, 1.05, 18, 12);
  const core = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.55 });
  const c = ball(upper, core, 0.26, 0, 0.3, 0.2, 1.1, 1, 1, 12, 8);
  for (let k = 0; k < 7; k++) {
    const a = k * 2.4, y = 0.3 + Math.sin(k * 1.7) * 0.22;
    ball(upper, std(0xd9b36a, { emissive: 0xff7a20, ei: 0.8 }), 0.06, Math.sin(a) * 0.43, y, 0.2 + Math.cos(a) * 0.4, 1, 1, 1, 8, 6);
  }
  ud.belly = belly; ud.core = c; ud.bellyMesh = b;
  head.scale.setScalar(0.85);
}
// Кислотник: светящиеся зелёные мешки и открытая пасть
export function decorateSpitter(upper, head, ud) {
  const sac = std(0x7dff3a, { rough: 0.3, emissive: 0x4dd318, ei: 1.1 });
  const s1 = ball(upper, sac, 0.17, -0.16, 0.55, -0.24, 1, 1.2, 1);
  const s2 = ball(upper, sac, 0.14, 0.17, 0.48, -0.24, 1, 1.2, 1);
  const throat = ball(head, sac, 0.12, 0, -0.06, 0.06, 1, 1, 1, 10, 8);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.04), new THREE.MeshBasicMaterial({ color: 0xaaff55 }));
  mouth.position.set(0, -0.05, 0.145); head.add(mouth);
  ud.sacs = [s1, s2, throat]; ud.sacMat = sac; ud.mouth = mouth;
}
