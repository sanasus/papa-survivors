// Весь баланс игры живёт здесь. Крутить числа — только в этом файле.

// Множители для живой настройки баланса из консоли: window.__tune.rate = 1.3
export const TUNE = { rate: 1, hHp: 1, hDmg: 1, kidHp: 1, kidDmg: 1, kidSpd: 1, xp: 1, gauge: 1, birth: 1, bossHp: 1, playerDmg: 1, womenSpd: 1, hXp: 1, kidXp: 1, bossKid: 1 };
(window as unknown as { __tune: typeof TUNE; __tuneDefaults: typeof TUNE }).__tune = TUNE;
(window as unknown as { __tuneDefaults: typeof TUNE }).__tuneDefaults = { ...TUNE };

export type DiffKey = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: Record<DiffKey, { name: string; desc: string; tune: Partial<typeof TUNE> }> = {
  easy: { name: 'Лёгкая', desc: 'Для отдыха и смеха', tune: { hHp: 0.8, rate: 0.8, hDmg: 0.75, kidHp: 0.85, kidDmg: 0.75, playerDmg: 1.15, gauge: 1.2, xp: 0.9 } },
  normal: { name: 'Нормальная', desc: 'Как задумано', tune: {} },
  hard: { name: 'Жёсткая', desc: 'Алименты, ипотека, тёща', tune: { hHp: 1.25, rate: 1.2, hDmg: 1.25, kidHp: 1.2, kidDmg: 1.2, gauge: 0.88, bossHp: 1.3 } },
};
export function applyDifficulty(key: DiffKey) {
  Object.assign(TUNE, (window as unknown as { __tuneDefaults: typeof TUNE }).__tuneDefaults, DIFFICULTIES[key].tune);
}
export function loadDifficulty(): DiffKey {
  try {
    const v = localStorage.getItem('papa_diff') as DiffKey | null;
    if (v && v in DIFFICULTIES) return v;
  } catch {
    /* нет localStorage */
  }
  return 'normal';
}

export const W = 1280;
export const H = 720;
export const WORLD = 3200;
export const RUN_TIME = 300; // секунд до финального босса

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const PLAYER = {
  hp: 100,
  speed: 205,
  r: 11,
  hurtIframes: 0.12, // общая неуязвимость после удара
  busyDamageMul: 0.6, // во время "сцены" урон слегка смягчён
  pickupRadius: 105,
};

// ---------- Шкала возбуждения ("Пылкость") ----------
export const GAUGE = {
  start: 30, // стартовое значение, %
  fillFrom: 34, // сек до полного заполнения в начале
  fillTo: 18, // ...и в конце забега (шкала чуть ускоряется)
};
export const fillTime = (t: number) => lerp(GAUGE.fillFrom, GAUGE.fillTo, clamp(t / RUN_TIME, 0, 1)) * TUNE.gauge;

// ---------- Женщины ----------
export const WOMAN = {
  r: 13,
  speed: 90,
  speedGrow: 0.06, // + к скорости за секунду забега
  chosenSpeed: 600, // «лассо любви» — тянет без ограничений
  fleeSpeed: 150,
  stun: 1.0,
  knock: 470,
  restTime: 2.6, // отдых после родов
  contactTime: 0.95, // длительность комедийной «сцены»
};
// Сколько женщин всего держим на карте
export const womenWanted = (t: number) => Math.min(9, 4 + Math.floor(t / 55));
export const MIN_FREE_WOMEN = 2; // свободных (не беременных) всегда не меньше
export const MAX_WOMEN = 14;

// Задержка до родов; сокращается с каждыми родами конкретной матери
export const birthDelay = (n: number) => Math.max(4.5, 20 * Math.pow(0.82, n - 1)) * TUNE.birth;

// ---------- Дети ----------
export interface KidStats {
  tier: 1 | 2 | 3; // 1 обычный, 2 элитка, 3 босс
  sub: 'baby' | 'toddler' | 'elite' | 'brute';
  hp: number;
  dmg: number;
  spd: number;
  r: number;
  xp: number;
}
export function kidStats(n: number, t: number): KidStats {
  const nn = Math.min(n, 10);
  const tier = nn >= 5 ? 3 : nn >= 3 ? 2 : 1;
  const base = 16 * Math.pow(1.7, nn - 1) * (1 + t / 700);
  const hpMul = tier === 3 ? 7.2 * TUNE.bossKid : tier === 2 ? 1.7 : 1;
  const sub = tier === 3 ? 'brute' : tier === 2 ? 'elite' : nn === 1 ? 'baby' : 'toddler';
  return {
    tier,
    sub,
    hp: base * hpMul * TUNE.kidHp,
    dmg: (5 + 3 * (nn - 1)) * TUNE.kidDmg,
    spd: Math.min(140, 60 + 7 * nn) * TUNE.kidSpd,
    r: tier === 3 ? 30 : tier === 2 ? 17 : nn === 1 ? 10 : 12,
    xp: 4 * Math.pow(1.4, nn - 1) * (tier === 3 ? 3.5 : tier === 2 ? 1.5 : 1) * TUNE.kidXp,
  };
}
export const GIFT_CHANCE = { 1: 0.08, 2: 0.4, 3: 1 } as const; // шанс «улучшения» с ребёнка
export const KID_ATTACK_CD = 0.8;

// ---------- Мужья (фоновая орда) ----------
export const HUSBANDS = {
  basic: { tex: 'e_angry', hp: 1, spd: 1, dmg: 1, r: 11, xp: 1.05, from: 0, w: 10 },
  runner: { tex: 'e_runner', hp: 0.55, spd: 1.65, dmg: 0.8, r: 10, xp: 1.05, from: 35, w: 4 },
  tank: { tex: 'e_lifter', hp: 4.5, spd: 0.75, dmg: 1.6, r: 17, xp: 4.5, from: 85, w: 2.5 },
  thrower: { tex: 'e_thrower', hp: 0.8, spd: 0.9, dmg: 1, r: 11, xp: 1.5, from: 100, w: 3 }, // кидает сковородки
} as const;
export type HusbandKind = keyof typeof HUSBANDS;
export const husbandHp = (t: number) => 13.4 * Math.pow(1 + t / 100, 1.15) * TUNE.hHp;
export const husbandDmg = (t: number) => (5 + t / 40) * 1.15 * TUNE.hDmg;
export const husbandSpeed = (t: number) => 80 + t * 0.11;
export const husbandRate = (t: number) => (0.9 + 6.5 * Math.pow(clamp(t / RUN_TIME, 0, 1.3), 1.25)) * TUNE.rate; // шт/сек
export const MAX_ENEMIES = 230;

// Волны-кольца: [время, число мужей]
export const RING_WAVES: [number, number][] = [
  [55, 18],
  [115, 28],
  [175, 38],
  [235, 48],
];

// ---------- Опыт ----------
export const xpNeed = (level: number) => Math.round((3 + 2.2 * Math.pow(level - 1, 1.2)) * TUNE.xp);

// ---------- Финальный босс ----------
export const FINAL_BOSS = {
  get hp() {
    return 5200 * TUNE.bossHp;
  },
  r: 62,
  spd: 52,
  dmg: 18,
  ringEvery: 5.5,
  ringEveryEnraged: 3.2,
  summonEvery: 11,
  shotDmg: 9,
};

// ---------- Подбираемое ----------
export const PICKUPS = {
  healAmount: 30,
  healChanceHusband: 0.012,
  healChanceKid: 0.05,
};

export const NAMES = [
  'Люда', 'Света', 'Оксана', 'Галя', 'Ира', 'Зина', 'Таня', 'Лена', 'Нинель', 'Клава',
  'Марина', 'Рита', 'Алла', 'Жанна', 'Вика', 'Яна', 'Тамара', 'Кристина', 'Лариса', 'Эльвира',
];

export const WOMAN_TEX = ['e_w1', 'e_w2', 'e_w3', 'e_w4', 'e_w5', 'e_w6'];

export const WOMAN_FLIRT = ['Привет, красавчик!', 'Ну наконец-то!', 'Ты — мой тип!', 'Идём, покажу кое-что!', 'Я уже еду!', 'Какой мужчина!'];
export const WOMAN_REJECT = ['Хам!', 'Ну и ладно!', 'Я обиделась!', 'Невежа!', 'Я всё маме расскажу!', 'Ай!'];
export const WOMAN_PREG = ['Ой, кажется, я беременна!', 'Это не мой ребёнок… ладно, мой.', 'Я пошла за хлебом!', 'Пойду-ка прилягу.', 'УЗИ, срочно!'];
export const BIRTH_LINES = ['Уа-а-а!', 'Привет, папа!', 'Угу-гу!', 'Мама, я здесь!', 'Алименты!'];
export const CONTACT_LINES = [
  '*тут могла быть ваша реклама*',
  '«Я быстро»  — Классика жанра',
  '*камера отвернулась*',
  'Занавес! Цензура! Бдительность!',
  '*за кадром играет саксофон*',
  'Здесь ничего не было. Совсем.',
];
