// 海域の設定。ここに足していけば、ステージ選択・クリア・次の海域がそのまま増える
//   fog       : 海の色（霧と背景）
//   deep      : 水面を上から見たときの色、sky: 水面に映る空の色
//   snow      : マリンスノーの色
//   food      : 代表えさ（後方互換用）
//   foods     : 海域に出現するえさ（小魚・オキアミ）の組み合わせリスト
//   creatures : 海域に出現するゲストNPC（ザトウクジラ、サメ、ウミガメ、マンボウ）の組み合わせリスト
//   dolphins  : 高速遊泳時にカマイルカが並走するか
//   whale     : 主役のクジラ（図鑑の項目 id）
//   murk      : 海の濁り（霧の濃さ）、wave: 波の荒さ（1 が基準）、shafts: 上から差す光の筋の強さ
export const AREAS = [
  {
    id: 'okhotsk',
    fog: 0x24504f, deep: 0x2c6f6a, sky: 0xc4dde2, snow: 0xcfe6dc,
    food: 'sandlance', foodColor: 0xd4dde0,
    foods: ['sandlance', 'capelin', 'herring', 'sandlance', 'capelin'],
    creatures: ['humpback', 'sunfish', 'sunfish', 'turtle'],
    dolphins: true,
    whale: 'minke',
    murk: 0.018, wave: 1.0, shafts: 0.07, // 濁った灰緑の海、穏やか
  },
  {
    id: 'tosa',
    fog: 0x16466b, deep: 0x1d5d8f, sky: 0xd6eefc, snow: 0xdceefa,
    food: 'anchovy', foodColor: 0x82b4d6,
    foods: ['anchovy', 'sardine', 'mackerel', 'anchovy', 'sardine'],
    creatures: ['turtle', 'turtle', 'sunfish', 'sunfish', 'shark'],
    dolphins: true,
    whale: 'bryde',
    murk: 0.014, wave: 1.2, shafts: 0.14, // 黒潮の暖かいコバルトブルー、強い陽光
  },
  {
    id: 'north_atlantic',
    fog: 0x1a3a4f, deep: 0x224f6c, sky: 0xcce0ea, snow: 0xd0e2ec,
    food: 'herring', foodColor: 0x95b2c9,
    foods: ['herring', 'capelin', 'mackerel', 'sandlance', 'herring'],
    creatures: ['humpback', 'shark', 'shark', 'turtle', 'sunfish'],
    dolphins: true,
    whale: 'fin',
    murk: 0.016, wave: 1.8, shafts: 0.09, // 北大西洋の冷たい群青、力強い波
  },
  {
    id: 'antarctic',
    fog: 0x234e66, deep: 0x2d6788, sky: 0xe2edf3, snow: 0xe6f0f4,
    food: 'krill', foodColor: 0xe8a596,
    foods: ['krill', 'krill', 'lanternfish', 'krill', 'lanternfish'],
    creatures: ['humpback', 'humpback', 'shark'],
    dolphins: false,
    whale: 'blue',
    murk: 0.013, wave: 1.6, shafts: 0.11, // 澄んだ冷たい海、波は荒め、光がよく差す
  },
];

// 図鑑に載る生き物の並び順
export const DEX = [
  'minke', 'antarctic_minke', 'bryde', 'fin', 'blue',
  'humpback', 'dolphin', 'shark', 'turtle', 'sunfish', 'shearwater',
  'sandlance', 'capelin', 'herring', 'anchovy', 'sardine', 'mackerel', 'lanternfish', 'krill',
];

export const areaById = (id) => AREAS.find((a) => a.id === id) ?? AREAS[0];
export const nextArea = (id) => AREAS[AREAS.findIndex((a) => a.id === id) + 1] ?? null;
