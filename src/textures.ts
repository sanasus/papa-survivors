import Phaser from 'phaser';

const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

const EMOJI: Record<string, string> = {
  e_player: '🕺',
  e_w1: '👩',
  e_w2: '👱‍♀️',
  e_w3: '👩‍🦰',
  e_w4: '👩‍🦱',
  e_w5: '💃',
  e_w6: '🧛‍♀️',
  e_preg: '🤰',
  e_angry: '😡',
  e_runner: '🏃',
  e_lifter: '🏋️',
  e_thrower: '🤾',
  e_pan: '🍳',
  e_baby: '👶',
  e_toddler: '🧒',
  e_elite: '😈',
  e_brute: '👹',
  e_tesha: '👵',
  e_kiss: '💋',
  e_rose: '🌹',
  e_slipper: '🩴',
  e_borscht: '🍲',
  e_megaphone: '📣',
  e_chicken: '🍗',
  e_magnet: '🧲',
  e_gift: '🎁',
  e_heart: '❤️',
  e_hearts: '💞',
  e_lasso: '💘',
  e_dizzy: '💫',
  e_zzz: '💤',
  e_bush: '🌳',
  e_firework: '🎆',
  e_baby_bottle: '🍼',
  // апгрейды
  e_sneakers: '👟',
  e_vitamins: '💊',
  e_protein: '💪',
  e_coffee: '☕',
  e_cold: '🧊',
  e_vest: '🦺',
  e_broccoli: '🥦',
  e_luck: '🍀',
  e_magnet2: '🧲',
  e_skull: '💀',
  e_trophy: '🏆',
  e_thermo: '🌡️',
  // декор
  d_tree: '🌳',
  d_tree2: '🌲',
  d_flower: '🌷',
  d_sun: '🌻',
  d_rock: '🪨',
  d_mush: '🍄',
  d_sign: '🚏',
  d_cart: '🛒',
  d_hen: '🐓',
  d_bush: '🌿',
};

function makeEmoji(scene: Phaser.Scene, key: string, ch: string, size = 64) {
  const tex = scene.textures.createCanvas(key, size, size);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, size, size);
  ctx.font = `${Math.floor(size * 0.78)}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, size / 2, size / 2 + size * 0.05);
  tex.refresh();
}

export function buildTextures(scene: Phaser.Scene) {
  for (const [k, ch] of Object.entries(EMOJI)) {
    const size = k === 'e_bush' || k === 'e_hearts' || k === 'e_heart' ? 128 : 64;
    makeEmoji(scene, k, ch, size);
  }

  // трава
  {
    const s = 256;
    const tex = scene.textures.createCanvas('ground', s, s)!;
    const c = tex.getContext();
    c.fillStyle = '#5b9a45';
    c.fillRect(0, 0, s, s);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 420; i++) {
      const x = rnd() * s,
        y = rnd() * s;
      c.fillStyle = rnd() > 0.5 ? '#52903d' : '#67a84f';
      c.fillRect(x, y, 2 + rnd() * 3, 2 + rnd() * 5);
    }
    for (let i = 0; i < 26; i++) {
      const x = rnd() * s,
        y = rnd() * s;
      c.fillStyle = ['#f7e26b', '#fff', '#f4a6c8'][i % 3];
      c.fillRect(x, y, 3, 3);
    }
    tex.refresh();
  }

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const gen = (key: string, w: number, h: number, draw: () => void) => {
    g.clear();
    draw();
    g.generateTexture(key, w, h);
  };

  gen('gem1', 14, 14, () => {
    g.fillStyle(0x3fc1ff).fillPoints([new Phaser.Geom.Point(7, 0), new Phaser.Geom.Point(14, 7), new Phaser.Geom.Point(7, 14), new Phaser.Geom.Point(0, 7)], true);
    g.fillStyle(0xbdeaff).fillTriangle(7, 2, 11, 7, 7, 7);
  });
  gen('gem2', 16, 16, () => {
    g.fillStyle(0x4cd964).fillPoints([new Phaser.Geom.Point(8, 0), new Phaser.Geom.Point(16, 8), new Phaser.Geom.Point(8, 16), new Phaser.Geom.Point(0, 8)], true);
    g.fillStyle(0xc9ffd1).fillTriangle(8, 2, 12, 8, 8, 8);
  });
  gen('gem3', 20, 20, () => {
    g.fillStyle(0xff4d6d).fillPoints([new Phaser.Geom.Point(10, 0), new Phaser.Geom.Point(20, 10), new Phaser.Geom.Point(10, 20), new Phaser.Geom.Point(0, 10)], true);
    g.fillStyle(0xffc2cd).fillTriangle(10, 3, 15, 10, 10, 10);
  });
  gen('puff', 16, 16, () => {
    g.fillStyle(0xffffff).fillCircle(8, 8, 8);
  });
  gen('pool', 128, 128, () => {
    g.fillStyle(0xd7261e, 0.5).fillCircle(64, 64, 62);
    g.fillStyle(0xff7a2f, 0.5).fillCircle(64, 64, 48);
    g.lineStyle(3, 0x8a1010, 0.7).strokeCircle(64, 64, 62);
  });
  gen('shadow', 32, 12, () => {
    g.fillStyle(0x000000, 0.28).fillEllipse(16, 6, 30, 10);
  });
  g.destroy();

  // мягкая аура
  {
    const s = 128;
    const tex = scene.textures.createCanvas('aura', s, s)!;
    const c = tex.getContext();
    const grd = c.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,0.75)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = grd;
    c.fillRect(0, 0, s, s);
    tex.refresh();
  }
}
