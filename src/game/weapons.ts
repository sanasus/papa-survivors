import { WOMAN } from '../config';
import { sfx } from '../sfx';
import type { GameScene } from './GameScene';
import type { Bullet, Pool, Slipper, WeaponState } from './types';
import { WP } from './upgrades';

/** Ближайшая цель для автоприцела: враги + женщины, которых надо отшить (кроме избранной). */
export function nearestTarget(g: GameScene, range: number): { x: number; y: number } | null {
  const P = g.P;
  let best: { x: number; y: number } | null = null;
  let bd = range * range;
  for (const e of g.enemies) {
    if (e.dead) continue;
    const dx = e.x - P.x;
    const dy = e.y - P.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bd) {
      bd = d2;
      best = e;
    }
  }
  const wr = Math.min(range, 340);
  for (const w of g.women) {
    if (w.state !== 'run' || g.chosen === w || w.stun > 0.2) continue;
    const dx = w.x - P.x;
    const dy = w.y - P.y;
    const d2 = (dx * dx + dy * dy) * 0.55; // женщин отшиваем чуть охотнее
    if (d2 < bd && d2 < wr * wr) {
      bd = d2;
      best = w;
    }
  }
  return best;
}

export function updateWeapons(g: GameScene, dt: number) {
  const W = g.weapons;
  if (W.kiss) kiss(g, W.kiss, dt);
  if (W.rose) rose(g, W.rose, dt);
  if (W.slipper) slipperW(g, W.slipper, dt);
  if (W.borscht) borscht(g, W.borscht, dt);
  if (W.megaphone) megaphone(g, W.megaphone, dt);
  updateBullets(g, dt);
  updateSlippers(g, dt);
  updatePools(g, dt);
}

// ---------------------------------------------------------------- поцелуи
function kiss(g: GameScene, s: WeaponState, dt: number) {
  s.t -= dt;
  if (s.t > 0) return;
  const p = WP.kiss(s.lv);
  const tgt = nearestTarget(g, p.range);
  if (!tgt) {
    s.t = 0.05;
    return;
  }
  s.t = p.cd * g.S.cdMul;
  const P = g.P;
  const base = Math.atan2(tgt.y - P.y, tgt.x - P.x);
  for (let i = 0; i < p.count; i++) {
    const a = base + (p.count > 1 ? (i - (p.count - 1) / 2) * 0.15 : 0);
    const spr = g.add.image(P.x, P.y, 'e_kiss').setDisplaySize(22, 22).setDepth(9000).setRotation(a);
    g.bullets.push({
      x: P.x, y: P.y, vx: Math.cos(a) * p.speed, vy: Math.sin(a) * p.speed, r: 9, dmg: p.dmg * g.S.dmgMul, pierce: p.pierce,
      life: p.range / p.speed + 0.15, spr, hit: new Set<number>(), dead: false,
    } as Bullet);
  }
  sfx.shoot();
}

function updateBullets(g: GameScene, dt: number) {
  for (const b of g.bullets) {
    if (b.dead) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    b.spr.setPosition(b.x, b.y);
    if (b.life <= 0) {
      b.dead = true;
      continue;
    }
    g.queryEnemies(b.x, b.y, b.r + 70, (e) => {
      if (b.dead || b.hit.has(e.id)) return;
      const dx = e.x - b.x;
      const dy = e.y - b.y;
      const rr = e.r + b.r;
      if (dx * dx + dy * dy < rr * rr) {
        b.hit.add(e.id);
        g.damageEnemy(e, b.dmg, b.vx, b.vy, 130);
        if (b.pierce > 0) b.pierce--;
        else b.dead = true;
      }
    });
    if (b.dead) continue;
    for (const w of g.women) {
      if (w.state !== 'run' || g.chosen === w || b.hit.has(-w.id)) continue;
      const dx = w.x - b.x;
      const dy = w.y - b.y;
      const rr = w.r + b.r;
      if (dx * dx + dy * dy < rr * rr) {
        b.hit.add(-w.id);
        g.repelWoman(w, b.vx, b.vy, WOMAN.knock, WOMAN.stun);
        if (b.pierce > 0) b.pierce--;
        else {
          b.dead = true;
          break;
        }
      }
    }
  }
}

// ---------------------------------------------------------------- розы
function rose(g: GameScene, s: WeaponState, dt: number) {
  const p = WP.rose(s.lv);
  if (!s.roses || s.roses.length !== p.count) g.rebuildRoses();
  const roses = s.roses!;
  s.angle = (s.angle ?? 0) + p.rot * dt;
  const P = g.P;
  const n = roses.length;
  for (let i = 0; i < n; i++) {
    const a = s.angle + (i / n) * Math.PI * 2;
    const x = P.x + Math.cos(a) * p.radius;
    const y = P.y + Math.sin(a) * p.radius;
    roses[i].setPosition(x, y).setRotation(a + 1.6).setDepth(9000);
    g.queryEnemies(x, y, 16 + 70, (e) => {
      if (e.hitRose > 0) return;
      const dx = e.x - x;
      const dy = e.y - y;
      const rr = e.r + 14;
      if (dx * dx + dy * dy < rr * rr) {
        e.hitRose = 0.4;
        g.damageEnemy(e, p.dmg * g.S.dmgMul, e.x - P.x, e.y - P.y, 170);
      }
    });
    for (const w of g.women) {
      if (w.state !== 'run') continue;
      const dx = w.x - x;
      const dy = w.y - y;
      const rr = w.r + 14;
      if (dx * dx + dy * dy < rr * rr) g.repelWoman(w, w.x - P.x, w.y - P.y, WOMAN.knock, WOMAN.stun);
    }
  }
}

// ---------------------------------------------------------------- тапок
function slipperW(g: GameScene, s: WeaponState, dt: number) {
  s.t -= dt;
  if (s.t > 0) return;
  const p = WP.slipper(s.lv);
  const P = g.P;
  // целимся в ближайшего врага (не в женщин)
  let best: { x: number; y: number } | null = null;
  let bd = 520 * 520;
  for (const e of g.enemies) {
    if (e.dead) continue;
    const d2 = (e.x - P.x) ** 2 + (e.y - P.y) ** 2;
    if (d2 < bd) {
      bd = d2;
      best = e;
    }
  }
  if (!best) {
    s.t = 0.1;
    return;
  }
  s.t = p.cd * g.S.cdMul;
  const base = Math.atan2(best.y - P.y, best.x - P.x);
  for (let i = 0; i < p.count; i++) {
    const a = base + (p.count > 1 ? (i - (p.count - 1) / 2) * 0.55 : 0);
    const spr = g.add.image(P.x, P.y, 'e_slipper').setDisplaySize(34 * p.scale, 34 * p.scale).setDepth(9000);
    g.slippers.push({
      x: P.x, y: P.y, dx: Math.cos(a), dy: Math.sin(a), t: 0, out: 0.5, dist: p.dist, dmg: p.dmg * g.S.dmgMul, spr, returning: false,
      hit: new Map<number, number>(), dead: false,
    } as Slipper);
  }
}

function updateSlippers(g: GameScene, dt: number) {
  const P = g.P;
  for (const s of g.slippers) {
    if (s.dead) continue;
    s.t += dt;
    if (!s.returning) {
      const sp = (s.dist / s.out) * 1.1 * (1 - 0.7 * (s.t / s.out));
      s.x += s.dx * sp * dt;
      s.y += s.dy * sp * dt;
      if (s.t >= s.out) s.returning = true;
    } else {
      const dx = P.x - s.x;
      const dy = P.y - s.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = 480 + 300 * (s.t - s.out);
      s.x += (dx / d) * sp * dt;
      s.y += (dy / d) * sp * dt;
      if (d < 20 || s.t > 5) s.dead = true;
    }
    s.spr.setPosition(s.x, s.y).setRotation(s.spr.rotation + 18 * dt);
    g.queryEnemies(s.x, s.y, 20 + 70, (e) => {
      if (e.hitSlip > 0) return;
      const rr = e.r + 16;
      if ((e.x - s.x) ** 2 + (e.y - s.y) ** 2 < rr * rr) {
        e.hitSlip = 0.28;
        g.damageEnemy(e, s.dmg, e.x - P.x, e.y - P.y, 200);
      }
    });
    for (const w of g.women) {
      if (w.state !== 'run') continue;
      if ((w.x - s.x) ** 2 + (w.y - s.y) ** 2 < (w.r + 16) ** 2) g.repelWoman(w, w.x - s.x, w.y - s.y, WOMAN.knock, WOMAN.stun);
    }
  }
}

// ---------------------------------------------------------------- борщ
function borscht(g: GameScene, s: WeaponState, dt: number) {
  s.t -= dt;
  if (s.t > 0) return;
  const p = WP.borscht(s.lv);
  const P = g.P;
  s.t = p.cd * g.S.cdMul;
  const cands = g.enemies.filter((e) => !e.dead && (e.x - P.x) ** 2 + (e.y - P.y) ** 2 < 380 * 380);
  for (let i = 0; i < p.count; i++) {
    let x: number;
    let y: number;
    if (cands.length) {
      const e = cands[Math.floor(Math.random() * cands.length)];
      x = e.x + (Math.random() - 0.5) * 40;
      y = e.y + (Math.random() - 0.5) * 40;
    } else {
      const a = Math.random() * 6.28;
      x = P.x + Math.cos(a) * 140;
      y = P.y + Math.sin(a) * 140;
    }
    const spr = g.add.image(x, y, 'pool').setDisplaySize(p.radius * 2, p.radius * 2).setDepth(-1500);
    g.pools.push({ x, y, r: p.radius, life: p.dur, dps: p.dps * g.S.dmgMul, tick: 0.1, spr } as Pool);
  }
}

function updatePools(g: GameScene, dt: number) {
  for (let i = g.pools.length - 1; i >= 0; i--) {
    const pl = g.pools[i];
    pl.life -= dt;
    pl.tick -= dt;
    pl.spr.setAlpha(Math.min(1, pl.life / 0.6) * (0.75 + 0.25 * Math.sin(g.t * 8 + i)));
    if (pl.tick <= 0) {
      pl.tick = 0.25;
      g.queryEnemies(pl.x, pl.y, pl.r + 70, (e) => {
        const rr = pl.r + e.r * 0.4;
        if ((e.x - pl.x) ** 2 + (e.y - pl.y) ** 2 < rr * rr) g.damageEnemy(e, pl.dps * 0.25, 0, 0, 0);
      });
    }
    if (pl.life <= 0) {
      pl.spr.destroy();
      g.pools.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------- мегафон
function megaphone(g: GameScene, s: WeaponState, dt: number) {
  s.t -= dt;
  if (s.t > 0) return;
  const p = WP.megaphone(s.lv);
  const P = g.P;
  // не тратим заряд впустую
  let anyone = false;
  for (const e of g.enemies) {
    if (!e.dead && (e.x - P.x) ** 2 + (e.y - P.y) ** 2 < p.radius * p.radius) {
      anyone = true;
      break;
    }
  }
  if (!anyone) {
    for (const w of g.women) {
      if (w.state === 'run' && (w.x - P.x) ** 2 + (w.y - P.y) ** 2 < (p.radius * 0.8) ** 2) {
        anyone = true;
        break;
      }
    }
  }
  if (!anyone) {
    s.t = 0.15;
    return;
  }
  s.t = p.cd * g.S.cdMul;
  g.queryEnemies(P.x, P.y, p.radius + 70, (e) => {
    const rr = p.radius + e.r;
    if ((e.x - P.x) ** 2 + (e.y - P.y) ** 2 < rr * rr) g.damageEnemy(e, p.dmg * g.S.dmgMul, e.x - P.x, e.y - P.y, 560);
  });
  for (const w of g.women) {
    if ((w.x - P.x) ** 2 + (w.y - P.y) ** 2 < (p.radius + w.r) ** 2) g.repelWoman(w, w.x - P.x, w.y - P.y, 780, p.stun);
  }
  g.rings.push({ x: P.x, y: P.y, t: 0, dur: 0.45, R: p.radius, color: 0xffee66 });
  g.say(P.x, P.y - 40, 'ТИХО!!!', '#ffe066');
  sfx.boss();
}
