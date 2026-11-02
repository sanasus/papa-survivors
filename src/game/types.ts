import Phaser from 'phaser';

export type Img = Phaser.GameObjects.Image;
export type Txt = Phaser.GameObjects.Text;

export interface Woman {
  id: number;
  name: string;
  tex: string;
  births: number; // сколько раз уже беременела (и сколько родов будет/было)
  state: 'run' | 'preg' | 'rest' | 'busy';
  x: number;
  y: number;
  vx: number; // «отшивающий» импульс
  vy: number;
  r: number;
  stun: number;
  timer: number; // до родов (preg) / до конца отдыха (rest)
  timerMax: number;
  destX: number;
  destY: number;
  wobble: number;
  bubbleCd: number;
  spr: Img;
  status: Img;
  label: Txt;
}

export type EnemyKind = 'husband' | 'kid' | 'final';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  sub: string;
  tier: number; // для детей 1..3
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  spd: number;
  dmg: number;
  xp: number;
  atk: number; // откат атаки
  flash: number;
  dead: boolean;
  spr: Img;
  aura?: Img;
  label?: Txt;
  n: number; // номер родов матери (для детей)
  t1: number; // таймеры спец.способностей
  t2: number;
  t3: number;
  state: number; // 0 — идёт; 1 — телеграф; 2 — рывок
  dx: number; // направление рывка
  dy: number;
  hitRose: number;
  hitSlip: number;
  phase: number;
  bs: number; // базовый масштаб спрайта
  tinted: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  pierce: number;
  life: number;
  spr: Img;
  hit: Set<number>;
  dead: boolean;
}

export interface EShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  spr: Img;
  dead: boolean;
}

export interface Gem {
  x: number;
  y: number;
  v: number;
  spr: Img;
  pulled: boolean;
  dead: boolean;
}

export type PickupKind = 'heal' | 'magnet' | 'gift';
export interface Pickup {
  x: number;
  y: number;
  kind: PickupKind;
  spr: Img;
  life: number;
  dead: boolean;
}

export interface Pool {
  x: number;
  y: number;
  r: number;
  life: number;
  dps: number;
  tick: number;
  spr: Img;
}

export interface Slipper {
  x: number;
  y: number;
  dx: number;
  dy: number;
  t: number;
  out: number; // время «туда»
  dist: number;
  dmg: number;
  spr: Img;
  returning: boolean;
  hit: Map<number, number>;
  dead: boolean;
}

export type WeaponId = 'kiss' | 'rose' | 'slipper' | 'borscht' | 'megaphone';
export type PassiveId = 'sneakers' | 'vitamins' | 'magnet' | 'protein' | 'coffee' | 'cold' | 'vest' | 'broccoli' | 'luck';

export interface WeaponState {
  lv: number;
  t: number;
  roses?: Img[];
  angle?: number;
}
