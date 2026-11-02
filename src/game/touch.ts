import Phaser from 'phaser';
import { H, W } from '../config';
import { sfx } from '../sfx';
import type { GameScene } from './GameScene';

const D = 9000;
const R = 70; // радиус джойстика
const TAP_MOVE = 18;
const TAP_MS = 300;

export const isTouchDevice = () =>
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

// Сенсорное управление: плавающий джойстик в левой половине экрана,
// тап по даме — выбрать, кнопки паузы и отмены выбора.
export class TouchControls {
  private stick: Phaser.GameObjects.Graphics;
  private padId = -1;
  private ox = 0;
  private oy = 0;
  private starts = new Map<number, { x: number; y: number; t: number }>();

  constructor(private g: GameScene) {
    g.input.addPointer(2);
    this.stick = g.add.graphics().setScrollFactor(0).setDepth(D).setVisible(false);

    const btn = (x: number, y: number, label: string, fn: () => void) => {
      const bg = g.add.circle(x, y, 34, 0x1a0f26, 0.7).setStrokeStyle(3, 0xffd1e6).setScrollFactor(0).setDepth(D).setInteractive();
      g.add.text(x, y, label, { fontSize: '30px' }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 1);
      bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        sfx.unlock();
        fn();
      });
      return bg;
    };
    btn(W - 50, 150, '⏸', () => g.togglePause());
    btn(W - 50, H - 60, '✖', () => {
      if (!g.paused && !g.over) g.chosen = null;
    });

    g.input.on('pointerdown', this.down, this);
    g.input.on('pointermove', this.move, this);
    g.input.on('pointerup', this.up, this);
    g.input.on('pointerupoutside', this.up, this);
  }

  private isTouch(p: Phaser.Input.Pointer) {
    return !!(p.wasTouch || (p.event as PointerEvent | undefined)?.pointerType === 'touch');
  }

  private down(p: Phaser.Input.Pointer) {
    if (!this.isTouch(p)) return;
    this.starts.set(p.id, { x: p.x, y: p.y, t: this.g.time.now });
    if (this.padId < 0 && p.x < W * 0.5) {
      this.padId = p.id;
      this.ox = p.x;
      this.oy = p.y;
      this.draw(p.x, p.y);
    }
  }

  private move(p: Phaser.Input.Pointer) {
    if (p.id !== this.padId) return;
    let dx = p.x - this.ox;
    let dy = p.y - this.oy;
    const m = Math.hypot(dx, dy);
    if (m > R) {
      // «тянущийся» джойстик: центр следует за пальцем
      this.ox += (dx / m) * (m - R);
      this.oy += (dy / m) * (m - R);
      dx = p.x - this.ox;
      dy = p.y - this.oy;
    }
    const k = Math.min(1, Math.hypot(dx, dy) / R);
    const a = Math.atan2(dy, dx);
    this.g.inp.x = k > 0.15 ? Math.cos(a) * k : 0;
    this.g.inp.y = k > 0.15 ? Math.sin(a) * k : 0;
    this.draw(p.x, p.y);
  }

  private up(p: Phaser.Input.Pointer) {
    const s = this.starts.get(p.id);
    this.starts.delete(p.id);
    if (p.id === this.padId) {
      this.padId = -1;
      this.g.inp.x = 0;
      this.g.inp.y = 0;
      this.stick.setVisible(false);
    }
    // короткий тап без сдвига — выбор дамы
    if (s && this.isTouch(p) && !this.g.paused && !this.g.over && Math.hypot(p.x - s.x, p.y - s.y) < TAP_MOVE && this.g.time.now - s.t < TAP_MS) {
      const wp = this.g.cameras.main.getWorldPoint(p.x, p.y);
      this.g.chooseNearest(wp.x, wp.y, 110);
    }
  }

  private draw(x: number, y: number) {
    this.stick.clear().setVisible(true);
    this.stick.fillStyle(0xffffff, 0.12).fillCircle(this.ox, this.oy, R);
    this.stick.lineStyle(3, 0xffd1e6, 0.5).strokeCircle(this.ox, this.oy, R);
    const dx = x - this.ox;
    const dy = y - this.oy;
    const m = Math.min(R, Math.hypot(dx, dy)) || 0;
    const a = Math.atan2(dy, dx);
    this.stick.fillStyle(0xffd1e6, 0.55).fillCircle(this.ox + Math.cos(a) * m, this.oy + Math.sin(a) * m, 30);
  }
}
