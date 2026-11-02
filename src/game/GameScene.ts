import Phaser from 'phaser';
import {
  BIRTH_LINES, CONTACT_LINES, FINAL_BOSS, GAUGE, GIFT_CHANCE, HUSBANDS, KID_ATTACK_CD, MAX_ENEMIES, MAX_WOMEN, MIN_FREE_WOMEN,
  NAMES, PICKUPS, PLAYER, RING_WAVES, RUN_TIME, W, H, WOMAN, WOMAN_FLIRT, WOMAN_PREG, WOMAN_REJECT, WORLD, WOMAN_TEX,
  TUNE, birthDelay, clamp, fillTime, husbandDmg, husbandHp, husbandRate, husbandSpeed, kidStats, pick, rand, womenWanted, xpNeed,
  type HusbandKind,
} from '../config';
import { sfx } from '../sfx';
import type {
  Bullet, EShot, Enemy, Gem, PassiveId, Pickup, PickupKind, Pool, Slipper, WeaponId, WeaponState, Woman,
} from './types';
import { UPGRADES, UP_BY_ID, type UpDef } from './upgrades';
import { updateWeapons } from './weapons';
import { Hud } from './hud';
import { Bot, runBatch } from './bot';
import { TouchControls, isTouchDevice } from './touch';

const CS = 96; // размер ячейки сетки
const GN = Math.ceil(WORLD / CS) + 1;

export interface RunStats {
  kills: number;
  kidsBorn: number;
  kidsKilled: number;
  contacts: number;
  overflows: number;
  gifts: number;
  maxLevel: number;
  bestMom: string;
  bestMomN: number;
  bossKids: number;
}

export interface PlayerState {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  r: number;
  inv: number;
  busy: number;
  flash: number;
  face: number;
  spr: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  aura: Phaser.GameObjects.Image;
}

export class GameScene extends Phaser.Scene {
  // ---- состояние забега
  t = 0;
  acc = 0;
  timeScale = 1;
  paused = false;
  over = false;
  won = false;
  headless = false; // без эффектов (для симуляции баланса)
  bot: Bot | null = null;

  P!: PlayerState;
  S = { moveMul: 1, dmgMul: 1, cdMul: 1, magnetMul: 1, armor: 0, regen: 0, gaugeMul: 1, luck: 1 };
  passives: Partial<Record<PassiveId, number>> = {};
  weapons: Partial<Record<WeaponId, WeaponState>> = {};
  level = 1;
  xp = 0;
  pendingPicks = 0;
  menuOptions: UpDef[] | null = null;
  menuFree = false;

  arousal: number = GAUGE.start;
  chosen: Woman | null = null;
  contactW: Woman | null = null;
  inp = { x: 0, y: 0 };

  enemies: Enemy[] = [];
  women: Woman[] = [];
  bullets: Bullet[] = [];
  eshots: EShot[] = [];
  gems: Gem[] = [];
  pickups: Pickup[] = [];
  pools: Pool[] = [];
  slippers: Slipper[] = [];
  rings: { x: number; y: number; t: number; dur: number; R: number; color: number }[] = [];
  finalBoss: Enemy | null = null;

  stats: RunStats = {
    kills: 0, kidsBorn: 0, kidsKilled: 0, contacts: 0, overflows: 0, gifts: 0, maxLevel: 1, bestMom: '', bestMomN: 0, bossKids: 0,
  };

  private nextId = 1;
  private spawnAcc = 0;
  private womanSpawnCd = 0;
  private ringIdx = 0;
  private bossSpawned = false;
  private hintsShown = new Set<string>();
  private cells: Enemy[][] = Array.from({ length: GN * GN }, () => []);
  private usedCells: number[] = [];
  private bubbles = 0;

  hud!: Hud;
  fx!: Phaser.GameObjects.Graphics;
  private puffs!: Phaser.GameObjects.Particles.ParticleEmitter;
  private hearts!: Phaser.GameObjects.Particles.ParticleEmitter;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  touch: TouchControls | null = null;

  constructor() {
    super('Game');
  }

  // =====================================================================
  create() {
    this.resetState();
    const params = new URLSearchParams(window.location.search);
    this.headless = false;

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD, WORLD);
    cam.setBackgroundColor(0x3d6e2e);

    this.add.tileSprite(0, 0, WORLD, WORLD, 'ground').setOrigin(0).setDepth(-5000);
    const fence = this.add.graphics().setDepth(-4000);
    fence.lineStyle(14, 0x7a4a2a, 1).strokeRect(-4, -4, WORLD + 8, WORLD + 8);
    fence.lineStyle(4, 0xd9a066, 1).strokeRect(-4, -4, WORLD + 8, WORLD + 8);

    // декор
    const decor = ['d_tree', 'd_tree2', 'd_flower', 'd_sun', 'd_rock', 'd_mush', 'd_sign', 'd_cart', 'd_hen', 'd_bush', 'd_flower', 'd_bush'];
    for (let i = 0; i < 170; i++) {
      const x = rand(40, WORLD - 40);
      const y = rand(40, WORLD - 40);
      if (Math.hypot(x - WORLD / 2, y - WORLD / 2) < 140) continue;
      const k = pick(decor);
      const big = k === 'd_tree' || k === 'd_tree2';
      this.add.image(x, y, k).setDisplaySize(big ? 70 : 34, big ? 70 : 34).setDepth(y - 6000).setAlpha(0.95);
    }

    this.fx = this.add.graphics().setDepth(8500);
    this.puffs = this.add.particles(0, 0, 'puff', {
      lifespan: { min: 250, max: 480 }, speed: { min: 50, max: 180 }, scale: { start: 0.6, end: 0 }, alpha: { start: 0.9, end: 0 },
      emitting: false,
    }).setDepth(8000);
    this.hearts = this.add.particles(0, 0, 'e_heart', {
      lifespan: { min: 700, max: 1200 }, speedX: { min: -50, max: 50 }, speedY: { min: -130, max: -50 }, scale: { start: 0.2, end: 0.08 },
      alpha: { start: 1, end: 0 }, emitting: false,
    }).setDepth(8600);

    // игрок
    const shadow = this.add.image(WORLD / 2, WORLD / 2, 'shadow').setDepth(-3000);
    const spr = this.add.image(WORLD / 2, WORLD / 2, 'e_player').setDisplaySize(48, 48);
    const aura = this.add.image(WORLD / 2, WORLD / 2, 'aura').setBlendMode(Phaser.BlendModes.ADD).setTint(0x7fe8ff).setAlpha(0.55).setDisplaySize(96, 96);
    this.P = { x: WORLD / 2, y: WORLD / 2, hp: PLAYER.hp, maxHp: PLAYER.hp, r: PLAYER.r, inv: 0, busy: 0, flash: 0, face: 1, spr, shadow, aura };

    this.addWeapon('kiss');
    this.recomputeStats();

    for (let i = 0; i < womenWanted(0); i++) this.spawnWoman(rand(380, 620));

    this.hud = new Hud(this);

    // ввод
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,P,ESC,M,ONE,TWO,THREE,ENTER') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      sfx.unlock();
      if (p.wasTouch || this.paused || this.over) return;
      if (p.rightButtonDown()) {
        this.chosen = null;
        return;
      }
      const wp = cam.getWorldPoint(p.x, p.y);
      this.chooseAt(wp.x, wp.y);
    });

    if (isTouchDevice() || params.has('touch')) this.touch = new TouchControls(this);

    (window as unknown as { __g: GameScene }).__g = this;
    if (params.has('speed')) this.timeScale = Number(params.get('speed')) || 1;
    (window as unknown as { __Bot: typeof Bot; __batch: unknown }).__Bot = Bot;
    (window as unknown as { __batch: unknown }).__batch = (n: number, t?: Record<string, number>, c?: Record<string, number>) => runBatch(this, n, t, c);
    if (params.has('bot')) this.bot = new Bot();
    cam.centerOn(this.P.x, this.P.y);
    this.syncSprites();
  }

  private resetState() {
    this.t = 0;
    this.acc = 0;
    this.paused = false;
    this.over = false;
    this.won = false;
    this.passives = {};
    this.weapons = {};
    this.level = 1;
    this.xp = 0;
    this.pendingPicks = 0;
    this.menuOptions = null;
    this.arousal = GAUGE.start;
    this.chosen = null;
    this.contactW = null;
    this.enemies = [];
    this.women = [];
    this.bullets = [];
    this.eshots = [];
    this.gems = [];
    this.pickups = [];
    this.pools = [];
    this.slippers = [];
    this.rings = [];
    this.finalBoss = null;
    this.stats = { kills: 0, kidsBorn: 0, kidsKilled: 0, contacts: 0, overflows: 0, gifts: 0, maxLevel: 1, bestMom: '', bestMomN: 0, bossKids: 0 };
    this.nextId = 1;
    this.spawnAcc = 0;
    this.womanSpawnCd = 0;
    this.ringIdx = 0;
    this.bossSpawned = false;
    this.hintsShown = new Set();
    this.bubbles = 0;
    this.inp = { x: 0, y: 0 };
    this.cells = Array.from({ length: GN * GN }, () => []);
    this.usedCells = [];
  }

  // =====================================================================
  update(_time: number, delta: number) {
    if (this.touch && window.innerHeight > window.innerWidth && !this.paused) this.togglePause();
    this.handleKeys();
    if (!this.over) {
      if (!this.paused) {
        this.acc += Math.min(delta / 1000, 0.1) * this.timeScale;
        let guard = 0;
        while (this.acc >= 1 / 60 && guard++ < 600) {
          this.step(1 / 60);
          this.acc -= 1 / 60;
          if (this.paused || this.over) {
            this.acc = 0;
            break;
          }
        }
      }
    }
    this.syncSprites();
    this.hud.update();
  }

  togglePause() {
    if (this.over || this.menuOptions) return;
    this.paused = !this.paused;
    this.hud.setPaused(this.paused);
  }

  private handleKeys() {
    const k = this.keys;
    const JD = Phaser.Input.Keyboard.JustDown;
    if (JD(k.M)) this.hud.toast(sfx.toggleMute() ? 'Звук выключен' : 'Звук включён');
    if (this.menuOptions) {
      if (JD(k.ONE)) this.pickUpgrade(0);
      else if (JD(k.TWO)) this.pickUpgrade(1);
      else if (JD(k.THREE)) this.pickUpgrade(2);
      return;
    }
    if (this.over) {
      if (JD(k.ENTER) || JD(k.SPACE)) this.scene.start('Game');
      return;
    }
    if (JD(k.P) || JD(k.ESC)) this.togglePause();
    if (JD(k.SPACE) && !this.paused) {
      const wp = this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y);
      this.chooseNearest(wp.x, wp.y, 1e9);
    }
  }

  // =====================================================================
  //  ШАГ СИМУЛЯЦИИ
  // =====================================================================
  step(dt: number) {
    if (this.over || this.paused) return;
    this.t += dt;
    this.bot?.update(this, dt);
    this.updatePlayer(dt);
    this.updateGauge(dt);
    this.director(dt);
    this.buildGrid();
    this.updateWomen(dt);
    this.updateEnemies(dt);
    updateWeapons(this, dt);
    this.updateEShots(dt);
    this.updatePickups(dt);
    this.updateRings(dt);
    this.reap();
    this.checkLevel();
    if (this.P.hp <= 0) this.endRun(false);
  }

  // ---------- игрок
  private readInput() {
    if (this.bot) return;
    const k = this.keys;
    if (this.touch && !k.A.isDown && !k.D.isDown && !k.W.isDown && !k.S.isDown && !k.LEFT.isDown && !k.RIGHT.isDown && !k.UP.isDown && !k.DOWN.isDown) return;
    let x = 0;
    let y = 0;
    if (k.A.isDown || k.LEFT.isDown) x -= 1;
    if (k.D.isDown || k.RIGHT.isDown) x += 1;
    if (k.W.isDown || k.UP.isDown) y -= 1;
    if (k.S.isDown || k.DOWN.isDown) y += 1;
    this.inp.x = x;
    this.inp.y = y;
  }

  private updatePlayer(dt: number) {
    const P = this.P;
    this.readInput();
    P.inv = Math.max(0, P.inv - dt);
    P.flash = Math.max(0, P.flash - dt);
    if (P.busy > 0) {
      P.busy -= dt;
      if (P.busy <= 0) this.endContact();
    } else {
      let { x, y } = this.inp;
      const m = Math.hypot(x, y);
      if (m > 0) {
        x /= m;
        y /= m;
        const sp = PLAYER.speed * this.S.moveMul;
        P.x += x * sp * dt;
        P.y += y * sp * dt;
        if (Math.abs(x) > 0.1) P.face = x > 0 ? 1 : -1;
      }
    }
    P.x = clamp(P.x, P.r, WORLD - P.r);
    P.y = clamp(P.y, P.r, WORLD - P.r);
    if (this.S.regen > 0) P.hp = Math.min(P.maxHp, P.hp + this.S.regen * dt);
  }

  hurtPlayer(dmg: number, sx: number, sy: number) {
    const P = this.P;
    if (P.inv > 0 || this.over) return;
    let d = Math.max(1, dmg - this.S.armor);
    if (P.busy > 0) d *= PLAYER.busyDamageMul;
    P.hp -= d;
    P.inv = PLAYER.hurtIframes;
    P.flash = 0.12;
    sfx.hurt();
    if (!this.headless) {
      this.cameras.main.shake(70, 0.0035);
      this.puff(P.x, P.y, 3);
    }
    void sx;
    void sy;
  }

  // ---------- шкала и контакт
  private updateGauge(dt: number) {
    if (this.P.busy > 0) return;
    this.arousal += (100 / fillTime(this.t)) * this.S.gaugeMul * dt;
    if (this.arousal >= 100) this.overflow();
    if (this.arousal > 82) this.hint('hot', 'ПЫЛКОСТЬ НА ПРЕДЕЛЕ! Выбери счастливицу (ЛКМ) — или сольются все разом!', 0xff6a88);
  }

  chooseAt(x: number, y: number) {
    this.chooseNearest(x, y, 80);
  }

  chooseNearest(x: number, y: number, maxD: number) {
    let best: Woman | null = null;
    let bd = maxD;
    for (const w of this.women) {
      if (w.state !== 'run') continue;
      const d = Math.hypot(w.x - x, w.y - y);
      if (d < bd) {
        bd = d;
        best = w;
      }
    }
    if (best) {
      this.chosen = this.chosen === best ? null : best;
      if (this.chosen) {
        sfx.click();
        this.say(best.x, best.y - 30, pick(WOMAN_FLIRT), '#ff9ac0');
      }
    }
  }

  private startContact(w: Woman) {
    const P = this.P;
    w.state = 'busy';
    this.contactW = w;
    P.busy = WOMAN.contactTime;
    if (this.chosen === w) this.chosen = null;
    sfx.boing();
    this.hud.showScene(pick(CONTACT_LINES));
  }

  private endContact() {
    const w = this.contactW;
    this.contactW = null;
    this.hud.hideScene();
    this.arousal = 0;
    this.stats.contacts++;
    if (!w) return;
    this.impregnate(w, rand(0.92, 1.08), 0);
    this.say(w.x, w.y - 34, pick(WOMAN_PREG), '#ffd1e6');
    this.heartBurst(w.x, w.y - 10, 10);
  }

  private impregnate(w: Woman, jitterMul: number, extra: number) {
    w.births++;
    w.state = 'preg';
    w.timerMax = birthDelay(w.births) * jitterMul + extra;
    w.timer = w.timerMax;
    w.stun = 0;
    w.vx = w.vy = 0;
    if (this.chosen === w) this.chosen = null;
    // убегает в случайное место недалеко от игрока
    for (let i = 0; i < 12; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(330, 640);
      const x = this.P.x + Math.cos(a) * d;
      const y = this.P.y + Math.sin(a) * d;
      if (x > 60 && x < WORLD - 60 && y > 60 && y < WORLD - 60) {
        w.destX = x;
        w.destY = y;
        break;
      }
      w.destX = WORLD / 2;
      w.destY = WORLD / 2;
    }
    w.spr.setTexture('e_preg');
    if (w.births > this.stats.bestMomN) {
      this.stats.bestMomN = w.births;
      this.stats.bestMom = w.name;
    }
  }

  private overflow() {
    this.arousal = 0;
    this.stats.overflows++;
    sfx.siren();
    this.hud.flash();
    this.hud.announce('ПЫЛКОСТЬ ЗАШКАЛИЛА!', '#ff5c8a', 'Все дамы… в положении. Поздравляем, папа!');
    if (!this.headless) {
      this.cameras.main.shake(400, 0.008);
      for (let i = 0; i < 14; i++) {
        const fx = this.P.x + rand(-420, 420);
        const fy = this.P.y + rand(-260, 260);
        this.time.delayedCall(i * 55, () => this.heartBurst(fx, fy, 6));
      }
    }
    for (const w of this.women) {
      if (w.state === 'run' || w.state === 'rest') {
        this.impregnate(w, rand(0.9, 1.1), rand(0, 2.2));
        this.heartBurst(w.x, w.y - 10, 6);
      } else if (w.state === 'preg') {
        w.timer *= 0.5;
      }
    }
  }

  // ---------- женщины
  spawnWoman(dist: number) {
    const p = this.spawnPos(dist);
    const used = new Set(this.women.map((w) => w.name));
    const free = NAMES.filter((n) => !used.has(n));
    const name = pick(free.length ? free : NAMES);
    const tex = pick(WOMAN_TEX);
    const spr = this.add.image(p.x, p.y, tex).setDisplaySize(46, 46);
    const status = this.add.image(p.x, p.y, 'e_dizzy').setDisplaySize(22, 22).setVisible(false);
    const label = this.add.text(p.x, p.y, name, { fontFamily: 'Trebuchet MS, Segoe UI, sans-serif', fontSize: '12px', color: '#ffe4f0', stroke: '#3a1030', strokeThickness: 3 }).setOrigin(0.5);
    const w: Woman = {
      id: this.nextId++, name, tex, births: 0, state: 'run', x: p.x, y: p.y, vx: 0, vy: 0, r: WOMAN.r, stun: 0, timer: 0, timerMax: 1,
      destX: p.x, destY: p.y, wobble: rand(0, 6.28), bubbleCd: rand(1, 5), spr, status, label,
    };
    this.women.push(w);
    return w;
  }

  /** «Отшить»: женщину отбрасывает и оглушает. Получает урона 0. */
  repelWoman(w: Woman, dx: number, dy: number, knock: number, stun: number) {
    if (w.state !== 'run' || this.chosen === w) return;
    const m = Math.hypot(dx, dy) || 1;
    w.vx = (dx / m) * knock;
    w.vy = (dy / m) * knock;
    w.stun = Math.max(w.stun, stun);
    sfx.reject();
    if (w.bubbleCd <= 0) {
      this.say(w.x, w.y - 30, pick(WOMAN_REJECT), '#ffb0c8');
      w.bubbleCd = rand(2.5, 5);
    }
  }

  private updateWomen(dt: number) {
    const P = this.P;
    const baseSpeed = (WOMAN.speed + WOMAN.speedGrow * this.t) * TUNE.womenSpd;
    for (const w of this.women) {
      w.bubbleCd -= dt;
      w.wobble += dt * 3;
      w.stun = Math.max(0, w.stun - dt);
      // импульс отбрасывания
      if (w.vx !== 0 || w.vy !== 0) {
        w.x += w.vx * dt;
        w.y += w.vy * dt;
        const k = Math.exp(-6 * dt);
        w.vx *= k;
        w.vy *= k;
        if (Math.abs(w.vx) < 4 && Math.abs(w.vy) < 4) w.vx = w.vy = 0;
      }
      const dx = P.x - w.x;
      const dy = P.y - w.y;
      const d = Math.hypot(dx, dy) || 1;
      if (w.state === 'run') {
        const isChosen = this.chosen === w;
        if (isChosen) {
          w.stun = 0;
          w.vx = w.vy = 0;
        }
        if (w.stun <= 0) {
          const near = d < P.r + w.r + 4;
          if (!near) {
            const sp = isChosen ? WOMAN.chosenSpeed : baseSpeed;
            const wob = isChosen ? 0 : Math.sin(w.wobble) * 28;
            const stepLen = Math.min(sp * dt, d - (P.r + w.r));
            w.x += (dx / d) * Math.max(0, stepLen) + (-dy / d) * wob * dt;
            w.y += (dy / d) * Math.max(0, stepLen) + (dx / d) * wob * dt;
          }
          if (d < P.r + w.r + 5 && P.busy <= 0) this.startContact(w);
        }
        if (w.bubbleCd <= 0 && d < 330 && !this.headless && Math.random() < 0.01) {
          this.say(w.x, w.y - 30, pick(WOMAN_FLIRT), '#ffe0ee');
          w.bubbleCd = rand(5, 10);
        }
      } else if (w.state === 'preg') {
        const ddx = w.destX - w.x;
        const ddy = w.destY - w.y;
        const dd = Math.hypot(ddx, ddy);
        if (dd > 8) {
          w.x += (ddx / dd) * WOMAN.fleeSpeed * dt;
          w.y += (ddy / dd) * WOMAN.fleeSpeed * dt;
        }
        w.timer -= dt;
        if (w.timer <= 0) this.giveBirth(w);
      } else if (w.state === 'rest') {
        w.timer -= dt;
        if (w.timer <= 0) {
          w.state = 'run';
          w.spr.setTexture(w.tex);
        }
      }
      w.x = clamp(w.x, 14, WORLD - 14);
      w.y = clamp(w.y, 14, WORLD - 14);
    }
    // женщины не слипаются
    for (let i = 0; i < this.women.length; i++) {
      const a = this.women[i];
      for (let j = i + 1; j < this.women.length; j++) {
        const b = this.women[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.1 && d < 24) {
          const push = (24 - d) * 0.25;
          a.x += (dx / d) * push;
          a.y += (dy / d) * push;
          b.x -= (dx / d) * push;
          b.y -= (dy / d) * push;
        }
      }
    }
  }

  private giveBirth(w: Woman) {
    const ks = kidStats(w.births, this.t);
    this.spawnKid(w, ks);
    w.state = 'rest';
    w.timer = WOMAN.restTime;
    w.spr.setTexture(w.tex);
    this.stats.kidsBorn++;
    if (ks.tier === 3) this.stats.bossKids++;
    sfx.squeak();
    this.say(w.x, w.y - 30, pick(BIRTH_LINES), '#fff2a8');
    this.heartBurst(w.x, w.y - 10, 6);
    if (ks.tier >= 2) this.hud.toast(ks.tier === 3 ? `⚠ ${w.name} родила БОССА (роды №${w.births})!` : `${w.name} родила элитку (роды №${w.births})`);
  }

  private spawnKid(w: Woman, ks: ReturnType<typeof kidStats>) {
    const tex = ks.sub === 'baby' ? 'e_baby' : ks.sub === 'toddler' ? 'e_toddler' : ks.sub === 'elite' ? 'e_elite' : 'e_brute';
    const e = this.makeEnemy('kid', ks.sub, tex, w.x, w.y, ks.r * 3.1, ks.hp, ks.dmg, ks.spd, ks.r, ks.xp);
    e.tier = ks.tier;
    e.n = w.births;
    e.t1 = rand(1.5, 3);
    if (ks.tier >= 2) {
      const aura = this.add.image(w.x, w.y, 'aura').setBlendMode(Phaser.BlendModes.ADD).setTint(ks.tier === 3 ? 0xff2a2a : 0xffa030).setAlpha(0.8);
      aura.setDisplaySize(ks.r * (ks.tier === 3 ? 4.2 : 4.6), ks.r * (ks.tier === 3 ? 4.2 : 4.6));
      e.aura = aura;
      const gender = Math.random() < 0.5 ? 'Сын' : 'Дочь';
      e.label = this.add.text(w.x, w.y, `${gender} ${w.name} №${w.births}`, { fontFamily: 'Trebuchet MS, Segoe UI, sans-serif', fontSize: '12px', color: ks.tier === 3 ? '#ffb0a0' : '#ffe0a0', stroke: '#200', strokeThickness: 3 }).setOrigin(0.5);
    }
    return e;
  }

  // ---------- враги
  private makeEnemy(kind: Enemy['kind'], sub: string, tex: string, x: number, y: number, size: number, hp: number, dmg: number, spd: number, r: number, xp: number): Enemy {
    const spr = this.add.image(x, y, tex).setDisplaySize(size, size);
    const e: Enemy = {
      id: this.nextId++, kind, sub, tier: 1, x, y, vx: 0, vy: 0, r, hp, maxHp: hp, spd, dmg, xp, atk: rand(0, 0.5), flash: 0, dead: false,
      spr, bs: size / 64, tinted: 0, n: 0, t1: 0, t2: 0, t3: 0, state: 0, dx: 0, dy: 0, hitRose: 0, hitSlip: 0, phase: rand(0, 6.28),
    };
    this.enemies.push(e);
    return e;
  }

  spawnPos(dist: number) {
    const P = this.P;
    for (let i = 0; i < 14; i++) {
      const a = rand(0, Math.PI * 2);
      const x = P.x + Math.cos(a) * dist;
      const y = P.y + Math.sin(a) * dist;
      if (x > 30 && x < WORLD - 30 && y > 30 && y < WORLD - 30) return { x, y };
    }
    return { x: clamp(P.x + dist, 30, WORLD - 30), y: clamp(P.y, 30, WORLD - 30) };
  }

  private pickHusbandKind(): HusbandKind {
    let tot = 0;
    const opts: [HusbandKind, number][] = [];
    for (const k of Object.keys(HUSBANDS) as HusbandKind[]) {
      const h = HUSBANDS[k];
      if (this.t >= h.from) {
        opts.push([k, h.w]);
        tot += h.w;
      }
    }
    let r = Math.random() * tot;
    for (const [k, w] of opts) {
      r -= w;
      if (r <= 0) return k;
    }
    return 'basic';
  }

  private spawnHusband(x?: number, y?: number, kind?: HusbandKind) {
    const k = kind ?? this.pickHusbandKind();
    const h = HUSBANDS[k];
    let px = x;
    let py = y;
    if (px === undefined || py === undefined) {
      const p = this.spawnPos(rand(760, 860));
      px = p.x;
      py = p.y;
    }
    const e = this.makeEnemy('husband', k, h.tex, px, py, h.r * 3.2, husbandHp(this.t) * h.hp, husbandDmg(this.t) * h.dmg, husbandSpeed(this.t) * h.spd, h.r, h.xp * TUNE.hXp);
    return e;
  }

  private director(dt: number) {
    const boss = this.finalBoss && !this.finalBoss.dead;
    this.spawnAcc += husbandRate(this.t) * dt * (boss ? 0.5 : 1);
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.enemies.length < MAX_ENEMIES) this.spawnHusband();
    }
    while (this.ringIdx < RING_WAVES.length && this.t >= RING_WAVES[this.ringIdx][0]) {
      const n = RING_WAVES[this.ringIdx][1];
      this.ringIdx++;
      const P = this.P;
      this.hud.announce('Мужья вышли из-за угла!', '#ffb347', 'Окружают! Прорывайся!');
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const dist = 560;
        this.spawnHusband(clamp(P.x + Math.cos(a) * dist, 20, WORLD - 20), clamp(P.y + Math.sin(a) * dist, 20, WORLD - 20));
      }
    }
    // женщины
    this.womanSpawnCd -= dt;
    if (this.womanSpawnCd <= 0 && this.women.length < MAX_WOMEN) {
      const free = this.women.filter((w) => w.state === 'run' || w.state === 'rest').length;
      if (this.women.length < womenWanted(this.t) || free < MIN_FREE_WOMEN) {
        this.spawnWoman(rand(700, 820));
        this.womanSpawnCd = 1.5;
      }
    }
    if (!this.bossSpawned && this.t >= RUN_TIME) this.spawnFinalBoss();
    // подсказки
    if (this.t > 2) this.hint('intro', 'WASD — бегать. ЛКМ по даме — выбрать избранную (остальных отошьют автоматически). ПКМ — отменить.', 0xffffff);
    if (this.t > 14) this.hint('gauge', 'Шкала «Пылкость» растёт сама. Пока избранная не дошла — она не сбрасывается!', 0xffd1e6);
  }

  private spawnFinalBoss() {
    this.bossSpawned = true;
    const p = this.spawnPos(520);
    const e = this.makeEnemy('final', 'tesha', 'e_tesha', p.x, p.y, FINAL_BOSS.r * 2.5, FINAL_BOSS.hp, FINAL_BOSS.dmg, FINAL_BOSS.spd, FINAL_BOSS.r, 0);
    e.tier = 4;
    e.t1 = 3;
    e.t2 = 7;
    e.t3 = 5;
    const aura = this.add.image(p.x, p.y, 'aura').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff3030).setAlpha(0.85);
    aura.setDisplaySize(FINAL_BOSS.r * 4.5, FINAL_BOSS.r * 4.5);
    e.aura = aura;
    e.label = this.add.text(p.x, p.y, 'ТЁЩА', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '18px', color: '#ffd0d0', stroke: '#300', strokeThickness: 4, fontStyle: 'bold' }).setOrigin(0.5);
    this.finalBoss = e;
    sfx.boss();
    this.hud.announce('ФИНАЛЬНЫЙ БОСС: ТЁЩА!', '#ff4040', '«А я говорила!» — победи её, чтобы выжить!');
    if (!this.headless) this.cameras.main.shake(600, 0.006);
  }

  // ---------- сетка
  private buildGrid() {
    for (const i of this.usedCells) this.cells[i].length = 0;
    this.usedCells.length = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const cx = clamp(Math.floor(e.x / CS), 0, GN - 1);
      const cy = clamp(Math.floor(e.y / CS), 0, GN - 1);
      const idx = cy * GN + cx;
      const c = this.cells[idx];
      if (c.length === 0) this.usedCells.push(idx);
      c.push(e);
    }
  }

  queryEnemies(x: number, y: number, rad: number, cb: (e: Enemy) => void) {
    const x0 = clamp(Math.floor((x - rad) / CS), 0, GN - 1);
    const x1 = clamp(Math.floor((x + rad) / CS), 0, GN - 1);
    const y0 = clamp(Math.floor((y - rad) / CS), 0, GN - 1);
    const y1 = clamp(Math.floor((y + rad) / CS), 0, GN - 1);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const c = this.cells[cy * GN + cx];
        for (let i = 0; i < c.length; i++) if (!c[i].dead) cb(c[i]);
      }
    }
  }

  private updateEnemies(dt: number) {
    const P = this.P;
    const decay = Math.exp(-7 * dt);
    const fx = this.fx;
    fx.clear();
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.atk -= dt;
      e.flash -= dt;
      e.hitRose -= dt;
      e.hitSlip -= dt;
      const dx = P.x - e.x;
      const dy = P.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      let ux = dx / d;
      let uy = dy / d;
      let sp = e.spd;

      if (e.kind === 'kid' && e.sub === 'elite') {
        // рывок
        if (e.state === 0) {
          e.t1 -= dt;
          if (e.t1 <= 0 && d < 420) {
            e.state = 1;
            e.t2 = 0.45;
            e.dx = ux;
            e.dy = uy;
          }
        } else if (e.state === 1) {
          e.t2 -= dt;
          sp = 0;
          e.dx = ux;
          e.dy = uy;
          if (e.t2 <= 0) {
            e.state = 2;
            e.t2 = 0.5;
          }
        } else {
          e.t2 -= dt;
          ux = e.dx;
          uy = e.dy;
          sp = e.spd * 3.4;
          if (e.t2 <= 0) {
            e.state = 0;
            e.t1 = rand(3, 4.5);
          }
        }
      } else if (e.kind === 'kid' && e.sub === 'brute') {
        // топот
        if (e.state === 0) {
          e.t1 -= dt;
          if (e.t1 <= 0 && d < 300) {
            e.state = 1;
            e.t2 = 0.95;
          }
        } else if (e.state === 1) {
          e.t2 -= dt;
          sp = e.spd * 0.2;
          const prog = 1 - e.t2 / 0.95;
          fx.lineStyle(3, 0xff3030, 0.9).strokeCircle(e.x, e.y, 135);
          fx.fillStyle(0xff3030, 0.12 + 0.25 * prog).fillCircle(e.x, e.y, 135 * prog);
          if (e.t2 <= 0) {
            e.state = 0;
            e.t1 = rand(4, 5.5);
            if (d < 135 + P.r) this.hurtPlayer(e.dmg * 1.6, e.x, e.y);
            this.rings.push({ x: e.x, y: e.y, t: 0, dur: 0.35, R: 135, color: 0xff5030 });
            if (!this.headless) this.cameras.main.shake(120, 0.005);
          }
        }
      } else if (e.sub === 'thrower') {
        e.t1 -= dt;
        if (d < 330) sp = d < 230 ? -e.spd * 0.6 : 0; // держит дистанцию
        if (e.t1 <= 0 && d < 480) {
          e.t1 = rand(2.2, 3.2);
          const a = Math.atan2(dy, dx);
          const spr = this.add.image(e.x, e.y, 'e_pan').setDisplaySize(24, 24);
          this.eshots.push({ x: e.x, y: e.y, vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, r: 10, dmg: e.dmg * 0.9, life: 3, spr, dead: false });
        }
      } else if (e.kind === 'final') {
        this.updateFinalBoss(e, dt, d);
        const enraged = e.hp < e.maxHp * 0.5;
        if (enraged) sp *= 1.45;
        // рывок «Я ТЕБЕ СЕЙЧАС!»
        if (e.state === 0) {
          e.t3 -= dt;
          if (e.t3 <= 0 && d < 800) {
            e.state = 1;
            e.t3 = 0.8;
            e.dx = ux;
            e.dy = uy;
          }
        } else if (e.state === 1) {
          e.t3 -= dt;
          sp = 0;
          e.dx = ux;
          e.dy = uy;
          fx.lineStyle(26, 0xff3030, 0.25 + 0.3 * (1 - e.t3 / 0.8)).lineBetween(e.x, e.y, e.x + e.dx * 520, e.y + e.dy * 520);
          if (e.t3 <= 0) {
            e.state = 2;
            e.t3 = 0.7;
          }
        } else {
          e.t3 -= dt;
          ux = e.dx;
          uy = e.dy;
          sp = 440;
          if (e.t3 <= 0) {
            e.state = 0;
            e.t3 = enraged ? 3.8 : 6.5;
          }
        }
      }

      // движение
      e.x += ux * sp * dt + e.vx * dt;
      e.y += uy * sp * dt + e.vy * dt;
      e.vx *= decay;
      e.vy *= decay;

      // расталкивание
      if (e.kind !== 'final') {
        this.queryEnemies(e.x, e.y, e.r + 30, (o) => {
          if (o === e) return;
          const ox = e.x - o.x;
          const oy = e.y - o.y;
          const md = e.r + o.r;
          const dd = ox * ox + oy * oy;
          if (dd < md * md && dd > 0.01) {
            const dist = Math.sqrt(dd);
            const k = ((md - dist) / dist) * 0.5 * (o.r / (e.r + o.r)) * (o.kind === 'final' ? 2 : 1);
            e.x += ox * k;
            e.y += oy * k;
          }
        });
      }
      e.x = clamp(e.x, e.r, WORLD - e.r);
      e.y = clamp(e.y, e.r, WORLD - e.r);

      // далёкие мужья перебрасываются ближе к игроку
      if (e.kind === 'husband' && d > 1400) {
        const p = this.spawnPos(rand(760, 860));
        e.x = p.x;
        e.y = p.y;
      }

      // касание игрока
      if (d < e.r + P.r + 2 && e.atk <= 0) {
        this.hurtPlayer(e.kind === 'final' && e.state === 2 ? e.dmg * 1.5 : e.dmg, e.x, e.y);
        e.atk = e.kind === 'husband' ? 0.7 : KID_ATTACK_CD;
      }
    }
  }

  private updateFinalBoss(e: Enemy, dt: number, d: number) {
    const enraged = e.hp < e.maxHp * 0.5;
    e.t1 -= dt;
    e.t2 -= dt;
    if (e.t1 <= 0) {
      e.t1 = enraged ? FINAL_BOSS.ringEveryEnraged : FINAL_BOSS.ringEvery;
      const n = enraged ? 16 : 11;
      const off = rand(0, 6.28);
      for (let i = 0; i < n; i++) {
        const a = off + (i / n) * Math.PI * 2;
        const spr = this.add.image(e.x, e.y, 'e_slipper').setDisplaySize(26, 26);
        this.eshots.push({ x: e.x, y: e.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, r: 11, dmg: FINAL_BOSS.shotDmg, life: 4.5, spr, dead: false });
      }
      // прицельный залп
      for (let k = -1; k <= 1; k++) {
        const a = Math.atan2(this.P.y - e.y, this.P.x - e.x) + k * 0.16;
        const spr = this.add.image(e.x, e.y, 'e_slipper').setDisplaySize(30, 30);
        this.eshots.push({ x: e.x, y: e.y, vx: Math.cos(a) * 310, vy: Math.sin(a) * 310, r: 12, dmg: FINAL_BOSS.shotDmg, life: 4, spr, dead: false });
      }
      this.rings.push({ x: e.x, y: e.y, t: 0, dur: 0.4, R: 90, color: 0xff3030 });
    }
    if (e.t2 <= 0) {
      e.t2 = FINAL_BOSS.summonEvery * (enraged ? 0.7 : 1);
      const n = enraged ? 9 : 6;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.spawnHusband(clamp(e.x + Math.cos(a) * 90, 20, WORLD - 20), clamp(e.y + Math.sin(a) * 90, 20, WORLD - 20), i % 3 === 0 ? 'tank' : 'basic');
      }
      this.say(e.x, e.y - 90, 'ЗЯТЬКИ, КО МНЕ!', '#ff9a9a');
    }
    void d;
  }

  private updateEShots(dt: number) {
    const P = this.P;
    for (const s of this.eshots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      s.spr.setPosition(s.x, s.y).setRotation(s.spr.rotation + 10 * dt).setDepth(s.y);
      if (s.life <= 0 || s.x < -50 || s.y < -50 || s.x > WORLD + 50 || s.y > WORLD + 50) s.dead = true;
      else if (Math.hypot(s.x - P.x, s.y - P.y) < s.r + P.r) {
        this.hurtPlayer(s.dmg, s.x, s.y);
        s.dead = true;
      }
    }
  }

  private updateRings(dt: number) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      if (r.t >= r.dur) this.rings.splice(i, 1);
      else {
        const p = r.t / r.dur;
        this.fx.lineStyle(6 * (1 - p) + 1, r.color, 1 - p).strokeCircle(r.x, r.y, r.R * (0.25 + 0.75 * p));
      }
    }
  }

  // =====================================================================
  //  УРОН И СМЕРТЬ
  // =====================================================================
  damageEnemy(e: Enemy, dmg: number, dx: number, dy: number, knock: number) {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = 0.07;
    if (knock > 0) {
      const m = Math.hypot(dx, dy) || 1;
      const k = knock / (1 + e.r / 16) / (e.kind === 'final' ? 6 : 1);
      e.vx += (dx / m) * k;
      e.vy += (dy / m) * k;
    }
    sfx.hit();
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy) {
    e.dead = true;
    this.stats.kills++;
    sfx.pop();
    this.puff(e.x, e.y, e.kind === 'kid' && e.tier >= 2 ? 10 : 4);
    if (e.kind === 'final') {
      this.dropGem(e.x, e.y, 200);
      this.endRun(true);
      return;
    }
    this.dropGem(e.x, e.y, e.xp);
    if (e.kind === 'kid') {
      this.stats.kidsKilled++;
      if (Math.random() < GIFT_CHANCE[e.tier as 1 | 2 | 3] * this.S.luck) this.dropPickup(e.x, e.y, 'gift');
      else if (Math.random() < PICKUPS.healChanceKid * this.S.luck) this.dropPickup(e.x, e.y, 'heal');
    } else if (Math.random() < PICKUPS.healChanceHusband * this.S.luck) {
      this.dropPickup(e.x, e.y, 'heal');
    } else if (Math.random() < 0.0012) {
      this.dropPickup(e.x, e.y, 'magnet');
    }
  }

  private reap() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.dead) continue;
      e.spr.destroy();
      e.aura?.destroy();
      e.label?.destroy();
      this.enemies[i] = this.enemies[this.enemies.length - 1];
      this.enemies.pop();
    }
    for (let i = this.eshots.length - 1; i >= 0; i--) {
      if (this.eshots[i].dead) {
        this.eshots[i].spr.destroy();
        this.eshots.splice(i, 1);
      }
    }
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      if (this.bullets[i].dead) {
        this.bullets[i].spr.destroy();
        this.bullets.splice(i, 1);
      }
    }
    for (let i = this.slippers.length - 1; i >= 0; i--) {
      if (this.slippers[i].dead) {
        this.slippers[i].spr.destroy();
        this.slippers.splice(i, 1);
      }
    }
    for (let i = this.gems.length - 1; i >= 0; i--) {
      if (this.gems[i].dead) {
        this.gems[i].spr.destroy();
        this.gems.splice(i, 1);
      }
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      if (this.pickups[i].dead) {
        this.pickups[i].spr.destroy();
        this.pickups.splice(i, 1);
      }
    }
    if (this.chosen && this.chosen.state !== 'run') this.chosen = null;
  }

  // =====================================================================
  //  ПОДБИРАЕМОЕ И ОПЫТ
  // =====================================================================
  dropGem(x: number, y: number, v: number) {
    const tex = v >= 12 ? 'gem3' : v >= 3 ? 'gem2' : 'gem1';
    const spr = this.add.image(x + rand(-6, 6), y + rand(-6, 6), tex).setDepth(-2000);
    if (v >= 40) spr.setScale(2.2);
    this.gems.push({ x: spr.x, y: spr.y, v, spr, pulled: false, dead: false });
    if (this.gems.length > 260) {
      // сливаем самый старый в новый, чтобы не раздувать массив
      const old = this.gems.find((g) => !g.dead && g.spr !== spr);
      if (old) {
        old.dead = true;
        this.gems[this.gems.length - 1].v += old.v;
      }
    }
  }

  dropPickup(x: number, y: number, kind: PickupKind) {
    const tex = kind === 'heal' ? 'e_chicken' : kind === 'magnet' ? 'e_magnet' : 'e_gift';
    const size = kind === 'gift' ? 34 : 28;
    const spr = this.add.image(x, y, tex).setDisplaySize(size, size);
    if (kind === 'gift') {
      this.tweens.add({ targets: spr, scale: spr.scale * 1.18, yoyo: true, repeat: -1, duration: 350 });
    }
    this.pickups.push({ x, y, kind, spr, life: kind === 'gift' ? 60 : 30, dead: false });
  }

  private updatePickups(dt: number) {
    const P = this.P;
    const magR = PLAYER.pickupRadius * this.S.magnetMul;
    for (const g of this.gems) {
      if (g.dead) continue;
      const dx = P.x - g.x;
      const dy = P.y - g.y;
      const d = Math.hypot(dx, dy);
      if (!g.pulled && d < magR) g.pulled = true;
      if (g.pulled) {
        const sp = 420 + 500 * (1 - Math.min(1, d / 400));
        g.x += (dx / (d || 1)) * sp * dt;
        g.y += (dy / (d || 1)) * sp * dt;
        g.spr.setPosition(g.x, g.y);
      }
      if (d < P.r + 8) {
        g.dead = true;
        this.xp += g.v;
        sfx.gem();
      }
    }
    for (const p of this.pickups) {
      if (p.dead) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.dead = true;
        continue;
      }
      p.spr.setDepth(p.y);
      if (p.life < 5) p.spr.setAlpha(Math.sin(this.t * 20) > 0 ? 1 : 0.3);
      const d = Math.hypot(P.x - p.x, P.y - p.y);
      if (d < 38 + (p.kind === 'gift' ? 14 : 0)) {
        p.dead = true;
        if (p.kind === 'heal') {
          P.hp = Math.min(P.maxHp, P.hp + PICKUPS.healAmount);
          this.say(P.x, P.y - 30, `+${PICKUPS.healAmount} ❤`, '#9dffb0');
          sfx.gift();
        } else if (p.kind === 'magnet') {
          for (const g of this.gems) g.pulled = true;
          sfx.gift();
        } else {
          this.stats.gifts++;
          this.pendingPicks++;
          this.menuFree = true;
          sfx.gift();
        }
      }
    }
  }

  private checkLevel() {
    let need = xpNeed(this.level);
    while (this.xp >= need) {
      this.xp -= need;
      this.level++;
      this.stats.maxLevel = this.level;
      this.pendingPicks++;
      sfx.levelup();
      need = xpNeed(this.level);
    }
    if (this.pendingPicks > 0 && !this.menuOptions && !this.over) this.openMenu();
  }

  // ---------- меню улучшений
  private rollOptions(): UpDef[] {
    const pool = UPGRADES.filter((u) => {
      const lv = u.kind === 'weapon' ? this.weapons[u.id as WeaponId]?.lv ?? 0 : this.passives[u.id as PassiveId] ?? 0;
      return lv < u.max;
    });
    const out: UpDef[] = [];
    const bag = [...pool];
    // слегка предпочитаем уже взятое оружие, чтобы билд собирался
    while (out.length < 3 && bag.length) {
      const weights = bag.map((u) => (u.kind === 'weapon' && this.weapons[u.id as WeaponId] ? 1.6 : 1));
      const tot = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * tot;
      let idx = 0;
      for (; idx < bag.length; idx++) {
        r -= weights[idx];
        if (r <= 0) break;
      }
      out.push(bag.splice(Math.min(idx, bag.length - 1), 1)[0]);
    }
    return out;
  }

  levelOf(u: UpDef) {
    return u.kind === 'weapon' ? this.weapons[u.id as WeaponId]?.lv ?? 0 : this.passives[u.id as PassiveId] ?? 0;
  }

  private openMenu() {
    const opts = this.rollOptions();
    if (opts.length === 0) {
      // всё прокачано — лечим
      this.pendingPicks--;
      this.P.hp = Math.min(this.P.maxHp, this.P.hp + 40);
      return;
    }
    this.menuOptions = opts;
    this.paused = true;
    if (this.bot) this.pickUpgrade(this.bot.chooseUpgrade(this));
    else this.hud.showMenu(opts);
  }

  pickUpgrade(i: number) {
    if (!this.menuOptions || !this.menuOptions[i]) return;
    const u = this.menuOptions[i];
    this.menuOptions = null;
    this.pendingPicks = Math.max(0, this.pendingPicks - 1);
    if (u.kind === 'weapon') this.addWeapon(u.id as WeaponId);
    else {
      const id = u.id as PassiveId;
      this.passives[id] = (this.passives[id] ?? 0) + 1;
      if (id === 'vitamins') {
        this.P.maxHp += 20;
        this.P.hp = Math.min(this.P.maxHp, this.P.hp + 20);
      }
      this.recomputeStats();
    }
    sfx.click();
    this.menuFree = false;
    this.hud.hideMenu();
    this.hud.refreshInventory();
    this.paused = false;
    if (this.pendingPicks > 0) this.openMenu();
  }

  addWeapon(id: WeaponId) {
    const w = this.weapons[id];
    if (w) {
      w.lv++;
      if (id === 'rose') this.rebuildRoses();
    } else {
      this.weapons[id] = { lv: 1, t: 0, angle: 0 };
      if (id === 'rose') this.rebuildRoses();
    }
  }

  rebuildRoses() {
    const w = this.weapons.rose!;
    w.roses?.forEach((r) => r.destroy());
    const n = w.lv + 1;
    w.roses = [];
    for (let i = 0; i < n; i++) w.roses.push(this.add.image(this.P.x, this.P.y, 'e_rose').setDisplaySize(28, 28));
  }

  private recomputeStats() {
    const p = this.passives;
    this.S.moveMul = 1 + 0.07 * (p.sneakers ?? 0);
    this.S.dmgMul = (1 + 0.12 * (p.protein ?? 0)) * TUNE.playerDmg;
    this.S.cdMul = Math.pow(0.93, p.coffee ?? 0);
    this.S.magnetMul = 1 + 0.35 * (p.magnet ?? 0);
    this.S.armor = p.vest ?? 0;
    this.S.regen = 0.5 * (p.broccoli ?? 0);
    this.S.gaugeMul = 1 - 0.09 * (p.cold ?? 0);
    this.S.luck = 1 + 0.25 * (p.luck ?? 0);
  }

  // =====================================================================
  //  СИМУЛЯЦИЯ (для настройки баланса: window.__g.simulate())
  // =====================================================================
  simulate(maxT = 330, dt = 1 / 30) {
    this.headless = true;
    const samples: Record<string, number>[] = [];
    let next = 30;
    let minHp = this.P.hp;
    while (!this.over && this.t < maxT) {
      this.step(dt);
      minHp = Math.min(minHp, this.P.hp);
      if (this.t >= next) {
        next += 30;
        samples.push({
          t: Math.round(this.t), hp: Math.round(this.P.hp), lv: this.level, en: this.enemies.length,
          kids: this.enemies.filter((e) => e.kind === 'kid').length, ar: Math.round(this.arousal),
        });
      }
    }
    return {
      won: this.won, died: !this.won && this.P.hp <= 0, t: Math.round(this.t), lv: this.level, hp: Math.round(this.P.hp),
      stats: this.stats, boss: this.finalBoss ? Math.round(this.finalBoss.hp) : null,
      weapons: Object.fromEntries(Object.entries(this.weapons).map(([k, v]) => [k, v!.lv])), passives: this.passives, samples,
    };
  }

  // =====================================================================
  //  КОНЕЦ
  // =====================================================================
  private endRun(win: boolean) {
    if (this.over) return;
    this.over = true;
    this.won = win;
    this.paused = false;
    if (this.headless) return;
    if (win) {
      sfx.win();
      this.hud.announce('ПОБЕДА! ТЁЩА ПОВЕРЖЕНА!', '#ffe14d', 'Семья спасена (почти)');
      for (let i = 0; i < 20; i++) this.time.delayedCall(i * 90, () => this.heartBurst(this.P.x + rand(-300, 300), this.P.y + rand(-200, 200), 8));
    } else {
      sfx.lose();
      this.hud.announce('ТЕБЯ ЗАТОПТАЛИ…', '#ff6060', 'Алименты оказались неподъёмными');
    }
    this.time.delayedCall(win ? 2300 : 1800, () => {
      this.scene.start('End', { win, stats: this.stats, time: this.t, level: this.level });
    });
  }

  // =====================================================================
  //  ЭФФЕКТЫ
  // =====================================================================
  puff(x: number, y: number, n: number) {
    if (this.headless) return;
    this.puffs.explode(n, x, y);
  }

  heartBurst(x: number, y: number, n: number) {
    if (this.headless) return;
    this.hearts.explode(n, x, y);
  }

  say(x: number, y: number, text: string, color = '#fff') {
    if (this.headless || this.bubbles >= 5) return;
    this.bubbles++;
    const t = this.add.text(x, y, text, {
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif', fontSize: '15px', color, stroke: '#1a0a1e', strokeThickness: 4, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(9000);
    this.tweens.add({
      targets: t, y: y - 34, alpha: { from: 1, to: 0 }, delay: 0, duration: 1500, ease: 'Sine.easeOut',
      onComplete: () => {
        t.destroy();
        this.bubbles--;
      },
    });
  }

  hint(key: string, text: string, color: number) {
    if (this.hintsShown.has(key) || this.headless) return;
    this.hintsShown.add(key);
    this.hud.hint(text, color);
  }

  // =====================================================================
  //  СИНХРОНИЗАЦИЯ СПРАЙТОВ
  // =====================================================================
  syncSprites() {
    const P = this.P;
    const t = this.t;
    P.spr.setPosition(P.x, P.y - 4 + Math.sin(t * (P.busy > 0 ? 40 : 12)) * (P.busy > 0 ? 1.5 : 1.2));
    P.spr.setDepth(P.y);
    P.spr.setFlipX(P.face < 0);
    if (P.flash > 0) P.spr.setTintFill(0xff5050);
    else if (P.inv > 0) P.spr.setTint(0xffaaaa);
    else P.spr.clearTint();
    P.shadow.setPosition(P.x, P.y + 14).setDepth(P.y - 1);
    P.aura.setPosition(P.x, P.y).setDepth(P.y - 2);

    for (const e of this.enemies) {
      if (e.dead) continue;
      const bob = Math.sin(t * 10 + e.phase);
      e.spr.setPosition(e.x, e.y);
      e.spr.setDepth(e.y);
      e.spr.setScale(e.bs * (1 + 0.04 * bob), e.bs * (1 - 0.06 * bob));
      if (e.sub === 'runner') e.spr.setFlipX(P.x < e.x);
      const mode = e.flash > 0 ? 1 : e.state === 1 ? 2 : 0;
      if (mode !== e.tinted) {
        e.tinted = mode;
        if (mode === 1) e.spr.setTintFill(0xffffff);
        else if (mode === 2) e.spr.setTint(0xff7070);
        else e.spr.clearTint();
      }
      if (e.aura) {
        e.aura.setPosition(e.x, e.y).setDepth(e.y - 1);
        e.aura.setAlpha(0.55 + 0.25 * Math.sin(t * 6 + e.phase));
      }
      if (e.label) e.label.setPosition(e.x, e.y - e.r - 16).setDepth(9000);
    }

    for (const w of this.women) {
      const vis = w.state !== 'busy';
      w.spr.setVisible(vis);
      w.label.setVisible(vis);
      let st: string | null = null;
      if (this.chosen === w) st = 'e_lasso';
      else if (w.stun > 0) st = 'e_dizzy';
      else if (w.state === 'rest') st = 'e_zzz';
      if (st && vis) {
        w.status.setVisible(true).setTexture(st).setPosition(w.x, w.y - 30 + Math.sin(t * 8) * 2).setDepth(9000);
      } else w.status.setVisible(false);
      const bob = Math.sin(t * 11 + w.id);
      w.spr.setPosition(w.x, w.y).setDepth(w.y).setScale((46 / 64) * (1 + 0.03 * bob), (46 / 64) * (1 - 0.05 * bob));
      if (w.state === 'preg') w.spr.setRotation(Math.sin(t * 9 + w.id) * 0.12);
      else w.spr.setRotation(0);
      w.spr.setFlipX(P.x < w.x && w.state === 'run');
      w.label.setText(w.births > 0 ? `${w.name} ×${w.births}` : w.name).setPosition(w.x, w.y + 24).setDepth(9000);
    }

    // оверлеи: избранная, таймеры родов
    this.drawOverlays();

    const cam = this.cameras.main;
    cam.centerOn(P.x, P.y);
  }

  private drawOverlays() {
    const fx = this.fx;
    const P = this.P;
    // fx очищается в updateEnemies; если шаг не шёл (пауза) — перерисуем оверлей поверх
    if (this.paused || this.over) fx.clear();
    const c = this.chosen;
    if (c && c.state === 'run') {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 10);
      fx.lineStyle(3, 0xff4d94, 0.9).strokeCircle(c.x, c.y, 24 + pulse * 4);
      // лассо
      const n = 12;
      for (let i = 0; i < n; i++) {
        const k = ((i + this.t * 6) % n) / n;
        const x = c.x + (P.x - c.x) * k;
        const y = c.y + (P.y - c.y) * k;
        fx.fillStyle(0xff7ab0, 0.8).fillCircle(x, y, 3.5);
      }
    }
    for (const w of this.women) {
      if (w.state !== 'preg') continue;
      const p = clamp(w.timer / w.timerMax, 0, 1);
      const urgent = w.timer < 3;
      fx.lineStyle(4, 0x1a0a1e, 0.8).beginPath().arc(w.x, w.y - 30, 11, 0, Math.PI * 2).strokePath();
      fx.lineStyle(4, urgent ? 0xff3344 : 0xffb0d0, 1).beginPath().arc(w.x, w.y - 30, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p)).strokePath();
    }
    // направление на дальних беременных не рисуем — они вырастут как грибы
  }
}
