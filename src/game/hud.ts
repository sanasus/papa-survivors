import Phaser from 'phaser';
import { H, RUN_TIME, W, WOMAN, clamp, rand, xpNeed } from '../config';
import { UPGRADES, type UpDef } from './upgrades';
import type { GameScene } from './GameScene';
import type { PassiveId, WeaponId } from './types';

const FONT = 'Trebuchet MS, Segoe UI, sans-serif';
const D = 10000;

export class Hud {
  private g: GameScene;
  private bars: Phaser.GameObjects.Graphics;
  private lvl: Phaser.GameObjects.Text;
  private hp: Phaser.GameObjects.Text;
  private time: Phaser.GameObjects.Text;
  private info: Phaser.GameObjects.Text;
  private gaugeLabel: Phaser.GameObjects.Text;
  private chosenText: Phaser.GameObjects.Text;
  private bossText: Phaser.GameObjects.Text;
  private announceT: Phaser.GameObjects.Text;
  private announceS: Phaser.GameObjects.Text;
  private toastT: Phaser.GameObjects.Text;
  private hintT: Phaser.GameObjects.Text;
  private pausedT: Phaser.GameObjects.Text;
  private invItems: Phaser.GameObjects.GameObject[] = [];
  private menuItems: Phaser.GameObjects.GameObject[] = [];
  private sceneRect: Phaser.GameObjects.Rectangle;
  private sceneBush: Phaser.GameObjects.Image;
  private sceneHeart: Phaser.GameObjects.Image;
  private sceneText: Phaser.GameObjects.Text;
  private sceneTitle: Phaser.GameObjects.Text;
  private flashRect: Phaser.GameObjects.Rectangle;
  private sceneOn = false;
  private sceneHeartTimer = 0;
  private toastTimer?: Phaser.Time.TimerEvent;
  private hintTimer?: Phaser.Time.TimerEvent;
  private last = { gauge: -1 };

  constructor(g: GameScene) {
    this.g = g;
    const mk = (x: number, y: number, s: string, size: number, color = '#fff', stroke = '#1a0a1e', st = 4) =>
      g.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, stroke, strokeThickness: st, fontStyle: 'bold' }).setScrollFactor(0).setDepth(D + 1);

    this.bars = g.add.graphics().setScrollFactor(0).setDepth(D);
    this.lvl = mk(12, 20, '', 18).setOrigin(0, 0);
    this.hp = mk(14, 46, '', 15, '#fff').setOrigin(0, 0);
    this.time = mk(W / 2, 22, '', 34).setOrigin(0.5, 0);
    this.info = mk(W - 14, 20, '', 18).setOrigin(1, 0);
    this.gaugeLabel = mk(W / 2, H - 78, '', 18, '#ffd1e6').setOrigin(0.5);
    this.chosenText = mk(W / 2, H - 100, '', 15, '#ffffff').setOrigin(0.5);
    this.bossText = mk(W / 2, 74, '', 16, '#ffd0d0').setOrigin(0.5).setVisible(false);
    this.announceT = mk(W / 2, 170, '', 46, '#fff', '#1a0a1e', 8).setOrigin(0.5).setAlpha(0).setDepth(D + 20);
    this.announceS = mk(W / 2, 218, '', 22, '#fff', '#1a0a1e', 5).setOrigin(0.5).setAlpha(0).setDepth(D + 20);
    this.toastT = mk(W / 2, 128, '', 17, '#fff7c2').setOrigin(0.5).setAlpha(0);
    this.hintT = mk(W / 2, H - 128, '', 16, '#fff').setOrigin(0.5).setAlpha(0);
    this.pausedT = mk(W / 2, H / 2, 'ПАУЗА\n(P — продолжить)', 40).setOrigin(0.5).setAlign('center').setVisible(false).setDepth(D + 30);

    // «сцена» контакта
    this.sceneRect = g.add.rectangle(0, 0, W, H, 0x050008).setOrigin(0).setScrollFactor(0).setDepth(D + 10).setAlpha(0).setVisible(false);
    this.sceneBush = g.add.image(W / 2, H / 2 - 20, 'e_bush').setScrollFactor(0).setDepth(D + 11).setDisplaySize(190, 190).setVisible(false);
    this.sceneHeart = g.add.image(W / 2, H / 2 - 150, 'e_hearts').setScrollFactor(0).setDepth(D + 12).setDisplaySize(90, 90).setVisible(false);
    this.sceneTitle = mk(W / 2, H / 2 + 100, 'ЦЕНЗУРА', 38, '#ff7fae', '#2a0020', 7).setOrigin(0.5).setDepth(D + 12).setVisible(false);
    this.sceneText = mk(W / 2, H / 2 + 150, '', 22, '#ffe9f3', '#2a0020', 5).setOrigin(0.5).setDepth(D + 12).setVisible(false);
    this.flashRect = g.add.rectangle(0, 0, W, H, 0xffffff).setOrigin(0).setScrollFactor(0).setDepth(D + 40).setAlpha(0);

    this.refreshInventory();
  }

  // ------------------------------------------------------------------ обновление
  update() {
    const g = this.g;
    const P = g.P;
    const bar = this.bars;
    bar.clear();

    // XP
    const xpP = clamp(g.xp / xpNeed(g.level), 0, 1);
    bar.fillStyle(0x120a1c, 0.85).fillRect(0, 0, W, 14);
    bar.fillStyle(0x58d0ff, 1).fillRect(0, 0, W * xpP, 14);
    bar.fillStyle(0xffffff, 0.25).fillRect(0, 0, W * xpP, 5);
    this.lvl.setText(`Ур. ${g.level}`);

    // HP
    const hpP = clamp(P.hp / P.maxHp, 0, 1);
    bar.fillStyle(0x120a1c, 0.85).fillRoundedRect(10, 44, 230, 22, 6);
    bar.fillStyle(hpP > 0.35 ? 0xe83a50 : 0xff1c1c, 1).fillRoundedRect(12, 46, 226 * hpP, 18, 5);
    this.hp.setText(`❤ ${Math.ceil(P.hp)} / ${P.maxHp}`).setPosition(18, 46);

    // время
    const left = Math.max(0, RUN_TIME - g.t);
    if (g.t < RUN_TIME) {
      const m = Math.floor(left / 60);
      const s = Math.floor(left % 60);
      this.time.setText(`${m}:${String(s).padStart(2, '0')}`).setColor(left < 20 ? '#ff7070' : '#ffffff');
    } else this.time.setText('БОСС!').setColor('#ff5050');

    // инфо
    let preg = 0;
    for (const w of g.women) if (w.state === 'preg') preg++;
    const kids = g.enemies.filter((e) => e.kind === 'kid' && !e.dead).length;
    this.info.setText(`🤰 ${preg}   👶 ${kids}   💀 ${g.stats.kills}`);

    // шкала возбуждения
    const gx = W / 2 - 330;
    const gy = H - 52;
    const gp = clamp(g.arousal / 100, 0, 1);
    const hot = gp > 0.82;
    const shake = hot ? Math.sin(g.time.now / 25) * (gp - 0.82) * 28 : 0;
    const col = Phaser.Display.Color.Interpolate.ColorWithColor(new Phaser.Display.Color(255, 140, 190), new Phaser.Display.Color(255, 30, 60), 100, Math.round(gp * 100));
    const colHex = Phaser.Display.Color.GetColor(col.r, col.g, col.b);
    bar.fillStyle(0x120a1c, 0.9).fillRoundedRect(gx - 4 + shake, gy - 4, 668, 34, 10);
    bar.fillStyle(0x3a1a38, 1).fillRoundedRect(gx + shake, gy, 660, 26, 7);
    if (gp > 0.01) bar.fillStyle(colHex, 1).fillRoundedRect(gx + shake, gy, Math.max(14, 660 * gp), 26, 7);
    if (hot && Math.floor(g.time.now / 120) % 2 === 0) bar.fillStyle(0xffffff, 0.35).fillRoundedRect(gx + shake, gy, 660 * gp, 26, 7);
    for (let i = 1; i < 10; i++) bar.fillStyle(0x000000, 0.2).fillRect(gx + 66 * i + shake, gy, 2, 26);
    const pct = Math.floor(g.arousal);
    if (pct !== this.last.gauge) {
      this.last.gauge = pct;
      this.gaugeLabel.setText(`🌡 ПЫЛКОСТЬ ${pct}%`);
    }
    this.gaugeLabel.setColor(hot ? '#ff6b8a' : '#ffd1e6').setScale(hot ? 1 + 0.06 * Math.sin(g.time.now / 60) : 1);

    // избранная
    const c = g.chosen;
    this.chosenText.setText(c ? `💘 Избранная: ${c.name}${c.births ? ` (уже ×${c.births})` : ''} — ПКМ отмена` : 'Избранной нет — кликни по женщине (или Пробел)');
    this.chosenText.setColor(c ? '#ff9ac6' : '#c9b8d4');

    // босс-бар
    const fb = g.finalBoss;
    if (fb && !fb.dead) {
      const p = clamp(fb.hp / fb.maxHp, 0, 1);
      bar.fillStyle(0x120a1c, 0.9).fillRoundedRect(W / 2 - 254, 58, 508, 22, 6);
      bar.fillStyle(p > 0.5 ? 0xc03030 : 0xff5a1a, 1).fillRoundedRect(W / 2 - 250, 62, 500 * p, 14, 4);
      this.bossText.setVisible(true).setText(`ТЁЩА ${Math.ceil(fb.hp)}`).setY(97);
      // стрелка к боссу, если он за экраном
      const cam = g.cameras.main;
      const sx = fb.x - cam.scrollX;
      const sy = fb.y - cam.scrollY;
      if (sx < 0 || sx > W || sy < 0 || sy > H) {
        const a = Math.atan2(sy - H / 2, sx - W / 2);
        const m = 40;
        const k = Math.min((W / 2 - m) / Math.max(Math.abs(Math.cos(a)), 1e-6), (H / 2 - m) / Math.max(Math.abs(Math.sin(a)), 1e-6));
        const px = W / 2 + Math.cos(a) * k;
        const py = H / 2 + Math.sin(a) * k;
        const c = Math.cos(a);
        const s = Math.sin(a);
        bar.fillStyle(0xff3030, 0.95).fillTriangle(px + c * 20, py + s * 20, px - c * 12 - s * 14, py - s * 12 + c * 14, px - c * 12 + s * 14, py - s * 12 - c * 14);
        bar.lineStyle(3, 0x300000, 1).strokeTriangle(px + c * 20, py + s * 20, px - c * 12 - s * 14, py - s * 12 + c * 14, px - c * 12 + s * 14, py - s * 12 - c * 14);
      }
    } else this.bossText.setVisible(false);

    // сцена
    if (this.sceneOn) {
      const total = WOMAN.contactTime;
      const p = clamp(1 - P.busy / total, 0, 1);
      const a = Math.min(1, p * 7, (1 - p) * 7) * 0.88;
      this.sceneRect.setAlpha(a);
      const vis = a > 0.15;
      this.sceneBush.setVisible(vis).setAlpha(Math.min(1, a * 1.2));
      this.sceneHeart.setVisible(vis).setAlpha(a);
      this.sceneTitle.setVisible(vis).setAlpha(a);
      this.sceneText.setVisible(vis).setAlpha(a);
      this.sceneBush.setX(W / 2 + Math.sin(g.time.now / 28) * 7).setAngle(Math.sin(g.time.now / 55) * 4);
      this.sceneHeart.setScale((90 / 128) * (1 + 0.18 * Math.sin(g.time.now / 70)));
      this.sceneHeartTimer -= g.game.loop.delta / 1000;
      if (this.sceneHeartTimer <= 0 && vis) {
        this.sceneHeartTimer = 0.09;
        const h = g.add.image(W / 2 + rand(-160, 160), H / 2 + 40, 'e_heart').setScrollFactor(0).setDepth(D + 13).setDisplaySize(rand(18, 34), rand(18, 34));
        g.tweens.add({ targets: h, y: H / 2 - rand(120, 260), alpha: 0, duration: 800, onComplete: () => h.destroy() });
      }
    }
  }

  // ------------------------------------------------------------------ сцена контакта
  showScene(caption: string) {
    this.sceneOn = true;
    this.sceneRect.setVisible(true).setAlpha(0);
    this.sceneText.setText(caption);
  }

  hideScene() {
    this.sceneOn = false;
    this.sceneRect.setVisible(false);
    this.sceneBush.setVisible(false);
    this.sceneHeart.setVisible(false);
    this.sceneTitle.setVisible(false);
    this.sceneText.setVisible(false);
  }

  flash() {
    this.flashRect.setAlpha(0.85);
    this.g.tweens.add({ targets: this.flashRect, alpha: 0, duration: 700 });
  }

  // ------------------------------------------------------------------ тексты
  announce(title: string, color = '#fff', sub = '') {
    this.announceT.setText(title).setColor(color).setAlpha(1).setScale(0.6);
    this.announceS.setText(sub).setAlpha(sub ? 1 : 0);
    this.g.tweens.killTweensOf(this.announceT);
    this.g.tweens.killTweensOf(this.announceS);
    this.g.tweens.add({ targets: this.announceT, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.g.tweens.add({ targets: [this.announceT, this.announceS], alpha: 0, delay: 2200, duration: 700 });
  }

  toast(text: string) {
    this.toastT.setText(text).setAlpha(1);
    this.toastTimer?.remove(false);
    this.g.tweens.killTweensOf(this.toastT);
    this.g.tweens.add({ targets: this.toastT, alpha: 0, delay: 2600, duration: 600 });
  }

  hint(text: string, color: number) {
    this.hintT.setText(text).setColor('#' + color.toString(16).padStart(6, '0')).setAlpha(1);
    this.g.tweens.killTweensOf(this.hintT);
    this.g.tweens.add({ targets: this.hintT, alpha: 0, delay: 6500, duration: 800 });
  }

  setPaused(p: boolean) {
    this.pausedT.setVisible(p);
  }

  // ------------------------------------------------------------------ инвентарь
  refreshInventory() {
    const g = this.g;
    this.invItems.forEach((o) => o.destroy());
    this.invItems = [];
    let x = 24;
    const y = H - 30;
    const add = (u: UpDef, lv: number) => {
      const bg = g.add.rectangle(x, y, 40, 40, 0x1a0f26, 0.85).setScrollFactor(0).setDepth(D + 2).setStrokeStyle(2, u.kind === 'weapon' ? 0xffd34d : 0x8fd0ff);
      const im = g.add.image(x, y - 2, u.tex).setScrollFactor(0).setDepth(D + 3).setDisplaySize(26, 26);
      const t = g.add.text(x + 10, y + 8, String(lv), { fontFamily: FONT, fontSize: '13px', color: '#fff', stroke: '#000', strokeThickness: 3, fontStyle: 'bold' }).setScrollFactor(0).setDepth(D + 4).setOrigin(0.5);
      this.invItems.push(bg, im, t);
      x += 46;
    };
    for (const u of UPGRADES) if (u.kind === 'weapon' && g.weapons[u.id as WeaponId]) add(u, g.weapons[u.id as WeaponId]!.lv);
    x += 10;
    for (const u of UPGRADES) if (u.kind === 'passive' && g.passives[u.id as PassiveId]) add(u, g.passives[u.id as PassiveId]!);
  }

  // ------------------------------------------------------------------ меню улучшений
  showMenu(opts: UpDef[]) {
    const g = this.g;
    this.hideMenu();
    const dim = g.add.rectangle(0, 0, W, H, 0x000000, 0.62).setOrigin(0).setScrollFactor(0).setDepth(D + 50);
    const title = g.add.text(W / 2, 96, g.menuFree ? 'ПОДАРОК!' : 'УРОВЕНЬ ПОВЫШЕН!', {
      fontFamily: FONT, fontSize: '44px', color: '#ffe14d', stroke: '#2a1200', strokeThickness: 8, fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 51);
    const sub = g.add.text(W / 2, 142, 'Выбери (1 / 2 / 3 или клик)', { fontFamily: FONT, fontSize: '20px', color: '#fff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 51);
    this.menuItems.push(dim, title, sub);
    opts.forEach((u, i) => {
      const cx = W / 2 + (i - 1) * 340;
      const cy = H / 2 + 40;
      const card = g.add.rectangle(cx, cy, 310, 380, 0x23132f, 1).setScrollFactor(0).setDepth(D + 52).setStrokeStyle(4, u.kind === 'weapon' ? 0xffd34d : 0x8fd0ff).setInteractive({ useHandCursor: true });
      const lv = g.levelOf(u);
      const icon = g.add.image(cx, cy - 110, u.tex).setScrollFactor(0).setDepth(D + 53).setDisplaySize(96, 96);
      const kind = g.add.text(cx, cy - 170, u.kind === 'weapon' ? 'ОРУЖИЕ' : 'ПАССИВКА', { fontFamily: FONT, fontSize: '14px', color: u.kind === 'weapon' ? '#ffd34d' : '#8fd0ff', stroke: '#000', strokeThickness: 3, fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 53);
      const name = g.add.text(cx, cy - 36, u.name, { fontFamily: FONT, fontSize: '24px', color: '#fff', stroke: '#000', strokeThickness: 4, fontStyle: 'bold', align: 'center', wordWrap: { width: 280 } }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 53);
      const lvT = g.add.text(cx, cy + 10, lv === 0 ? 'НОВОЕ!' : `Ур. ${lv} → ${lv + 1}`, { fontFamily: FONT, fontSize: '20px', color: lv === 0 ? '#6dffa0' : '#ffd1e6', stroke: '#000', strokeThickness: 4, fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 53);
      const desc = g.add.text(cx, cy + 90, u.desc(lv + 1), { fontFamily: FONT, fontSize: '17px', color: '#e8dcf2', align: 'center', wordWrap: { width: 270 } }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 53);
      const key = g.add.text(cx, cy + 165, String(i + 1), { fontFamily: FONT, fontSize: '26px', color: '#ffd1e6', stroke: '#000', strokeThickness: 4, fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 53);
      card.on('pointerover', () => card.setFillStyle(0x3a2150));
      card.on('pointerout', () => card.setFillStyle(0x23132f));
      card.on('pointerdown', () => g.pickUpgrade(i));
      this.menuItems.push(card, icon, kind, name, lvT, desc, key);
    });
  }

  hideMenu() {
    this.menuItems.forEach((o) => o.destroy());
    this.menuItems = [];
  }
}
