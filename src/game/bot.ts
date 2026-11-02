import { WORLD } from '../config';
import type { GameScene } from './GameScene';
import type { UpDef } from './upgrades';

// Бот для настройки баланса: бегает, уворачивается, выбирает «счастливицу».
// Играет заметно слабее живого игрока (нет умного кайтинга и осознанного выбора целей).
export class Bot {
  contactAt = 72; // при какой пылкости зовём избранную
  maxNear = 5; // при скольких врагах рядом не рискуем
  private strafe = 1;
  private strafeT = 0;

  private weight: Record<string, number> = {
    kiss: 3, rose: 2.6, slipper: 2.6, borscht: 2.2, megaphone: 2.2,
    protein: 2, coffee: 1.6, vitamins: 1.7, vest: 1.4, sneakers: 1.2, magnet: 1.0, cold: 1.5, broccoli: 1.3, luck: 0.9,
  };

  chooseUpgrade(g: GameScene): number {
    const opts = g.menuOptions as UpDef[];
    let best = 0;
    let bs = -1;
    const owned = Object.keys(g.weapons).length;
    opts.forEach((u, i) => {
      let s = (this.weight[u.id] ?? 1) * (0.75 + Math.random() * 0.5);
      if (u.kind === 'weapon' && g.levelOf(u) === 0 && owned >= 4) s *= 0.5;
      if (u.kind === 'weapon' && g.levelOf(u) > 0) s *= 1.3;
      if (s > bs) {
        bs = s;
        best = i;
      }
    });
    return best;
  }

  update(g: GameScene, dt: number) {
    const P = g.P;
    let ax = 0;
    let ay = 0;
    let near = 0;
    let nearest = 1e9;
    let nx = 0;
    let ny = 0;
    for (const e of g.enemies) {
      if (e.dead) continue;
      const dx = P.x - e.x;
      const dy = P.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const reach = 230 + e.r * 2;
      if (d < reach) {
        const w = Math.pow((reach - d) / reach, 2) * (e.kind === 'kid' && e.tier >= 2 ? 2.4 : 1) * (e.kind === 'final' ? 2.5 : 1);
        ax += (dx / d) * w;
        ay += (dy / d) * w;
        if (d < 140) near++;
      }
      if (d < nearest) {
        nearest = d;
        nx = dx / d;
        ny = dy / d;
      }
    }
    for (const s of g.eshots) {
      const dx = P.x - s.x;
      const dy = P.y - s.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 150) {
        ax += (dx / d) * 1.6;
        ay += (dy / d) * 1.6;
      }
    }
    // стены
    const m = 280;
    if (P.x < m) ax += (1 - P.x / m) * 1.8;
    if (P.x > WORLD - m) ax -= (1 - (WORLD - P.x) / m) * 1.8;
    if (P.y < m) ay += (1 - P.y / m) * 1.8;
    if (P.y > WORLD - m) ay -= (1 - (WORLD - P.y) / m) * 1.8;

    const danger = Math.hypot(ax, ay);
    let mx = ax;
    let my = ay;

    // боковое «скольжение» вдоль врага, чтобы не упираться в стену орды
    this.strafeT -= dt;
    if (this.strafeT <= 0) {
      this.strafe = Math.random() < 0.5 ? 1 : -1;
      this.strafeT = 1.5 + Math.random() * 2;
    }
    if (danger > 0.15) {
      mx += -ny * this.strafe * 0.6;
      my += nx * this.strafe * 0.6;
    }
    {
      // идём за гемами / едой (чем безопаснее, тем настойчивее)
      let best: { x: number; y: number } | null = null;
      let bd = 420 * 420;
      for (const gm of g.gems) {
        const d2 = (gm.x - P.x) ** 2 + (gm.y - P.y) ** 2;
        if (!gm.dead && d2 < bd) {
          bd = d2;
          best = gm;
        }
      }
      for (const p of g.pickups) {
        if (p.dead) continue;
        const d2 = (p.x - P.x) ** 2 + (p.y - P.y) ** 2;
        if (d2 < 600 * 600 && (p.kind !== 'heal' || P.hp < P.maxHp * 0.8)) {
          bd = 0;
          best = p;
        }
      }
      if (best) {
        const dx = best.x - P.x;
        const dy = best.y - P.y;
        const d = Math.hypot(dx, dy) || 1;
        const k = danger > 0.15 ? 0.55 : 0.9;
        mx += (dx / d) * k;
        my += (dy / d) * k;
      } else if (danger <= 0.15) {
        // к центру карты
        const dx = WORLD / 2 - P.x;
        const dy = WORLD / 2 - P.y;
        const d = Math.hypot(dx, dy) || 1;
        mx += (dx / d) * 0.3;
        my += (dy / d) * 0.3;
      }
    }
    const l = Math.hypot(mx, my);
    g.inp.x = l > 0.05 ? mx / l : 0;
    g.inp.y = l > 0.05 ? my / l : 0;

    // выбор «счастливицы»
    if (!g.chosen && P.busy <= 0 && g.arousal > this.contactAt && near < this.maxNear) {
      let best = null as null | (typeof g.women)[number];
      let bd = 1e18;
      for (const w of g.women) {
        if (w.state !== 'run') continue;
        const d2 = (w.x - P.x) ** 2 + (w.y - P.y) ** 2;
        if (d2 < bd) {
          bd = d2;
          best = w;
        }
      }
      if (best) g.chosen = best;
    }
  }
}

// ---- инструменты для настройки баланса: await __batch(8, {rate: 1.2}, {contactAt: 40}) ----
type SimResult = ReturnType<GameScene['simulate']>;

export async function runBatch(g: GameScene, n: number, tune: Record<string, number> = {}, cfg: Record<string, number> = {}) {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const T = (window as unknown as { __tune: Record<string, number> }).__tune;
  const defaults = (window as unknown as { __tuneDefaults: Record<string, number> }).__tuneDefaults;
  Object.assign(T, defaults, tune);
  const out: SimResult[] = [];
  for (let i = 0; i < n; i++) {
    g.scene.restart();
    await sleep(400);
    g.timeScale = 0;
    g.bot = new Bot();
    Object.assign(g.bot, cfg);
    out.push(g.simulate(420));
  }
  const avg = (f: (r: SimResult) => number) => (out.reduce((a, r) => a + f(r), 0) / n).toFixed(1);
  const at = (i: number) => out.map((r) => (r.samples[i] ? r.samples[i].hp : '-')).join(',');
  return {
    winRate: `${out.filter((r) => r.won).length}/${n}`,
    end: out.map((r) => (r.won ? 'W' : 'D') + r.t).join(','),
    lv: avg((r) => r.lv), kills: avg((r) => r.stats.kills), born: avg((r) => r.stats.kidsBorn), kidsKilled: avg((r) => r.stats.kidsKilled),
    contacts: avg((r) => r.stats.contacts), overflows: avg((r) => r.stats.overflows), bossKids: avg((r) => r.stats.bossKids), gifts: avg((r) => r.stats.gifts),
    hp60: at(1), hp120: at(3), hp180: at(5), hp240: at(7), hp300: at(9),
    sample: out[0].samples.map((x) => `${x.t}s hp${x.hp} L${x.lv} en${x.en} k${x.kids} ar${x.ar}`).join(' | '),
  };
}
