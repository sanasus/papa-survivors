import type { PassiveId, WeaponId } from './types';

export interface UpDef {
  id: WeaponId | PassiveId;
  kind: 'weapon' | 'passive';
  name: string;
  tex: string;
  max: number;
  desc: (lv: number) => string; // что даёт уровень lv
}

// Параметры оружия по уровню (используются и в weapons.ts, и в описаниях)
export const WP = {
  kiss: (lv: number) => ({
    count: [1, 2, 2, 3, 3, 4][lv - 1],
    dmg: 12 * (1 + 0.2 * (lv - 1)),
    cd: 0.55 * Math.pow(0.93, lv - 1),
    pierce: lv >= 6 ? 2 : lv >= 4 ? 1 : 0,
    speed: 560,
    range: 520,
  }),
  rose: (lv: number) => ({
    count: lv + 1,
    dmg: 7 * (1 + 0.22 * (lv - 1)),
    radius: 66 + 7 * lv,
    rot: 2.7 + 0.12 * lv,
  }),
  slipper: (lv: number) => ({
    count: lv >= 6 ? 3 : lv >= 3 ? 2 : 1,
    dmg: 20 * (1 + 0.28 * (lv - 1)),
    cd: 2.5 * Math.pow(0.92, lv - 1),
    dist: 260 + 22 * lv,
    scale: 1 + 0.08 * lv,
  }),
  borscht: (lv: number) => ({
    count: 1 + Math.floor((lv - 1) / 2),
    radius: 52 + 7 * lv,
    dur: 3 + 0.4 * lv,
    dps: 15 * (1 + 0.3 * (lv - 1)),
    cd: 4.2 * Math.pow(0.92, lv - 1),
  }),
  megaphone: (lv: number) => ({
    radius: 150 + 24 * lv,
    dmg: 12 + 9 * lv,
    cd: 8 * Math.pow(0.9, lv - 1),
    stun: 1.8,
  }),
};

export const UPGRADES: UpDef[] = [
  {
    id: 'kiss', kind: 'weapon', name: 'Воздушный поцелуй', tex: 'e_kiss', max: 6,
    desc: (lv) => ['Стреляет в ближайшую цель. Женщин — отшивает, детей — бьёт', '+1 поцелуй', '+20% урона', '+1 пробитие, +1 поцелуй', 'Стреляет чаще', '+1 поцелуй, ещё +1 пробитие'][lv - 1],
  },
  {
    id: 'rose', kind: 'weapon', name: 'Букет роз', tex: 'e_rose', max: 6,
    desc: (lv) => (lv === 1 ? 'Розы вращаются вокруг: колют детей, отгоняют женщин' : '+1 роза, шире и сильнее'),
  },
  {
    id: 'slipper', kind: 'weapon', name: 'Мамин тапок', tex: 'e_slipper', max: 6,
    desc: (lv) => ['Тапок летит и возвращается. Пробивает всех', 'Больше урона и дальность', '+1 тапок', 'Чаще и дальше', 'Ещё больнее', '+1 тапок (всего 3)'][lv - 1],
  },
  {
    id: 'borscht', kind: 'weapon', name: 'Бабушкин борщ', tex: 'e_borscht', max: 6,
    desc: (lv) => (lv === 1 ? 'Лужи борща жгут врагов под ногами' : lv % 2 === 1 ? '+1 лужа' : 'Больше, дольше и жарче'),
  },
  {
    id: 'megaphone', kind: 'weapon', name: 'Мегафон «Тихо!»', tex: 'e_megaphone', max: 6,
    desc: (lv) => (lv === 1 ? 'Волна крика: отбрасывает всех, женщин надолго оглушает' : 'Шире, громче, чаще'),
  },
  { id: 'sneakers', kind: 'passive', name: 'Кроссовки', tex: 'e_sneakers', max: 5, desc: () => '+7% скорости бега' },
  { id: 'vitamins', kind: 'passive', name: 'Витамины', tex: 'e_vitamins', max: 5, desc: () => '+20 макс. здоровья и лечение' },
  { id: 'magnet', kind: 'passive', name: 'Магнит', tex: 'e_magnet2', max: 5, desc: () => '+35% радиус подбора опыта' },
  { id: 'protein', kind: 'passive', name: 'Протеин', tex: 'e_protein', max: 5, desc: () => '+12% общего урона' },
  { id: 'coffee', kind: 'passive', name: 'Кофе', tex: 'e_coffee', max: 5, desc: () => '−7% перезарядки всего оружия' },
  { id: 'cold', kind: 'passive', name: 'Холодная голова', tex: 'e_cold', max: 5, desc: () => 'Пылкость растёт на 9% медленнее' },
  { id: 'vest', kind: 'passive', name: 'Бронежилет', tex: 'e_vest', max: 4, desc: () => '−1 к получаемому урону' },
  { id: 'broccoli', kind: 'passive', name: 'Брокколи', tex: 'e_broccoli', max: 5, desc: () => '+0.5 здоровья в секунду' },
  { id: 'luck', kind: 'passive', name: 'Удача', tex: 'e_luck', max: 4, desc: () => '+25% к шансу подарков и еды' },
];

export const UP_BY_ID: Record<string, UpDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
