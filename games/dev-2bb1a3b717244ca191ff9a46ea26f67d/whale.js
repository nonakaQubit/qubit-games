import * as THREE from 'three';
import { scalesOf } from './species.js?v=20261107_v21';

// 体の太さ：吻端からの位置 u (0..1) → 半径（m、体長 8m 想定）
// 参考：野中さんにもらったミンクのイラストの輪郭を測った値。とがった頭から胸びれのあたりまでで太くなり、
// 胸びれ〜背びれの手前までほぼ同じ太さ（最大の高さは体長の約 1/6）。背びれの後ろからなだらかに細くなる
const PROFILE = [
  [0.00, 0.02], [0.055, 0.18], [0.11, 0.34], [0.18, 0.50], [0.25, 0.59], [0.32, 0.64],
  [0.455, 0.67], [0.59, 0.64], [0.70, 0.54], [0.80, 0.39], [0.87, 0.25], [0.94, 0.16], [1.00, 0.12],
];
// 体軸の高さ：吻はやや下、体の中ほどから背びれまでは少し上、尾に向かってまた下がる
const CENTER = [[0.00, 0.0], [0.11, 0.12], [0.25, 0.18], [0.45, 0.20], [0.60, 0.24], [0.70, 0.24], [0.80, 0.18], [0.87, 0.10], [1.00, 0.0]];

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// 表の点を通るなめらかな曲線（単調 3 次エルミート補間 / Fritsch–Carlson 法）。
// table: [[u, 値1, 値2, ...], ...]（u は小さい順）。返す関数は u → [値1, 値2, ...]
// 単調に増える・減る区間では値が表の範囲を飛び出さないので、輪郭にこぶや凹みができない
function makeCurve(table) {
  const n = table.length, cols = table[0].length - 1;
  const xs = table.map((r) => r[0]);
  const slopes = [];
  for (let c = 0; c < cols; c++) {
    const ys = table.map((r) => r[c + 1]);
    const d = [];
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    const m = new Array(n);
    m[0] = d[0];
    m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
    }
    slopes.push(m);
  }
  return (u) => {
    u = Math.min(xs[n - 1], Math.max(xs[0], u));
    let i = 0;
    while (i < n - 2 && u > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (u - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    const out = [];
    for (let c = 0; c < cols; c++) {
      const m = slopes[c];
      out.push(h00 * table[i][c + 1] + h10 * h * m[i] + h01 * table[i + 1][c + 1] + h11 * h * m[i + 1]);
    }
    return out;
  };
}

// 輪郭の表の補間。もとは表の点どうしを smoothstep でつないでいたが、表の点ごとに傾きが 0 になって
// 輪郭が段々になるので、表の点を通る単調 3 次曲線に替えた（Claude、2026-11-09）。表ごとに一度だけ作って覚えておく
const _curveCache = new WeakMap();
function lookup(table, u) {
  let f = _curveCache.get(table);
  if (!f) { f = makeCurve(table); _curveCache.set(table, f); }
  return f(u)[0];
}
// 頭（u < 0.25）はべき乗の曲線にして、口先を丸くする（先端で輪郭が縦に立ち上がる）
const HEAD_U = 0.25, HEAD_P = 0.55;
const radiusAt = (u, sp) => {
  const hp = sp?.uShapeHead ? 0.30 : HEAD_P;
  return (u < HEAD_U ? lookup(PROFILE, HEAD_U) * Math.pow(u / HEAD_U, hp) : lookup(PROFILE, u));
};
const centerAt = (u) => lookup(CENTER, u);

const FOLLOW = 1.0;     // 後ろ半分が頭の道すじをなぞる割合（1 で完全になぞる、0 でまっすぐの棒）
const MAX_TILT = Math.PI / 4; // 一つの断面が傾く角度の上限（45°）
const PIVOT_U = 0.42;   // 体の中心（group の原点）の位置。zAt(PIVOT_U) = 0
const JAW_MAX = 1.5;    // 下あごが開く最大角（rad、約 86°。ナガス系はほぼ直角まで開く）。種ごとに jawMax で変えられる
const DASH_AMP = 1.1;     // ダッシュのひと振りで尾の先が振れる量（m）
const DASH_PERIOD = 1.0;  // そのひと振りの周期（秒）
const POUCH_U = 0.47;   // 喉のひだ（膨らむ袋）の後ろの端。体長の 47%
const POUCH_DROP = 1.3; // 袋が膨らみきったときに下へふくらむ量（m）


// クジラ。形は体長 8m の基準で作り、種の体長の比 S で group ごと拡大する（ローカル座標は 8m 基準のまま）
export class Whale {
  constructor({ species, rings = 56, segs = 32 }) {
    this.length = 8;
    this.rings = rings;
    this.segs = segs;
    this.phase = 0;
    this.waveK = 4.5;       // 体を伝わる波のずれ（頭側と尾の先の位相差、rad）
    this.dashT = -1;        // ダッシュのひと振りの経過時間（-1 は振っていない）
    this.pouchBonus = 0;    // たくさん食べたときに袋が余分に膨らむ割合
    this.group = new THREE.Group();
    this.group.rotation.order = 'YXZ';

    // 曲がるとき：頭は言われた向きへ、後ろ半分は頭が通った道すじをなぞる
    this.trail = [];                       // 体の中心（group の原点）が通った位置（ワールド座標）、新しい順
    this.setSpecies(species);
    const R = rings + 1;
    this.ringPX = new Float32Array(R); this.ringPZ = new Float32Array(R);
    this.ringC = new Float32Array(R); this.ringS = new Float32Array(R);
  }

  // 種を切り替える：形・色・ひれを作り直し、体長に合わせて拡大する
  setSpecies(sp) {
    this.sp = sp;
    this.jawU = sp.jawU ?? 0.2; // 下あごの付け根（吻端からの位置）。口の大きさ
    Object.assign(this, scalesOf(sp));
    this.col = Object.fromEntries(Object.entries(sp.colors).map(([k, v]) => [k, new THREE.Color(v)]));
    [...this.group.children].forEach((o) => { this.group.remove(o); o.geometry?.dispose(); });
    this.group.traverse((o) => o.geometry?.dispose());
    this._buildBody();
    this._buildFins();
    this.group.scale.setScalar(this.S);
    this.trail.length = 0;
    this.dashT = -1;
  }

  // 体の太さ（ローカル座標）。種の太さの倍率を掛ける
  rAt(u) { return radiusAt(u, this.sp) * this.sp.slim; }
  // 横幅（上から見た太さ）と高さ（横から見た太さ）を別々に絞れるようにする
  _tp(table, u) { return table ? lookup(table, Math.max(u, table[0][0])) : 1; }
  rX(u) { return this.rAt(u) * this._tp(this.sp.taperX, u); }
  rY(u) { return this.rAt(u) * (this.sp.deep ?? 1) * this._tp(this.sp.taperY, u); }
  _flat(u) { return 0.85 + 0.15 * smooth(0.0, 0.25, u); }
  // 体軸の高さ。上あごがまっすぐな種は、頭の上の輪郭が一直線になるよう、軸を下げる
  cyAt(u) {
    if (!this.sp.straightJaw || u >= 0.3) return centerAt(u);
    const top = (v) => centerAt(v) + this.rY(v) * this._flat(v);
    const t0 = top(0), t1 = top(0.3);
    return t0 + (t1 - t0) * (u / 0.3) - this.rY(u) * this._flat(u);
  }

  _updateTrail() {
    const p = this.group.position, t = this.trail;
    if (!t.length || Math.hypot(p.x - t[0].x, p.z - t[0].z) > 0.08 * this.S) t.unshift({ x: p.x, z: p.z });
    const need = (this.length * (1 - PIVOT_U) + 1) * this.S; // 道すじはワールド座標なので、体長の比を掛ける
    let len = 0;
    for (let i = 1; i < t.length; i++) {
      len += Math.hypot(t[i].x - t[i - 1].x, t[i].z - t[i - 1].z);
      if (len > need) { t.length = i + 1; break; }
    }
  }

  // 体の中心から後ろへ d m の、道すじ上の位置と向き（ローカル座標）。out = [x, z, θ]
  _trailFrame(d, out) {
    const p = this.group.position, yaw = this.group.rotation.y, t = this.trail;
    // d はローカル（8m 基準）の長さ。道すじはワールド座標なので、体長の比 S で行き来する
    let wx = p.x, wz = p.z, fx = Math.sin(yaw), fz = Math.cos(yaw), left = d * this.S;
    for (let i = 0; i < t.length && left > 0; i++) {
      const sx = wx - t[i].x, sz = wz - t[i].z, sl = Math.hypot(sx, sz);
      if (sl < 1e-4) continue;
      fx = sx / sl; fz = sz / sl;
      const k = Math.min(1, left / sl);
      wx -= sx * k; wz -= sz * k; left -= sl * k;
    }
    wx -= fx * left; wz -= fz * left; // 道すじが足りない分はまっすぐ伸ばす
    const dx = wx - p.x, dz = wz - p.z, c = Math.cos(yaw), s = Math.sin(yaw);
    out[0] = (dx * c - dz * s) / this.S;
    out[1] = (dx * s + dz * c) / this.S;
    let th = Math.atan2(fx, fz) - yaw;
    while (th > Math.PI) th -= Math.PI * 2;
    while (th < -Math.PI) th += Math.PI * 2;
    // 道すじをなぞる割合は FOLLOW。曲がりすぎは断面の傾きの上限 MAX_TILT で止める
    const z0 = this.zAt(PIVOT_U + d / this.length);
    out[0] *= FOLLOW;
    out[1] = z0 + (out[1] - z0) * FOLLOW;
    out[2] = Math.max(-MAX_TILT, Math.min(MAX_TILT, th * FOLLOW));
    return out;
  }

  // 吻端からの位置 u の体軸上の位置と向き（ローカル座標）。中心より前は頭と一緒にまっすぐ
  _frameAt(u, out) {
    if (u <= PIVOT_U) { out[0] = 0; out[1] = this.zAt(u); out[2] = 0; return out; }
    return this._trailFrame((u - PIVOT_U) * this.length, out);
  }

  // 吻端からの位置 u → 体軸上の z（前が +z）
  zAt(u) { return this.length * (0.42 - u); }

  // 体の断面は上半分と下半分を別の頂点列にしておき、下あごだけを開けられるようにする
  _buildBody() {
    const { rings, segs } = this;
    const H = segs / 2, cols = segs + 2;
    const n = (rings + 1) * cols;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    this.base = new Float32Array(n * 3);
    this.uArr = new Float32Array(n);
    this.nyArr = new Float32Array(n);
    this.lower = new Uint8Array(n);
    this.ring = new Uint16Array(n);
    this.ringBend = new Float32Array(rings + 1);
    this.ringCY = new Float32Array(rings + 1);
    // 輪の間隔は口先ほど細かく（丸い口先をなめらかに出すため）
    this.ringU = new Float32Array(rings + 1);
    this.ringR = new Float32Array(rings + 1);
    for (let i = 0; i <= rings; i++) this.ringU[i] = Math.pow(i / rings, 1.3);
    this.seamPairs = []; // あごより後ろでは、上下の継ぎ目の法線をそろえる
    const c = new THREE.Color();

    let k = 0;
    for (let i = 0; i <= rings; i++) {
      const u = this.ringU[i];
      const r = this.rAt(u), rx = this.rX(u), ry = this.rY(u);
      this.ringR[i] = ry;
      this.ringCY[i] = this.cyAt(u);
      // 頭の上は少し平たく、尾の付け根は左右に薄い
      const flatTop = this._flat(u);
      const wx = (1.0 - 0.35 * smooth(0.75, 0.97, u)) * (1 + (this.sp.headWide - 1) * (1 - smooth(0.12, 0.35, u)));
      if (u > this.jawU + 0.03) this.seamPairs.push(k, k + cols - 1, k + H, k + H + 1);
      for (let cc = 0; cc < cols; cc++) {
        const j = cc <= H ? cc : cc - 1;
        this.lower[k] = cc > H ? 1 : 0;
        this.ring[k] = i;
        const th = (j / segs) * Math.PI * 2;
        const ny = Math.sin(th);
        const x = rx * Math.cos(th) * wx;
        let y = ry * ny * (ny > 0 ? flatTop : 1.0);
        let z = this.zAt(u);
        if (ny > 0 && u < 0.22) {
          // 頭の上の真ん中を通る一本の稜線と、噴気孔の前の低い盛り上がり（スプラッシュガード）
          const top = Math.exp(-((th - Math.PI / 2) ** 2) / 0.04);
          const sg = this.sp.splash ?? 1; // 鼻（噴気孔の前の盛り上がり）の大きさ
          let ridgeH = r * top * (0.1 * (1 - smooth(0.12, 0.2, u)) + 0.12 * sg * Math.exp(-((u - 0.165) ** 2) / (0.0004 * sg)));
          // ニタリクジラ特有の3本の明瞭な隆起線（主稜1本＋両脇に平行する副稜2本）
          if (this.sp.ridges3 && u < 0.22) {
            const sideL = Math.exp(-((th - (Math.PI / 2 + 0.45)) ** 2) / 0.018);
            const sideR = Math.exp(-((th - (Math.PI / 2 - 0.45)) ** 2) / 0.018);
            ridgeH += r * (sideL + sideR) * 0.16 * (1 - smooth(0.14, 0.22, u));
          }
          y += ridgeH;
        }
        // 下あごは上あごより少し前に出ている
        if (cc > H) z += (this.sp.jawOut ?? 0.06) * (1 - smooth(0.0, 0.06, u));
        pos.set([x, y, z], k * 3);
        this.base.set([x, y, z], k * 3);
        this.uArr[k] = u;
        this.nyArr[k] = ny;

        // 背は暗い灰色、腹ははっきり白い（側面の淡い模様が浮いた島にならず、腹部の白さから連続して滑らかに立ち上がる構造）
        const C = this.col;
        const pt = this.sp.patches ? 1 : 0;
        // 胸びれ後方（u≈0.34）と後半部（u≈0.64）で、腹部の白〜淡色が脇腹へと波状にせり上がる
        const thoraxRise = pt * Math.sin(smooth(0.24, 0.36, u) * (1 - smooth(0.36, 0.52, u)) * Math.PI * 0.5);
        const flankRise  = pt * Math.sin(smooth(0.52, 0.64, u) * (1 - smooth(0.66, 0.84, u)) * Math.PI * 0.5);
        const tailTaper  = smooth(0.80, 0.96, u) * 0.28;
        const nyShifted  = ny - (thoraxRise * 0.32 + flankRise * 0.18 - tailTaper);

        // 下（腹底 C.belly）→ 淡い中間帯（C.patch）→ 脇腹（C.flank）→ 背中（C.back）へと単調かつ連続的に遷移
        c.copy(C.belly).lerp(C.patch, smooth(-0.52, -0.22, nyShifted));
        c.lerp(C.flank, smooth(-0.26, 0.06, nyShifted));
        c.lerp(C.back, smooth(-0.02, 0.46, nyShifted));

        if (this.sp.mottle) { // シロナガスの青灰色のまだら
          const m = Math.sin(u * 61 + j * 1.9) * Math.sin(u * 37 - j * 2.7 + 1.3) + 0.5 * Math.sin(u * 113 + j * 4.1);
          c.multiplyScalar(1 - this.sp.mottle * Math.max(0, m) + this.sp.mottle * 0.5 * Math.max(0, -m));
        }
        if (this.sp.speckle && ny > -0.3 && Math.random() < this.sp.speckle) c.lerp(C.belly, (this.sp.speckleMix ?? 0.5) * (0.8 + Math.random() * 0.4)); // 白っぽい斑点

        // ニタリクジラの3本の稜線（白を抑え、背中になじむ自然な落ち着いた灰色に調整）
        if (this.sp.ridges3 && u < 0.22 && ny > 0.3) {
          const mainRidge = Math.exp(-((th - Math.PI / 2) ** 2) / 0.016);
          const sideL = Math.exp(-((th - (Math.PI / 2 + 0.45)) ** 2) / 0.018);
          const sideR = Math.exp(-((th - (Math.PI / 2 - 0.45)) ** 2) / 0.018);
          const ridgeSum = Math.max(mainRidge, sideL, sideR) * (1 - smooth(0.14, 0.22, u));
          if (ridgeSum > 0.25) {
            c.lerp(C.flank, ridgeSum * 0.25);
          }
        }
        // 下あごは口の縁のあたりだけ少し暗く、下側は白い。ny=0で段差が出ないよう滑らかに減衰
        if (cc > H) {
          const lipShade = smooth(-0.42, -0.08, ny) * (1 - smooth(-0.06, 0.0, ny)) * 0.45 * (1 - smooth(this.jawU - 0.06, this.jawU + 0.04, u));
          c.lerp(C.flank, lipShade);
        }
        // 喉のひだ（体長の 47% まで）
        if (u > 0.03 && u < 0.47 && ny < -0.25 && j % 2 === 0) c.multiplyScalar(0.84);

        // ナガスクジラ特有の左右非対称な体色
        // ※クジラの体幹は頭が+Zのため、クジラ自身にとっての【右側は -X】、【左側は +X】
        if (this.sp.asymmetricJaw) {
          const normX = x / (rx * wx || 1);
          // クジラから見て：右側(-X)が1、左側(+X)が0
          const xBlend = smooth(0.14, -0.14, normX);

          // 1. 下あごの非対称：図鑑通り【右下あごが純白、左下あごが暗色】
          // 口角(this.jawU)より後ろのお腹・喉の畝は左右ともに美しい白へ自然につながる
          if (u < this.jawU + 0.04 && cc > H) {
            const jawFade = (1 - smooth(this.jawU - 0.02, this.jawU + 0.04, u)) * smooth(-0.55, -0.05, ny);
            const darkJaw = C.flank.clone().lerp(C.back, 0.72);
            const asymJaw = darkJaw.lerp(C.belly, xBlend); // 左(0)=暗色、右(1)=純白
            c.lerp(asymJaw, jawFade);
          }

          // 2. 右側(-X)の右下あご〜胸びれ前方から背中側へ、腹側の白さの延長として滑らかに立ち上がる淡色シェブロン
          if (x < 0 && u > 0.16 && u < 0.48 && ny > -0.25 && ny < 0.78) {
            const uCenter = 0.28 + 0.14 * smooth(-0.2, 0.75, ny);
            const band = Math.exp(-((u - uCenter) ** 2) / 0.0032) * (1 - smooth(0.55, 0.78, ny)) * smooth(-0.25, 0.05, ny);
            const rightFade = smooth(-0.05, -0.45, normX);
            c.lerp(C.patch, band * rightFade * 0.36);
          }
        }
        col.set([c.r, c.g, c.b], k * 3);
        k++;
      }
    }

    const idx = [];
    for (let i = 0; i < rings; i++) {
      for (let cc = 0; cc < cols - 1; cc++) {
        if (cc === H) continue; // 上半分と下半分はつながない
        const a = i * cols + cc, b = a + cols;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    this.bodyGeo = g;
    this._normals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.05 });
    this.body = new THREE.Mesh(g, mat);
    this.group.add(this.body);
    // 口の中：同じ形の裏側を暗い色で描く
    const inner = new THREE.MeshStandardMaterial({ color: 0x4a2c2e, roughness: 0.8, side: THREE.BackSide });
    this.group.add(new THREE.Mesh(g, inner));
  }

  _normals() {
    const g = this.bodyGeo;
    g.computeVertexNormals();
    const nm = g.attributes.normal.array, sp = this.seamPairs;
    for (let i = 0; i < sp.length; i += 2) {
      const a = sp[i] * 3, b = sp[i + 1] * 3;
      for (let d = 0; d < 3; d++) nm[a + d] = nm[b + d] = (nm[a + d] + nm[b + d]) * 0.5;
    }
    g.attributes.normal.needsUpdate = true;
  }

  _buildFins() {
    const finCol = (this.sp.finFlank ? this.col.flank : this.col.back).clone().multiplyScalar(this.sp.finFlank ? 1.05 : 1.25);
    const finMat = new THREE.MeshStandardMaterial({ color: finCol, roughness: 0.5, side: THREE.DoubleSide });

    // 尾びれ：後ろへ流れる三日月形
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    // 幅は約 2m。裏側は明るい灰色で、ふちは暗い
    s.bezierCurveTo(0.45, 0.14, 0.85, 0.38, 1.05, 0.72);
    s.bezierCurveTo(0.75, 0.62, 0.32, 0.56, 0, 0.68);
    s.bezierCurveTo(-0.32, 0.56, -0.75, 0.62, -1.05, 0.72);
    s.bezierCurveTo(-0.85, 0.38, -0.45, 0.14, 0, 0);
    const fg = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false, curveSegments: 10 });
    fg.translate(0, 0, -0.025);
    fg.rotateX(-Math.PI / 2); // shape の +y が後ろ（-z）、厚みが y 方向
    {
      const fp = fg.attributes.position, fn = fg.attributes.normal, fc = [];
      const dark = finCol.clone(), pale = new THREE.Color(0xc3cacf), c = new THREE.Color();
      for (let i = 0; i < fp.count; i++) {
        const edge = smooth(0.75, 1.0, Math.abs(fp.getX(i)) / 1.05) + smooth(0.55, 0.7, -fp.getZ(i));
        c.copy(dark).lerp(pale, fn.getY(i) < -0.5 ? 1 - Math.min(1, edge) : 0);
        fc.push(c.r, c.g, c.b);
      }
      fg.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3));
    }
    const flukeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide });
    this.fluke = new THREE.Mesh(fg, flukeMat);
    if (this.sp.flukeScale) {
      this.fluke.scale.set(this.sp.flukeScale[0] ?? 1, this.sp.flukeScale[1] ?? 1, this.sp.flukeScale[2] ?? 1);
    }
    this.group.add(this.fluke);

    // 背びれ：体の 2/3 あたりにある、立ち上がった鎌形
    const d = new THREE.Shape();
    d.moveTo(0, 0);
    if (this.sp.ridges3) {
      // ニタリクジラ特有の高く鋭く立ち上がり、後方に大きく鎌形に反り返る背びれ
      d.bezierCurveTo(0.05, 0.18, 0.15, 0.42, 0.32, 0.50);
      d.quadraticCurveTo(0.38, 0.52, 0.42, 0.46);
      d.bezierCurveTo(0.32, 0.32, 0.28, 0.10, 0.55, 0);
    } else {
      d.bezierCurveTo(0.06, 0.12, 0.14, 0.27, 0.3, 0.34);
      d.quadraticCurveTo(0.36, 0.36, 0.4, 0.35);
      d.bezierCurveTo(0.3, 0.24, 0.32, 0.08, 0.5, 0);
    }
    d.lineTo(0, 0);
    const dg = new THREE.ExtrudeGeometry(d, { depth: 0.05, bevelEnabled: false, curveSegments: 8 });
    dg.translate(0, -0.04, -0.025);
    dg.rotateY(Math.PI / 2); // shape の +x が後ろ（-z）
    this.dorsal = new THREE.Mesh(dg, finMat);
    this.dorsal.scale.setScalar(this.sp.dorsalSize);
    this.dorsalU = this.sp.dorsalU;
    this.group.add(this.dorsal);

    // 胸びれ：細長く、ミンクらしい白い帯
    const pg = new THREE.SphereGeometry(1, 16, 8);
    const pScale = this.sp.pecScale ?? [0.5, 0.03, 0.12];
    pg.scale(pScale[0], pScale[1], pScale[2]); // 個体ごとの胸びれ比率
    pg.translate(pScale[0] * 0.92, 0, 0);
    const pc = [];
    const p = pg.attributes.position;
    const dark = finCol.clone(), white = new THREE.Color(0xeef2f2), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      c.copy(dark).lerp(white, (this.sp.pecBand ? 1 : 0) * smooth(0.25, 0.33, x) * (1 - smooth(0.6, 0.68, x)));
      pc.push(c.r, c.g, c.b);
    }
    pg.setAttribute('color', new THREE.Float32BufferAttribute(pc, 3));
    const pMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide });
    this.pecU = 0.28;
    this.pecs = [1, -1].map((side) => {
      const pivot = new THREE.Group();
      const m = new THREE.Mesh(pg, pMat);
      pivot.add(m);
      pivot.scale.x = side;
      pivot.rotation.set(0, 0.75 * side, -0.45 * side); // 後ろへ流して、少し下げる
      this.group.add(pivot);
      return pivot;
    });

    // 目：口の端のすぐ上
    // 目は小さく、真っ黒ではなく体の色を暗くした色（体が大きい種ほど、体に対して小さい）
    const eyeG = new THREE.SphereGeometry(0.045 * (this.sp.eye ?? 1), 10, 8);
    const eyeM = new THREE.MeshStandardMaterial({ color: this.col.back.clone().multiplyScalar(0.45), roughness: 0.3 });
    const eu = this.jawU + 0.005, er = this.rX(eu) * (1 + (this.sp.headWide - 1) * (1 - smooth(0.12, 0.35, eu)));
    [1, -1].forEach((side) => {
      const e = new THREE.Mesh(eyeG, eyeM);
      e.position.set(side * er * 0.97, this.cyAt(eu) + 0.03, this.zAt(eu));
      this.group.add(e);
    });
  }

  // 体の上下うねり（尾ほど大きい）。ダッシュのひと振り（後ろの方だけ）を足す
  bendAt(u, amp) {
    const env = Math.pow(smooth(0.3, 1.0, u), 1.4);
    return amp * env * Math.sin(this.phase - this.waveK * u) - amp * 0.08 * Math.sin(this.phase)
      + this._dashAt(u);
  }

  // 「ダッシュしよう」と決めたら呼ぶ。後ろ半身を反らせて尾びれを振り上げ、打ち下ろす（その打ち下ろしで進む）
  startStroke() {
    if (this.dashT < 0) this.dashT = 0; // 振っている途中でやり直すとカクッとするので、終わってから
  }
  get strokeT() { return this.dashT; }

  // ダッシュのひと振り：振り上げ（0〜1/4 周期）→ 打ち下ろし（1/4〜3/4 周期）→ 戻し。尾の方だけを大きく振る。
  // 体の中ほど（腰）はほとんど動かさない
  _dashAt(u, t = this.dashT) {
    if (t < 0) return 0;
    const P = DASH_PERIOD * this.T, w = (Math.PI * 2) / P;
    // 尾に近いほど少し遅れて動き出す。動き出しはどこも 0 からなめらかに
    const arg = w * t - 1.5 * (u - 0.62);
    if (arg <= 0) return 0;
    const e = smooth(0, 1.0, arg) * (1 - smooth(P * 1.1, P * 1.5, t));
    const rear = Math.pow(smooth(0.62, 1.0, u), 2);
    return DASH_AMP * e * rear * Math.sin(arg);
  }

  // speed: m/s、gulp: 0..1（喉の膨らみ）、open: 0..1（下あごの開き）
  animate(dt, speed, gulp, open = 0) {
    // ふだんのうねり
    // 大きい種ほど速く泳ぐが、体の大きさに対してはゆっくり。尾を振るリズムも遅くなる
    const sn = speed / this.P; // ミンクに換算した速さ
    this.rate = (0.9 + sn * 0.22) / this.T;
    this.phase += dt * this.rate;
    const amp = Math.min(0.7, 0.3 + sn * 0.045); // 巡航でもゆったり大きめに振る（ローカル座標）
    if (this.dashT >= 0) { this.dashT += dt; if (this.dashT > DASH_PERIOD * this.T * 1.5) this.dashT = -1; }
    const pos = this.bodyGeo.attributes.position.array;
    const n = this.uArr.length;
    const zh = this.zAt(this.jawU);
    const a = open * (this.sp.jawMax ?? JAW_MAX), ca = Math.cos(a), sa = Math.sin(a);
    // 下あごの先（J）と、袋の後ろの端の底（B）。横から見た位置
    const tipD = this.zAt(0) - zh, jz = zh + tipD * ca, jy = -tipD * sa;
    const bz = this.zAt(POUCH_U), by = -this.rY(POUCH_U);
    // うねりと左右の曲がりは輪ごとに同じなので、輪ごとに一度だけ計算する
    this._updateTrail();
    const rb = this.ringBend, px = this.ringPX, pz = this.ringPZ, rc = this.ringC, rs = this.ringS, f = [0, 0, 0];
    for (let i = 0; i <= this.rings; i++) {
      const u = this.ringU[i];
      rb[i] = this.bendAt(u, amp);
      this._frameAt(u, f);
      px[i] = f[0]; pz[i] = f[1]; rc[i] = Math.cos(f[2]); rs[i] = Math.sin(f[2]);
    }
    for (let k = 0; k < n; k++) {
      const u = this.uArr[k], ny = this.nyArr[k];
      let x = this.base[k * 3], y = this.base[k * 3 + 1], z = this.base[k * 3 + 2];
      // 下半分の前側（喉の袋）は、横から見た「上の線（口の縁）」と「下の線（袋の底）」の間に張った皮として動かす。
      // 口を開けると下あごの先と腹が一直線につながり、水が入ると底がふくらみ、閉じても膨らみは残る
      if ((open > 0 || gulp > 0) && this.lower[k] && u < POUCH_U) {
        const ri0 = this.ring[k], r = this.ringR[ri0], sDepth = -ny, t = u / POUCH_U;
        const dz0 = z - this.zAt(u);
        let lz = this.zAt(u) + dz0, ly = 0;         // 口の縁（下あごの骨のあたり）
        let fz = lz, fy = -r;                        // 閉じているときの底
        if (u < this.jawU && a > 0) {                    // 下あごは付け根を軸に下へ回る
          let d = lz - zh; lz = zh + d * ca; ly = -d * sa;
          d = fz - zh; const fy2 = fy * ca - d * sa; fz = zh + fy * sa + d * ca; fy = fy2;
        }
        // 口先 J から袋の後ろの端 B までの直線
        const Lz = jz + (bz - jz) * t, Ly = jy + (by - jy) * t;
        const w = Math.max(open, gulp);
        fz += (Lz - fz) * w;
        fy = Math.min(fy, fy + (Ly - fy) * w) - POUCH_DROP * (this.sp.pouch ?? 1) * (1 + this.pouchBonus) * gulp * Math.pow(Math.sin(Math.PI * t), 0.8);
        y = ly + (fy - ly) * sDepth;
        z = lz + (fz - lz) * sDepth;
        x *= 1 + 0.5 * gulp * Math.sin(Math.PI * t) * Math.sin(Math.PI * sDepth);
      }
      // 輪ごとの位置と向きに合わせて、断面を水平に回して置く
      const ri = this.ring[k], dz = z - this.zAt(u);
      pos[k * 3] = px[ri] + x * rc[ri] + dz * rs[ri];
      pos[k * 3 + 1] = y + rb[ri] + this.ringCY[ri];
      pos[k * 3 + 2] = pz[ri] - x * rs[ri] + dz * rc[ri];
    }
    this.bodyGeo.attributes.position.needsUpdate = true;
    // 法線の計算は重いので、口や喉が動いていないときは数コマに一度でよい
    this._nf = ((this._nf || 0) + 1) % 2;
    if (gulp > 0 || open > 0 || this._nf === 0) this._normals();

    // 尾びれは体につられるだけでなく、自分で角度を付けて水をかく。
    // 尾の付け根が上がっていく間は後ろ縁を下げ、下がっていく間は後ろ縁を上げる（上下の動きより 1/4 周期先に傾く）。
    // 振りの折り返しで角度が一気に切り替わるので、ひと振りごとに「しなって返す」ように見える
    const yEnd = this.bendAt(1, amp);
    const slope = (yEnd - this.bendAt(0.97, amp)) / (0.03 * this.length);
    // 尾の先が上がる速さから角度を決める（上がっている間は後ろ縁を下げ、下がっている間は上げる）
    // 速さはコマの間隔に左右されないよう、少し前の時刻の位置を式から計算して求める
    const h = 0.03, ph = this.phase - this.rate * h;
    const yPrev = amp * Math.sin(ph - this.waveK) - amp * 0.08 * Math.sin(ph) + this._dashAt(1, this.dashT >= 0 ? this.dashT - h : -1);
    const tailVel = (yEnd - yPrev) / h;
    this.tailVel = (this.tailVel || 0) + (tailVel - (this.tailVel || 0)) * Math.min(1, dt * 8);
    const kick = 0.6 * Math.tanh(0.4 * this.tailVel); // 返りが急になりすぎないよう、ゆるく飽和させる
    const ft = this._frameAt(1, f);
    this.fluke.position.set(ft[0] + Math.sin(ft[2]) * 0.05, yEnd, ft[1] + Math.cos(ft[2]) * 0.05);
    this.fluke.rotation.set(Math.atan(slope) * 0.6 - kick, ft[2], 0, 'YXZ');

    const du = this.dorsalU, dt2 = this._frameAt(du, f);
    this.dorsal.position.set(dt2[0] + Math.sin(dt2[2]) * 0.3, this.cyAt(du) + this.rY(du) * 0.95 + this.bendAt(du, amp), dt2[1] + Math.cos(dt2[2]) * 0.3);
    this.dorsal.rotation.y = dt2[2];

    const r = this.rAt(this.pecU);
    // 胸びれ：ふだんはゆっくり上下にあおぐ。曲がるときは、曲がる側（内側）を下げて前へ張り出し、外側は少し上げる
    const yawRate = -this.group.rotation.z / 0.8; // main.js で、曲がる速さに応じて体を傾けている分から逆算
    const turn = Math.max(-0.6, Math.min(0.6, yawRate * 1.2));
    const flap = 0.12 * Math.sin(this.phase * 0.5);
    this.pecs.forEach((pv, i) => {
      const side = i === 0 ? 1 : -1;                 // +x 側（クジラから見て左）が side = 1
      const inner = Math.max(0, side * turn);        // こちら側へ曲がっているときの強さ
      const outer = Math.max(0, -side * turn);
      pv.position.set(side * this.rX(this.pecU) * 0.8, this.cyAt(this.pecU) - this.rY(this.pecU) * 0.45 - gulp * 0.6 + this.bendAt(this.pecU, amp), this.zAt(this.pecU));
      pv.rotation.set(0, side * (0.75 - inner * 0.6), -side * (0.45 + flap + inner * 0.7 - outer * 0.35));
    });
  }

  // 噴気孔（世界座標）
  blowholeWorld(target) {
    return this.group.localToWorld(target.set(0, this.cyAt(0.17) + this.rY(0.17) * 0.95, this.zAt(0.17)));
  }

  // 開いた口の開口部（横から見た三角形）。クジラのローカル座標で、口先 S・下あごの先 J・あごの付け根 H と、横幅の半分
  mouthGape(open) {
    const zh = this.zAt(this.jawU), a = open * (this.sp.jawMax ?? JAW_MAX), tipD = this.zAt(0) - zh;
    return {
      sz: this.zAt(0), sy: this.cyAt(0),
      jz: zh + tipD * Math.cos(a), jy: this.cyAt(0) - tipD * Math.sin(a),
      hz: zh, hy: this.cyAt(this.jawU),
      halfW: 0.9 + 0.9 * open, // 下あごの骨は外へ弓なりに張り、袋も横に広がるので、頭の幅より広く取る
    };
  }

  // 口先（世界座標）
  mouthWorld(target) {
    return this.group.localToWorld(target.set(0, -0.15, this.zAt(0.02)));
  }
}
