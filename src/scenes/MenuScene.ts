import Phaser from 'phaser';
import { DIFFICULTIES, H, W, RUN_TIME, applyDifficulty, loadDifficulty, type DiffKey } from '../config';
import { sfx } from '../sfx';

const FONT = 'Trebuchet MS, Segoe UI, sans-serif';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    this.add.tileSprite(0, 0, W, H, 'ground').setOrigin(0).setAlpha(0.55);
    this.add.rectangle(0, 0, W, H, 0x1a0f26, 0.72).setOrigin(0);

    const t = (x: number, y: number, s: string, size: number, color = '#fff', stroke = '#1a0a1e', st = 6) =>
      this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, stroke, strokeThickness: st, fontStyle: 'bold', align: 'center' }).setOrigin(0.5);

    const title = t(W / 2, 78, 'ПАПА ВЫЖИВАЕТ', 74, '#ffd34d', '#4a1030', 12);
    this.tweens.add({ targets: title, scale: 1.04, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
    t(W / 2, 138, 'комедийный экшен в духе Vampire Survivors', 24, '#ffd1e6');

    // бегущие эмодзи-персонажи
    const cast = ['e_player', 'e_w1', 'e_w5', 'e_w3', 'e_preg', 'e_baby', 'e_elite', 'e_brute', 'e_tesha'];
    cast.forEach((k, i) => {
      const im = this.add.image(220 + i * 105, 206, k).setDisplaySize(56, 56);
      this.tweens.add({ targets: im, y: 196, yoyo: true, repeat: -1, duration: 350 + i * 40, delay: i * 70, ease: 'Sine.easeInOut' });
    });

    const lines = [
      `Продержись ${Math.round(RUN_TIME / 60)} минут и победи финального босса — Тёщу.`,
      '',
      '🌡  «Пылкость» растёт сама. Хлынет через край — все дамы разом окажутся в положении!',
      '💘  Кликни по женщине (ЛКМ / Пробел) — выбрать избранную. Остальных ты отшиваешь выстрелами.',
      '🤰  Контакт сбрасывает шкалу. Мать убегает и рожает — чем больше родов, тем сильнее ребёнок.',
      '👶  Малыши — это опыт и подарки. Но элитки и боссы-«дети» умеют кусаться…',
      '',
      'WASD / стрелки — бег     ЛКМ — выбрать     ПКМ — отменить     P — пауза     M — звук',
      'Стрельба автоматическая. Все «сцены» — за кадром: тут только сердечки 🌳',
    ];
    this.add.text(W / 2, 252, lines.join('\n'), { fontFamily: FONT, fontSize: '18px', color: '#f3e8ff', align: 'center', lineSpacing: 6, stroke: '#1a0a1e', strokeThickness: 4 }).setOrigin(0.5, 0);

    // сложность
    let diff: DiffKey = loadDifficulty();
    const keys: DiffKey[] = ['easy', 'normal', 'hard'];
    const boxes: Phaser.GameObjects.Rectangle[] = [];
    const descT = t(W / 2, H - 108, '', 17, '#ffe9a0', '#1a0a1e', 4);
    const refresh = () => {
      keys.forEach((k, i) => {
        boxes[i].setFillStyle(k === diff ? 0xe0306a : 0x3a2150).setStrokeStyle(3, k === diff ? 0xffd1e6 : 0x6a4a80);
      });
      descT.setText(DIFFICULTIES[diff].desc);
    };
    keys.forEach((k, i) => {
      const x = W / 2 + (i - 1) * 230;
      const box = this.add.rectangle(x, H - 144, 210, 38, 0x3a2150).setInteractive({ useHandCursor: true });
      boxes.push(box);
      t(x, H - 144, `${i + 1}. ${DIFFICULTIES[k].name}`, 20, '#fff', '#1a0a1e', 4);
      box.on('pointerdown', () => {
        diff = k;
        refresh();
        sfx.click();
      });
    });
    refresh();
    this.input.keyboard!.on('keydown-ONE', () => { diff = 'easy'; refresh(); });
    this.input.keyboard!.on('keydown-TWO', () => { diff = 'normal'; refresh(); });
    this.input.keyboard!.on('keydown-THREE', () => { diff = 'hard'; refresh(); });

    const best = (() => {
      try {
        return JSON.parse(localStorage.getItem('papa_best') ?? 'null') as { time: number; win: boolean; kids: number } | null;
      } catch {
        return null;
      }
    })();
    if (best) t(W - 20, 18, `Рекорд: ${best.win ? '🏆 ПОБЕДА' : `${Math.floor(best.time / 60)}:${String(Math.floor(best.time % 60)).padStart(2, '0')}`}  ·  детей: ${best.kids}`, 16, '#ffe9a0').setOrigin(1, 0.5);

    const btn = this.add.rectangle(W / 2, H - 46, 380, 56, 0xe0306a).setStrokeStyle(4, 0xffd1e6).setInteractive({ useHandCursor: true });
    const bt = t(W / 2, H - 46, 'ИГРАТЬ (Enter)', 28, '#fff', '#5a0030', 6);
    this.tweens.add({ targets: [btn, bt], scale: 1.05, yoyo: true, repeat: -1, duration: 600 });
    const start = () => {
      sfx.unlock();
      sfx.click();
      this.scene.start('Game');
    };
    btn.on('pointerdown', start);
    this.input.keyboard!.once('keydown-ENTER', start);
    this.input.keyboard!.once('keydown-SPACE', start);
  }
}
