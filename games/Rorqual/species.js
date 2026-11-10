// クジラの種ごとの姿。体の輪郭（whale.js の PROFILE）は体長 8m のミンクを基準に作り、
// ほかの種は体長の比（S = length / 8）で丸ごと拡大して使う。動き・カメラ・えさの大きさ感もこの S から決める
//   length   : 体長（m）
//   slim     : 太さの倍率（1 がミンク。細長い種は 1 より小さく）
//   headWide : 頭の横幅の倍率（シロナガスは上から見て U 字の幅広い頭）
//   colors   : 背・脇・腹・体側の模様の色
//   patches  : 体側の明るい模様（ミンク）を描くか
//   mottle   : まだら模様の強さ（シロナガスの青灰色のまだら）
//   pecBand  : 胸びれの白い帯（北半球のミンク）
//   dorsalU / dorsalSize : 背びれの位置（吻端からの割合）と大きさの倍率
//   taperX / taperY : 横幅（上から見た太さ）・高さ（横から見た太さ）に掛ける倍率の表 [吻端からの位置, 倍率]（省略すると 1）
//   deep     : 高さ全体の倍率
//   straightJaw : 上あご（頭の上の輪郭）をまっすぐにする
//   jawU     : 下あごの付け根の位置（口の大きさ。ミンクは 0.2）
//   splash   : 鼻（噴気孔の前の盛り上がり）の大きさの倍率
//   speckle  : 白っぽい細かい斑点の多さ
//   jawOut   : 下あごが上あごより前に出る量（m、8m 基準。ミンクは 0.06）
//   finFlank : ひれを背ではなく脇腹の色にする（明るい色の種）
//   jawMax   : 下あごが開く最大角（rad。省略すると約 86°）、pouch: 喉の袋の膨らみの倍率
//   eye      : 目の大きさの倍率（8m 基準の大きさに対して）
//   ridges3  : ニタリクジラ特有の「頭部上面の3本の明瞭な隆起線（主稜1本＋副稜2本）」
//   asymmetricJaw : ナガスクジラ特有の「下あごとクジラ髭の左右非対称（右白・左暗色）」
//   uShapeHead    : シロナガスクジラ特有の「上から見て幅広いU字型の巨大な口蓋・頭部」
export const SPECIES = {
  minke: {
    length: 8, slim: 1, headWide: 1,
    colors: { back: 0x2b3239, flank: 0x66717b, belly: 0xe4eaec, patch: 0xa9b2b8 },
    patches: true, mottle: 0, pecBand: true, dorsalU: 0.69, dorsalSize: 1,
  },
  antarctic_minke: {
    length: 9, slim: 1, headWide: 1,
    colors: { back: 0x2f363e, flank: 0x6a737c, belly: 0xdfe5e7, patch: 0x9aa3a9 },
    patches: true, mottle: 0, pecBand: false, dorsalU: 0.69, dorsalSize: 1,
  },
  // ニタリクジラ：温帯〜熱帯の暖かい海にすむ。
  // 最大の特徴：頭部上面に【3本の明瞭な隆起線】（主稜1本＋副稜2本）、高く立ち上がり鎌形に反り返る背びれ
  bryde: {
    length: 14, slim: 0.94, headWide: 1.08,
    colors: { back: 0x242a30, flank: 0x525b63, belly: 0xdde3e6, patch: 0x889299 },
    patches: false, mottle: 0, pecBand: false,
    dorsalU: 0.68, dorsalSize: 1.35, // ひときわ高く立ち上がる美しい鎌形背びれ
    ridges3: true, // 頭部上面の3本の隆起線！
  },
  // ナガスクジラ：「海のグレイハウンド」と呼ばれる世界第2位の巨躯（22m）。
  // 最大の特徴：極めて細長い流線型シルエット、そして脊椎動物屈指の【左右非対称な体色】（右下顎が純白、左下顎が暗色）
  fin: {
    length: 22, slim: 0.86, headWide: 1.05, deep: 0.72,
    taperX: [[0.35, 0.9], [0.55, 0.82], [0.75, 0.72], [1, 0.65]],
    colors: { back: 0x262c33, flank: 0x58626c, belly: 0xf0f5f8, patch: 0x98a2aa },
    patches: false, mottle: 0.04, pecBand: false,
    dorsalU: 0.75, dorsalSize: 0.58, // 後方に位置する鋭く小さな背びれ
    asymmetricJaw: true, // 左右非対称な色彩（右白・左暗色）！
  },
  // シロナガスクジラ：地球上最大の動物（24m）。
  // 最大の特徴：上から見て【巨大なU字型（ヘラ状）の幅広い頭部】、青灰色のまだら模様、極小の背びれ
  blue: {
    length: 24, slim: 1, headWide: 1.38, deep: 0.66,
    uShapeHead: true, // 上から見て幅広いU字型の巨大な口蓋・頭部！
    taperX: [[0.35, 0.8], [0.5, 0.66], [0.6, 0.56], [0.7, 0.5], [0.8, 0.45], [0.9, 0.52], [1, 0.6]],
    taperY: [[0.6, 1], [0.75, 1.08], [0.88, 1.15], [1, 1.1]],
    straightJaw: true, jawU: 0.17, splash: 2.2, jawOut: 0, finFlank: true,
    pouch: 0.7,
    eye: 0.4,
    colors: { back: 0x44698a, flank: 0x5a7fa0, belly: 0x7896ae, patch: 0x8ea3b1 },
    patches: false, mottle: 0.12, speckle: 0.20, speckleMix: 0.35, pecBand: false,
    dorsalU: 0.78, dorsalSize: 0.38,
  },
};

// カメラの引き具合の指数。1 なら画面上の大きさはどの種も同じ。小さいほど大きい種が画面上で大きく映る
// （0.8 なら、体長 3 倍のシロナガスが画面上でミンクの約 1.25 倍）
export const VIEW_EXP = 0.8;
// 速さ（m/s）の倍率の指数。小さいほど大きい種がのっそり動く
// （0.1 なら、シロナガスの速さはミンクの約 1.1 倍。カメラを引いている分、画面の上では約 0.45 倍）
export const SPEED_EXP = 0.1;

// 体長の比 S と、カメラの引き具合 V。V は S より気持ち小さく（大きい種ほど画面上でも少し大きく映る）
export function scalesOf(sp) {
  const S = sp.length / 8;
  // T: 動きのゆっくりさ。体長に比例（シロナガスは尾を振るリズムも突進の段取りもミンクの 3 倍ゆっくり）
  return { S, V: Math.pow(S, VIEW_EXP), T: S, P: Math.pow(S, SPEED_EXP) }; // P: 速さの倍率
}
