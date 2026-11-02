import Phaser from 'phaser';
import { H, W } from '../config';
import { sfx } from '../sfx';
import type { RunStats } from '../game/GameScene';

const FONT = 'Trebuchet MS, Segoe UI, sans-serif';

interface EndData {
  win: boolean;
  stats: RunStats;
  time: number;
  level: number;
}

export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  create(data: EndData) {
    const { win, stats, time, level } = data;
    this.add.rectangle(0, 0, W, H, win ? 0x2a1a3e : 0x2a0c14).setOrigin(0);
    const t = (x: number, y: number, s: string, size: number, color = '#fff', stroke = '#1a0a1e', st = 6) =>
      this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, stroke, strokeThickness: st, fontStyle: 'bold', align: 'center' }).setOrigin(0.5);

    t(W / 2, 100, win ? '🏆 ПОБЕДА!' : '💀 ТЕБЯ ЗАТОПТАЛИ', 72, win ? '#ffe14d' : '#ff6a6a', '#2a1030', 12);
    t(W / 2, 175, win ? 'Тёща повержена. Алименты — на всю жизнь, зато живой.' : 'Семья растёт, а ты — нет. Алименты оказались неподъёмными.', 24, '#ffd1e6');

    const m = Math.floor(time / 60);
    const s = String(Math.floor(time % 60)).padStart(2, '0');
    const rows = [
      `⏱  Время забега: ${m}:${s}`,
      `⭐  Уровень: ${level}`,
      `💀  Побеждено врагов: ${stats.kills}`,
      `🤰  Контактов: ${stats.contacts}     🌡 Переполнений шкалы: ${stats.overflows}`,
      `👶  Детей рождено: ${stats.kidsBorn}     Побеждено детей: ${stats.kidsKilled}`,
      `👹  Детей-боссов: ${stats.bossKids}     🎁 Подарков: ${stats.gifts}`,
      stats.bestMom ? `👑  Мать года: ${stats.bestMom} (беременностей: ${stats.bestMomN})` : '',
    ];
    this.add.text(W / 2, 250, rows.join('\n'), { fontFamily: FONT, fontSize: '26px', color: '#fff', align: 'center', lineSpacing: 12, stroke: '#1a0a1e', strokeThickness: 5 }).setOrigin(0.5, 0);

    try {
      const prev = JSON.parse(localStorage.getItem('papa_best') ?? 'null') as { time: number; win: boolean; kids: number } | null;
      const better = !prev || (win && !prev.win) || (win === prev.win && time > prev.time);
      if (better) localStorage.setItem('papa_best', JSON.stringify({ time, win, kids: stats.kidsBorn }));
    } catch {
      /* без сохранения рекордов */
    }

    const btn = this.add.rectangle(W / 2, H - 80, 420, 66, 0xe0306a).setStrokeStyle(4, 0xffd1e6).setInteractive({ useHandCursor: true });
    t(W / 2, H - 80, 'ЕЩЁ РАЗ', 32, '#fff', '#5a0030', 6);
    const go = () => {
      sfx.click();
      this.scene.start('Game');
    };
    btn.on('pointerdown', go);
    this.input.keyboard!.once('keydown-ENTER', go);
    this.input.keyboard!.once('keydown-SPACE', go);
    this.input.keyboard!.once('keydown-ESC', () => this.scene.start('Menu'));
  }
}
