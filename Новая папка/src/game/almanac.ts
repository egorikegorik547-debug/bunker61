// @ts-nocheck
/* ============================================================
   АЛЬМАНАХ БЫВШИХ — записи о монстрах и 3D-просмотрщик.
   Запись открывается после первого убийства существа.
   ============================================================ */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export const ALMANAC_ORDER = ['walker', 'runner', 'spider', 'rat', 'spitter', 'bloater', 'brute'];

export const ALMANAC = {
  walker: {
    icon: '🧟', cls: 'Заражённый · обычный', danger: 2, since: 'с 1-го дня', zones: 'Все зоны сети',
    lore: 'Бывший сотрудник сети: техник, повар, охранник. Вода из вторичного контура сделала своё дело — речь пропала на третьи сутки, разум — на шестые. Бродяги до сих пор носят рабочие комбинезоны и каски: тело помнит смену, которую не закончило.',
    behavior: 'Медленно бродит по маршрутам, реагирует на свет фонаря и на шум. Заметив игрока, переходит на тяжёлый шаг и не отстаёт, пока не потеряет из виду.',
    tips: ['Два-три выстрела в голову — и он падает. Труба тоже подойдёт, если подобраться тихо.', 'Фонарь выдаёт вас с 13 шагов. Погасите его в тёмном коридоре — заметит только вплотную.', 'С тела можно обыскать мелкую добычу.'],
    weak: 'Голова, тишина'
  },
  runner: {
    icon: '🏃', cls: 'Заражённый · быстрый', danger: 3, since: 'с 3-го дня', zones: 'Коридоры, жилые блоки',
    lore: 'Те, у кого лихорадка прошла в самой острой форме. Мышцы сводит судорогой, и они бегут — даже когда бежать некуда. Датчики сети фиксируют их ночью у жилых секторов: они ходят вдоль дверей, будто ищут свою комнату.',
    behavior: 'Слышит лучше Бродяги и замечает дальше. Заметив добычу, срывается в бег и сокращает дистанцию за считанные секунды.',
    tips: ['Мало здоровья — пистолета хватает, но не мажьте: второго шанса может не быть.', 'Не бегите от него по прямой — вы всё равно проиграете. Встаньте спиной к стене и стреляйте.', 'Дробовик убивает бегуна с одного выстрела вблизи.'],
    weak: 'Низкое здоровье'
  },
  spider: {
    icon: '🕷', cls: 'Мутант · засадный', danger: 3, since: 'с 1-го дня', zones: 'Вентиляция, склады, серверные',
    lore: 'Обычные пауки из вентиляции, напитавшиеся тем же заражением. Хитиновый панцирь потемнел до фиолетового, а на брюшке проступил багровый знак. Размер с крупную собаку, восемь глаз — и все смотрят на вас.',
    behavior: 'Быстро перемещается по полу и прыгает на игрока с 3–7 метров, нанося удар в полёте. После прыжка ненадолго перезаряжается.',
    tips: ['Услышав сухой стрёкот — оглядитесь: паук рядом. Он прыгает, а не подкрадывается.', 'Отступите на шаг после прыжка — следующий придётся через 3 секунды.', 'Хорошо горит. Огнемёт ломает им всю тактику.'],
    weak: 'Огонь, пауза после прыжка'
  },
  rat: {
    icon: '🐀', cls: 'Мутант · стайный', danger: 2, since: 'со 2-го дня', zones: 'Нижние секции, кухни, склады',
    lore: 'Крысы нижних секций стали крупнее, а глаза — красными. Теперь они ходят стаей по три-пять и больше не боятся человека: инстинкт выбил голод. Отчёты сети отмечают рост популяции в 400% за первый месяц.',
    behavior: 'Появляются сразу по трое. Очень быстрые, кусаются часто, но слабо. Любят нападать группой, окружая вас.',
    tips: ['Стреляйте по очереди, начиная с ближней. Пистолет убивает крысу с одного попадания.', 'Дробовик и огнемёт выкашивают всю стаю разом.', 'Бейте трубой в узком проходе: крысы выстраиваются в линию.'],
    weak: 'Хрупкие, плохо переносят огонь'
  },
  spitter: {
    icon: '🧪', cls: 'Заражённый · стрелок', danger: 3, since: 'с 3-го дня', zones: 'Медпункт, склад, генераторная',
    lore: 'В организме образовались светящиеся мешки с кислотной слизью. Свечение видно даже сквозь дым. Спиттеры не бегут к цели — они держат дистанцию и плюются, как будто всё ещё помнят правила безопасности.',
    behavior: 'Остановившись в 7–16 метрах, замахивается и плюёт сгустком кислоты, который летит прямо в игрока. В упор даёт отпор лапами.',
    tips: ['Сгусток летит заметно медленнее пули. Шагните в сторону сразу после замаха.', 'Не пытайтесь бежать к нему по открытому коридору — стреляйте из укрытия.', 'Винтовка достаёт его раньше, чем он успеет плюнуть.'],
    weak: 'Медлительный снаряд, слабая броня'
  },
  bloater: {
    icon: '💥', cls: 'Заражённый · взрывной', danger: 4, since: 'с 4-го дня', zones: 'Столовая, жилые блоки, склад',
    lore: 'Газы в раздутом брюхе горят сквозь кожу тёплым оранжевым светом. Подрывники медленны и не опасны на расстоянии, но стоит им подойти — и брюшная полость лопнет, унеся с собой всё, что стоит рядом. Уничтожайте издали.',
    behavior: 'Медленно идёт к игроку. Достигнув дистанции удара, взрывается сам. Убитый вблизи — тоже взрывается, задевая соседних монстров.',
    tips: ['Стреляйте с 6+ метров: радиус взрыва — около 4 метров.', 'Взрыв поджигает и других Бывших вокруг. Заманите стаю — и стреляйте в подрывника.', 'Не добивайте его трубой. Вообще никогда.'],
    weak: 'Медлительность, детонация'
  },
  brute: {
    icon: '🦍', cls: 'Заражённый · тяжёлый', danger: 5, since: 'с 5-го дня', zones: 'Нижние секции, оружейные',
    lore: 'Бывший охранник нижних шлюзов. Заражение раздуло его мышцы до неестественных размеров, и теперь он ломает стальные двери голыми руками. Датчики видят его силуэт на камерах — огромный, в рваной форме. Выстрелами его не остановить; только осторожностью.',
    behavior: 'Очень медленный на прогулке, но тяжёлый на ходу. Удар — самый мощный из всех Бывших. Реагирует на звук сильнее, чем на свет.',
    tips: ['Почти 170 здоровья — не вступайте в бой без запаса патронов.', 'Он медленнее вас — отступайте и стреляйте. Не дайте ему приблизиться.', 'Дробовик с дистанции не сработает; винтовка или АС «Вал» — лучше.'],
    weak: 'Скорость, большая цель'
  }
};

/* ---------- Просмотрщик 3D ---------- */
export class MonsterViewer {
  constructor(buildFn) {
    this.build = buildFn; this.items = {}; this.canvas = null; this.id = null; this.known = true;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.15;
    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.05, 40);
    const key = new THREE.DirectionalLight(0xffe6c8, 2.4); key.position.set(2.5, 3.5, 3); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6fa8ff, 2.0); rim.position.set(-3, 2, -3); this.scene.add(rim);
    const red = new THREE.PointLight(0xff4a2a, 6, 8, 2); red.position.set(0, 0.4, 2.2); this.scene.add(red);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0x1b2a22, transparent: true, opacity: 0.55 }));
    this.floor.rotation.x = -Math.PI / 2; this.scene.add(this.floor);
    this.sil = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.raf = 0; this.running = false; this.yaw = 0.5; this.hold = 0; this.last = 0; this.t = 0; this.size = [0, 0];
  }
  get(id) {
    if (this.items[id]) return this.items[id];
    const model = this.build(id);
    // фиксируем «лицо» вперёд и считаем габариты
    const pivot = new THREE.Group(); pivot.add(model); pivot.visible = false; this.scene.add(pivot);
    const bb = new THREE.Box3().setFromObject(model);
    const it = { pivot, model, h: Math.max(0.3, bb.max.y), w: Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z), height: bb.max.y };
    this.items[id] = it; return it;
  }
  mount(canvas, id, known) {
    this.canvas = canvas; this.id = id; this.known = known; this.hold = 0;
    this.get(id);
    let drag = false, px = 0;
    canvas.addEventListener('pointerdown', e => { drag = true; px = e.clientX; canvas.setPointerCapture(e.pointerId); canvas.classList.add('grab'); });
    canvas.addEventListener('pointermove', e => { if (!drag) return; this.yaw += (e.clientX - px) * 0.012; px = e.clientX; this.hold = 2.5; });
    const up = () => { drag = false; canvas.classList.remove('grab'); };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    this.start();
  }
  start() {
    if (this.running) return; this.running = true; this.last = performance.now();
    const loop = now => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.draw(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); this.canvas = null; }
  pose(it, id, t) {
    const ud = it.model.userData;
    if (ud.anim) { ud.anim({ phase: t * 2.2, off: 0, leap: 0 }, 0.35, false, t); return; }
    if (!ud.upper) return;
    ud.upper.rotation.x = ud.almHunch ?? 0.3;
    const ax = -0.45 + Math.sin(t * 1.5) * 0.08;
    ud.armL.rotation.x = ax; ud.armR.rotation.x = ax - 0.1; ud.armL.rotation.z = 0.1; ud.armR.rotation.z = -0.1;
    ud.head.rotation.y = Math.sin(t * 0.7) * 0.35; ud.head.rotation.z = Math.sin(t * 2.6) * 0.08;
    ud.legL.rotation.x = 0.1; ud.legR.rotation.x = -0.1;
    if (ud.belly) {
      const pz = 0.5 + 0.5 * Math.sin(t * 3.4);
      ud.belly.emissiveIntensity = 0.4 + pz * 1.3; ud.core.scale.setScalar(0.9 + pz * 0.2);
      ud.bellyMesh.scale.set(1.15 + pz * 0.04, 1 + pz * 0.05, 1.05 + pz * 0.04);
    }
    if (ud.sacMat) {
      ud.sacMat.emissiveIntensity = 0.8 + 0.4 * Math.sin(t * 4);
      for (let i = 0; i < ud.sacs.length; i++) ud.sacs[i].scale.setScalar(1 + Math.sin(t * 5 + i * 2) * 0.07);
    }
  }
  draw(dt) {
    const c = this.canvas; if (!c || !c.isConnected) return;
    const w = c.clientWidth, h = c.clientHeight; if (!w || !h) return;
    const pr = this.renderer.getPixelRatio();
    if (c.width !== Math.round(w * pr) || c.height !== Math.round(h * pr)) { c.width = Math.round(w * pr); c.height = Math.round(h * pr); }
    if (this.size[0] !== c.width || this.size[1] !== c.height) { this.renderer.setSize(c.width / pr, c.height / pr, false); this.size = [c.width, c.height]; this.camera.aspect = c.width / c.height; this.camera.updateProjectionMatrix(); }
    this.t += dt;
    if (this.hold > 0) this.hold -= dt; else this.yaw += dt * 0.55;
    for (const k in this.items) this.items[k].pivot.visible = k === this.id;
    const it = this.items[this.id];
    this.pose(it, this.id, this.t);
    it.pivot.rotation.y = this.yaw;
    const R = Math.max(it.h * 0.62, it.w * 0.55, 0.3);
    const d = R / Math.tan(this.camera.fov * Math.PI / 360) * 1.25;
    this.camera.position.set(0, it.h * 0.55, d); this.camera.lookAt(0, it.h * 0.48, 0);
    this.floor.scale.setScalar(Math.max(it.w * 0.85, 0.5)); this.floor.position.y = 0.002;
    this.scene.overrideMaterial = this.known ? null : this.sil;
    this.floor.visible = this.known;
    this.renderer.render(this.scene, this.camera);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(this.renderer.domElement, 0, 0, c.width, c.height);
  }
}
