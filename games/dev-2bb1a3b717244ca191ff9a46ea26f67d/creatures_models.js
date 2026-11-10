import * as THREE from 'three';

/**
 * 水生生物3種（ザトウクジラ、ヨシキリザメ、カマイルカ）のプロシージャル3Dモデル＆骨格アニメーション生成モジュール
 * Three.js r170（ESモジュール）互換
 *
 * 座標系規則:
 *   +Z : 前（頭部・吻端）
 *   -Z : 後ろ（尾）
 *   +Y : 背中（上）
 *   -Y : 腹（下）
 *   +X : 左（生物自身から見て左） / -X : 右（生物自身から見て右）
 *
 * 特徴:
 *   - すべてのヒレを平板（ExtrudeGeometry）ではなく、前縁が丸く後縁が鋭い3D流線型翼断面（ハイドロフォイル）で生成
 *   - 吻端・尾柄端の断崖絶壁キャップやヒレ付け根のくびれを排除し、滑らかに体幹へ融合
 *   - 棒状の硬直移動ではなく、背骨の進行波（クジラ・イルカは上下波、サメは左右S字波）と尾びれの流体力学的しなり（kick）を毎フレーム計算する animate() メソッドを内蔵
 */

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

// 断面の表の補間。もとは表の点どうしを smoothstep でつないでいたが、smoothstep は表の点ごとに傾きが 0 になり、
// 輪郭が点ごとに段々の「こぶ」になる。表の点を通る単調 3 次曲線（makeCurve）に替えた（Claude、2026-11-09）。
// 表ごとに曲線を一度だけ作って覚えておく
const _curveCache = new WeakMap();
function interpolate(table, u) {
  let f = _curveCache.get(table);
  if (!f) { f = makeCurve(table); _curveCache.set(table, f); }
  return f(u);
}

/**
 * 3Dハイドロフォイル（流線型翼断面）ヒレジオメトリ生成ヘルパー
 * 平板の ExtrudeGeometry による角張りやポリゴン割れのアーティファクトを完全に排除し、
 * 前縁が丸く後縁がシャープに絞られた滑らかな3D翼面を生成する。
 *
 * @param {Object} opts
 * @param {number} opts.spanSegs - スパン方向（根元→先端、または左翼端→右翼端）の分割数
 * @param {number} opts.chordSegs - 翼弦方向（前縁→上面→後縁→下面→前縁）の周回分割数
 * @param {Function} opts.stationFn - (v: 0..1) => { lead: [x,y,z], trail: [x,y,z], thick: number, up: [nx,ny,nz] }
 * @param {Function} [opts.colorFn] - (v: 0..1, c: 0..1, side: -1..1, pos: [x,y,z]) => THREE.Color
 */
function buildHydrofoilGeometry({ spanSegs = 24, chordSegs = 24, stationFn, colorFn }) {
  const positions = [];
  const colors = [];
  const indices = [];

  for (let i = 0; i <= spanSegs; i++) {
    const v = i / spanSegs;
    const st = stationFn(v);
    const [lx, ly, lz] = st.lead;
    const [tx, ty, tz] = st.trail;
    const [ux, uy, uz] = st.up;
    const thick = st.thick;

    for (let j = 0; j <= chordSegs; j++) {
      const phi = (j / chordSegs) * Math.PI * 2;
      // コサイン間隔で前縁(c=0)と後縁(c=1)の頂点密度を高める
      const c = 0.5 * (1 - Math.cos(phi));
      // NACA風流線型厚み分布：前縁は丸く、最大厚は c≈0.28、後縁(c=1)はシャープに閉じる
      const sinP = Math.sin(phi);
      const foil = sinP * (1 - 0.38 * c) * Math.pow(1 - c * 0.92, 0.35);

      const x = lx + (tx - lx) * c + ux * thick * foil;
      const y = ly + (ty - ly) * c + uy * thick * foil;
      const z = lz + (tz - lz) * c + uz * thick * foil;
      positions.push(x, y, z);

      if (colorFn) {
        const col = colorFn(v, c, sinP, [x, y, z]);
        colors.push(col.r, col.g, col.b);
      }
    }
  }

  const ringStride = chordSegs + 1;
  // 外向き法線の向きを中央ステーションで自動判定してインデックス順序を決定
  const stA = stationFn(0.45);
  const stB = stationFn(0.55);
  const spanVec = new THREE.Vector3(
    stB.lead[0] - stA.lead[0],
    stB.lead[1] - stA.lead[1],
    stB.lead[2] - stA.lead[2]
  );
  const chordVec = new THREE.Vector3(
    stA.trail[0] - stA.lead[0],
    stA.trail[1] - stA.lead[1],
    stA.trail[2] - stA.lead[2]
  );
  const upVec = new THREE.Vector3(...stA.up);
  // phi = PI/2 (上面) において、chordVec × spanVec が upVec と同じ向きかどうか
  const cross = new THREE.Vector3().crossVectors(chordVec, spanVec);
  const flip = cross.dot(upVec) < 0;

  for (let i = 0; i < spanSegs; i++) {
    const rowA = i * ringStride;
    const rowB = (i + 1) * ringStride;
    for (let j = 0; j < chordSegs; j++) {
      const a = rowA + j;
      const b = rowB + j;
      const c = rowA + j + 1;
      const d = rowB + j + 1;
      if (flip) {
        indices.push(a, b, c, c, b, d);
      } else {
        indices.push(a, c, b, c, d, b);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (colorFn) {
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ==============================================================================
// 1. ザトウクジラ（Humpback Whale / Megaptera novaeangliae）
// ==============================================================================
export function createHumpback() {
  const group = new THREE.Group();
  const length = 13.5;
  const PIVOT_U = 0.40;
  const zAt = (u) => length * (PIVOT_U - u);

  // 解剖学的プロファイル:
  // [u, 半径r, 中心高さcy, 横幅倍率wx, 背側扁平率flatTop, 腹側深さbellyDepth, 背びれコブ隆起hump]
  const PROFILE = [
    [0.00, 0.02, -0.05, 1.85, 0.55, 0.65, 0.00], // 吻端（べき乗補間で滑らかに丸める）
    [0.03, 0.52, -0.06, 1.75, 0.56, 0.92, 0.00], // 下あご先端コブ（Mandibular projection）
    [0.08, 0.86, -0.06, 1.56, 0.62, 1.02, 0.00], // 吻部前部（広く平たい上あごと深い下あご）
    [0.16, 1.18, -0.04, 1.38, 0.70, 1.08, 0.00], // 頭部中央・結節列
    [0.24, 1.38,  0.00, 1.22, 0.80, 1.12, 0.00], // 噴気孔付近
    [0.29, 1.46,  0.03, 1.14, 0.86, 1.15, 0.00], // 目の位置・口角（u=0.29）
    [0.38, 1.54,  0.06, 1.06, 0.92, 1.18, 0.00], // 胸部最大胴回り・胸びれ付け根（貫禄のある深い胸）
    [0.48, 1.44,  0.06, 1.00, 0.95, 1.10, 0.00], // 腹部中央
    [0.58, 1.22,  0.05, 0.92, 0.98, 0.98, 0.00], // 腹部後半（畝の終端）
    [0.67, 0.96,  0.06, 0.82, 1.02, 0.90, 0.14], // 背中のコブ（Hump）前縁の盛り上がり開始
    [0.71, 0.84,  0.08, 0.76, 1.06, 0.86, 0.28], // 【背中のコブ（Dorsal Hump）頂点】：名前の由来の隆起
    [0.76, 0.68,  0.04, 0.70, 0.98, 0.84, 0.06], // コブ直後
    [0.84, 0.48,  0.02, 0.60, 0.96, 0.84, 0.00], // 尾柄前部（背側キール突起列）
    [0.92, 0.30,  0.01, 0.50, 0.94, 0.82, 0.00], // 尾柄中央（上下に高く左右に側扁）
    [0.97, 0.19,  0.00, 0.45, 0.90, 0.78, 0.00], // 尾柄くびれ
    [1.00, 0.13,  0.00, 0.55, 0.85, 0.75, 0.00], // 尾びれ付け根
  ];

  const getProfile = (u) => {
    const [rRaw, cy, wx, flatTop, bellyDepth, hump] = interpolate(PROFILE, u);
    // 吻端（u < 0.08）はべき乗曲線で滑らかなドーム状に立ち上げ、断崖絶壁キャップを防ぐ
    const r = u < 0.08 ? interpolate(PROFILE, 0.08)[0] * Math.pow(u / 0.08, 0.42) : rRaw;
    return { r, cy, wx, flatTop, bellyDepth, hump };
  };

  // --- 胴体メッシュ ---
  const rings = 60;
  const segs = 36;
  const ringU = new Float32Array(rings + 1);
  const ringCY = new Float32Array(rings + 1);
  const positions = [];
  const colors = [];
  const indices = [];

  const cBlack = new THREE.Color(0x161a1e);      // 背中・頭部の深いスレートブラック
  const cCharcoal = new THREE.Color(0x283038);   // 体側のダークチャコール
  const cWhiteBelly = new THREE.Color(0xeef3f7); // 腹部の白
  const tempCol = new THREE.Color();

  for (let i = 0; i <= rings; i++) {
    const u = Math.pow(i / rings, 1.25);
    ringU[i] = u;
    const { r, cy, wx, flatTop, bellyDepth, hump } = getProfile(u);
    ringCY[i] = cy;
    const z = zAt(u);

    for (let s = 0; s < segs; s++) {
      const th = (s / segs) * Math.PI * 2;
      const cosT = Math.cos(th);
      const sinT = Math.sin(th);

      let yMod = sinT >= 0 ? sinT * flatTop : sinT * bellyDepth;
      let xMod = cosT * wx;

      // 1. 頭部（u < 0.30）：平たい上あごと、外側に弓なりに張り出した下あごの段差（口ライン）
      if (u > 0.01 && u < 0.30) {
        const headEnv = smooth(0.01, 0.05, u) * (1 - smooth(0.22, 0.30, u));
        // 上あごはやや狭く平たい、下あご（sinT < -0.05）は横に広く張り出す
        if (sinT > 0.05) {
          xMod *= 1.0 - 0.16 * headEnv * smooth(0.05, 0.5, sinT);
        } else {
          xMod *= 1.0 + 0.10 * headEnv * smooth(-0.05, -0.45, sinT);
        }
        // 口のスリット溝（sinT ≈ -0.05 付近）
        const lipGroove = Math.exp(-((sinT + 0.04) ** 2) / 0.008) * headEnv;
        xMod *= 1.0 - 0.07 * lipGroove;
      }

      // 2. 下あご先端の特徴的な隆起（Chin protuberance: u = 0.015..0.06）
      if (u > 0.01 && u < 0.07 && sinT < -0.4) {
        const chin = Math.exp(-((u - 0.032) ** 2) / 0.0003) * Math.pow(-sinT, 2);
        yMod -= 0.18 * chin;
      }

      // 3. 吻部中央稜線と噴気孔のスプラッシュガード（u = 0.04..0.26）
      if (sinT > 0 && u < 0.27) {
        const ridge = Math.exp(-((th - Math.PI / 2) ** 2) / 0.045);
        const splash = 0.16 * Math.exp(-((u - 0.21) ** 2) / 0.0012);
        yMod += (0.09 * (1 - smooth(0.16, 0.26, u)) + splash) * ridge;
      }

      // 4. 背中のコブ（Dorsal Hump: u = 0.66..0.76）の肉厚な盛り上がり
      if (sinT > 0.2 && hump > 0) {
        const humpRidge = Math.exp(-((th - Math.PI / 2) ** 2) / 0.12);
        yMod += hump * humpRidge;
      }

      // 5. 尾柄背側の鋸歯状キール（Knuckle ridges: u = 0.78..0.95）
      if (u > 0.78 && u < 0.95 && sinT > 0.75) {
        const knuckles = Math.pow(Math.max(0, Math.sin((u - 0.78) * 115.0)), 1.6);
        const ridgeProfile = Math.exp(-((th - Math.PI / 2) ** 2) / 0.06);
        yMod += 0.065 * knuckles * ridgeProfile * smooth(0.78, 0.81, u) * (1 - smooth(0.92, 0.95, u));
      }

      // 6. 喉〜腹部の太い畝（Ventral grooves: 14〜22本の深いひだ）
      let grooveWave = 0;
      if (u > 0.04 && u < 0.58 && sinT < -0.18) {
        const grooveFactor = smooth(0.04, 0.10, u) * (1 - smooth(0.50, 0.58, u)) * smooth(-0.18, -0.45, sinT);
        grooveWave = Math.sin(cosT * 18.0);
        yMod += grooveWave * 0.036 * grooveFactor;
      }

      const x = xMod * r;
      const y = cy + yMod * r;
      positions.push(x, y, z);

      // --- 頂点カラーリング ---
      // 背中〜体側上部は重厚なスレートブラック、喉〜胸部・腹部に白いパッチとまだら模様
      const bellyMask = smooth(-0.12, -0.52, sinT) * smooth(0.04, 0.10, u) * (1 - smooth(0.66, 0.74, u));
      const flankMottle = Math.sin(u * 48.0 + cosT * 9.0) * Math.cos(u * 27.0 - sinT * 11.0);
      const mottleBonus = smooth(0.10, 0.22, u) * (1 - smooth(0.56, 0.68, u)) * smooth(0.0, 0.55, flankMottle) * 0.22;

      tempCol.copy(cCharcoal).lerp(cBlack, smooth(-0.20, 0.55, sinT));
      const whiteMix = Math.min(1, bellyMask + mottleBonus * smooth(0.05, -0.35, sinT));
      tempCol.lerp(cWhiteBelly, whiteMix);

      // 喉の畝の溝にリアルな陰影を入れる
      if (u > 0.04 && u < 0.58 && sinT < -0.20 && grooveWave < -0.1) {
        tempCol.multiplyScalar(1.0 + grooveWave * 0.22);
      }
      // 口のスリットラインを暗く引き締める
      if (u > 0.01 && u < 0.30 && Math.abs(sinT + 0.04) < 0.07) {
        tempCol.multiplyScalar(0.65);
      }

      colors.push(tempCol.r, tempCol.g, tempCol.b);
    }
  }

  for (let i = 0; i < rings; i++) {
    const rowA = i * segs;
    const rowB = (i + 1) * segs;
    for (let s = 0; s < segs; s++) {
      const nextS = (s + 1) % segs;
      indices.push(rowA + s, rowB + s, rowA + nextS);
      indices.push(rowA + nextS, rowB + s, rowB + nextS);
    }
  }

  // 吻端・尾端の極小キャップ（r≈0.02 に絞られているため段差なし）
  const tipIdx = positions.length / 3;
  positions.push(0, getProfile(0).cy, zAt(0) + 0.01);
  colors.push(cBlack.r, cBlack.g, cBlack.b);
  for (let s = 0; s < segs; s++) indices.push(tipIdx, s, (s + 1) % segs);

  const endIdx = positions.length / 3;
  positions.push(0, getProfile(1).cy, zAt(1) - 0.02);
  colors.push(cBlack.r, cBlack.g, cBlack.b);
  const endRow = rings * segs;
  for (let s = 0; s < segs; s++) indices.push(endIdx, endRow + (s + 1) % segs, endRow + s);

  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  bodyGeo.setIndex(indices);
  bodyGeo.computeVertexNormals();

  const basePos = new Float32Array(positions);

  const bodyMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.48,
    metalness: 0.05,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(bodyMesh);

  // --- 頭部上面＆下あご先端の結節（Tubercles：体表の正確な楕円面座標に配置） ---
  const headGroup = new THREE.Group();
  group.add(headGroup);
  const knobGeo = new THREE.SphereGeometry(0.058, 10, 8);
  const knobMat = new THREE.MeshStandardMaterial({ color: 0x12161a, roughness: 0.55 });

  // 1. 吻部中央列
  for (const u of [0.025, 0.055, 0.09, 0.125, 0.16, 0.195]) {
    const { r, cy, flatTop } = getProfile(u);
    const m = new THREE.Mesh(knobGeo, knobMat);
    m.position.set(0, cy + r * (flatTop + 0.07), zAt(u));
    m.scale.set(1.0, 0.65, 1.3);
    headGroup.add(m);
  }
  // 2. 上あご外縁列（楕円面上の th = PI*0.18 / PI*0.82 に正確に密着）
  for (const u of [0.035, 0.07, 0.105, 0.14, 0.175, 0.21, 0.245]) {
    const { r, cy, wx, flatTop } = getProfile(u);
    const headEnv = smooth(0.01, 0.05, u) * (1 - smooth(0.22, 0.30, u));
    const th = 0.34; // 上あご縁の角度
    const xSurf = Math.cos(th) * wx * (1.0 - 0.16 * headEnv * smooth(0.05, 0.5, Math.sin(th))) * r;
    const ySurf = cy + Math.sin(th) * flatTop * r;
    [-1, 1].forEach((side) => {
      const m = new THREE.Mesh(knobGeo, knobMat);
      m.position.set(side * xSurf * 0.96, ySurf, zAt(u));
      m.scale.set(0.95, 0.65, 1.15);
      headGroup.add(m);
    });
  }
  // 3. 下あご先端のコブ群（Chin cluster）
  for (const [u, thOff, sc] of [
    [0.025, 0.0, 1.1], [0.032, 0.22, 0.95], [0.032, -0.22, 0.95],
    [0.048, 0.14, 0.85], [0.048, -0.14, 0.85], [0.048, 0.36, 0.80], [0.048, -0.36, 0.80],
  ]) {
    const { r, cy, wx, bellyDepth } = getProfile(u);
    const th = -Math.PI / 2 + thOff;
    const m = new THREE.Mesh(knobGeo, knobMat);
    m.position.set(Math.cos(th) * r * wx * 0.95, cy + Math.sin(th) * r * bellyDepth * 0.98, zAt(u));
    m.scale.setScalar(sc);
    headGroup.add(m);
  }

  // --- 目（口角のすぐ上 u=0.285） ---
  const eyeU = 0.285;
  const { r: eyeR, cy: eyeCY, wx: eyeWX } = getProfile(eyeU);
  const eyeGeo = new THREE.SphereGeometry(0.048, 12, 10);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x080a0c, roughness: 0.18, metalness: 0.5 });
  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side * eyeR * eyeWX * 0.97, eyeCY + 0.04, zAt(eyeU));
    eye.scale.set(0.6, 1.0, 1.15);
    headGroup.add(eye);
  });

  // --- 背びれ（Dorsal Hump u=0.71 の頂上から滑らかに立ち上がる肉厚な3Dハイドロフォイル鎌形背びれ） ---
  const dorsalU = 0.71;
  const dorsalGeo = buildHydrofoilGeometry({
    spanSegs: 16,
    chordSegs: 20,
    stationFn: (v) => {
      // v=0: 背中のコブ内部に広く深く埋め込まれた台座、v=1: 後方へ反り返った丸みのある先端
      const y = -0.18 + v * 0.54;
      const sweepZ = -Math.pow(v, 1.55) * 0.42;
      const chord = (1 - Math.pow(v, 1.25) * 0.82) * 0.82;
      const leadZ = 0.36 + sweepZ;
      const trailZ = leadZ - chord + Math.sin(v * Math.PI) * 0.08;
      const thick = (1 - Math.pow(v, 1.1) * 0.85) * 0.11;
      return {
        lead: [0, y, leadZ],
        trail: [0, y - 0.04 * (1 - v), trailZ],
        thick,
        up: [1, 0, 0],
      };
    },
    colorFn: () => cBlack,
  });
  const dorsalMesh = new THREE.Mesh(dorsalGeo, bodyMat);
  const { r: dR, cy: dCY, flatTop: dFlat, hump: dHump } = getProfile(dorsalU);
  dorsalMesh.position.set(0, dCY + dR * (dFlat + dHump * 0.75), zAt(dorsalU));
  group.add(dorsalMesh);

  // --- 長大な胸びれ（3Dハイドロフォイル＋滑らかな曲線前縁＋自然な翼の反り） ---
  // スパン長 4.25m（体長の約 1/3）、付け根の翼弦長 1.05m で肩に太く滑らかに接合
  const pecGeo = buildHydrofoilGeometry({
    spanSegs: 48,
    chordSegs: 24,
    stationFn: (v) => {
      const span = v * 4.25;
      // 前縁のコブはガタガタに見えるのを防ぐため極く穏やかなうねりに留め、滑らかな曲線にする
      const knobEnv = smooth(0.10, 0.22, v) * (1 - smooth(0.88, 0.98, v));
      const knobWave = (0.5 + 0.5 * Math.sin(v * Math.PI * 13.0)) * 0.025 * knobEnv;
      // 後方への優雅なスイープ曲線
      const sweepBack = Math.pow(v, 1.32) * 2.15;
      // 翼弦長（付け根で 1.05m、中央でやや張り、先端でキュッと絞る）
      const chord = 1.05 * Math.pow(1 - Math.pow(v, 1.65) * 0.94, 0.65);
      // 翼端に向かってわずかに上反り（しなり）を持たせる
      const camberY = -Math.sin(v * Math.PI * 0.85) * 0.14;
      const leadZ = 0.32 - sweepBack + knobWave;
      const trailZ = leadZ - chord;
      const thick = 0.11 * (1 - Math.pow(v, 0.85) * 0.88);
      return {
        lead: [span, camberY, leadZ],
        trail: [span, camberY - 0.03 * (1 - v), trailZ],
        thick,
        up: [0, 1, 0],
      };
    },
    colorFn: (v, c, sinP) => {
      // 裏面（sinP < 0）と前縁（c < 0.24）、および翼端（v > 0.78）は鮮やかな白、上面中央〜後縁はダークスレート
      const col = new THREE.Color();
      const isBottom = smooth(0.15, -0.25, sinP);
      const isLeadingWhite = 1 - smooth(0.14, 0.34, c);
      const isTipWhite = smooth(0.72, 0.88, v);
      const whiteMix = Math.max(isBottom, isLeadingWhite * 0.92, isTipWhite * 0.85);
      return col.copy(cBlack).lerp(cWhiteBelly, whiteMix);
    },
  });

  const pecU = 0.37;
  const { r: pecR, cy: pecCY, wx: pecWX } = getProfile(pecU);
  const pecZ = zAt(pecU);
  const pecPivots = [];
  [-1, 1].forEach((side) => {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(pecGeo, bodyMat);
    mesh.scale.set(side, 1, 1);
    pivot.add(mesh);
    pivot.position.set(side * pecR * pecWX * 0.78, pecCY - pecR * 0.32, pecZ);
    pivot.rotation.set(-0.18, side * 0.12, -side * 0.34);
    group.add(pivot);
    pecPivots.push({ pivot, side });
  });

  // --- 水平尾びれ（3Dハイドロフォイル＋深いV字ノッチ＋滑らかな曲線後縁＋裏面ホワイト模様） ---
  const flukeGroup = new THREE.Group();
  flukeGroup.position.set(0, getProfile(1.0).cy, zAt(1.0));

  const flukeGeo = buildHydrofoilGeometry({
    spanSegs: 48,
    chordSegs: 22,
    stationFn: (v) => {
      // v: 0(左翼端 -X) .. 0.5(中央尾柄 0) .. 1.0(右翼端 +X)
      const s = (v - 0.5) * 2; // -1 .. +1
      const absS = Math.abs(s);
      const halfSpan = 2.15;
      const x = s * halfSpan;

      // 前縁：中央（尾柄内部 z=+0.18）から翼端（z=-0.82）へ優美なS字スイープ
      const leadZ = 0.18 - Math.pow(absS, 1.35) * 1.00;
      // 中央のV字ノッチと滑らかな後縁カーブ（ギザギザの鋸歯を廃止）
      const notch = Math.exp(-(absS ** 2) / 0.012) * 0.20;
      const chord = 0.72 * (1 - Math.pow(absS, 1.9) * 0.88) - notch;
      const trailZ = leadZ - Math.max(0.06, chord);
      // 翼端がわずかに下へしなる立体感
      const y = -Math.pow(absS, 1.8) * 0.08;
      const thick = 0.075 * (1 - Math.pow(absS, 1.1) * 0.88);
      return {
        lead: [x, y, leadZ],
        trail: [x, y, trailZ],
        thick,
        up: [0, 1, 0],
      };
    },
    colorFn: (v, c, sinP) => {
      const absS = Math.abs((v - 0.5) * 2);
      const col = new THREE.Color();
      if (sinP < -0.15) {
        // 裏面：ザトウクジラ特有の白い尾びれ裏面＋黒い外縁トリム
        const edgeBlack = smooth(0.75, 0.96, c) + smooth(0.84, 0.98, absS) + (1 - smooth(0.0, 0.18, c)) * 0.6;
        col.copy(cWhiteBelly).lerp(cBlack, Math.min(1, edgeBlack));
      } else {
        col.copy(cBlack);
      }
      return col;
    },
  });
  const flukeMesh = new THREE.Mesh(flukeGeo, bodyMat);
  flukeGroup.add(flukeMesh);
  group.add(flukeGroup);

  // --- 全身の進行波（背骨の上下うねり＋旋回曲げ＋胸びれ羽ばたき＋尾びれ返し）アニメーション ---
  let phase = Math.random() * Math.PI * 2;
  let smoothTurn = 0;
  let tailVel = 0;
  const ringDY = new Float32Array(rings + 1);
  const ringDX = new Float32Array(rings + 1);
  const ringCos = new Float32Array(rings + 1);
  const ringSin = new Float32Array(rings + 1);

  const bendYAt = (u, amp, ph = phase) => {
    const env = Math.pow(smooth(0.28, 1.0, u), 1.45);
    return amp * env * Math.sin(ph - 4.2 * u) - amp * 0.08 * Math.sin(ph);
  };

  function animate(dt, speed = 2.6, yawRate = 0) {
    const rate = 1.05 + (speed / 2.6) * 0.35;
    phase += dt * rate;
    const amp = Math.min(0.68, 0.32 + speed * 0.06);
    smoothTurn += (yawRate - smoothTurn) * Math.min(1, dt * 4.0);
    const turnBend = Math.max(-0.55, Math.min(0.55, smoothTurn * 1.4));

    for (let i = 0; i <= rings; i++) {
      const u = ringU[i];
      ringDY[i] = bendYAt(u, amp);
      const du = u - PIVOT_U;
      ringDX[i] = -turnBend * du * Math.abs(du) * 2.2;
      const yawAngle = -turnBend * du * 0.85;
      ringCos[i] = Math.cos(yawAngle);
      ringSin[i] = Math.sin(yawAngle);
    }

    const posAttr = bodyGeo.attributes.position;
    const posArr = posAttr.array;
    let k = 0;
    for (let i = 0; i <= rings; i++) {
      const dy = ringDY[i], dx = ringDX[i], rc = ringCos[i], rs = ringSin[i];
      const z0 = zAt(ringU[i]);
      for (let s = 0; s < segs; s++) {
        const bx = basePos[k * 3];
        const by = basePos[k * 3 + 1];
        const bz = basePos[k * 3 + 2];
        const dz = bz - z0;
        posArr[k * 3] = dx + bx * rc + dz * rs;
        posArr[k * 3 + 1] = by + dy;
        posArr[k * 3 + 2] = z0 - bx * rs + dz * rc;
        k++;
      }
    }
    // キャップ頂点の追従
    posArr[tipIdx * 3] = ringDX[0];
    posArr[tipIdx * 3 + 1] = basePos[tipIdx * 3 + 1] + ringDY[0];
    posArr[endIdx * 3] = ringDX[rings];
    posArr[endIdx * 3 + 1] = basePos[endIdx * 3 + 1] + ringDY[rings];

    posAttr.needsUpdate = true;

    // 頭部パーツの追従
    headGroup.position.set(ringDX[4] * 0.5, ringDY[4], 0);

    // 背びれの追従（背中のうねりと傾きに完全密着）
    const dyDorsal = bendYAt(dorsalU, amp);
    const slopeDorsal = (bendYAt(dorsalU + 0.02, amp) - bendYAt(dorsalU - 0.02, amp)) / (0.04 * length);
    const duD = dorsalU - PIVOT_U;
    dorsalMesh.position.set(
      -turnBend * duD * Math.abs(duD) * 2.2,
      dCY + dR * (dFlat + dHump * 0.75) + dyDorsal,
      zAt(dorsalU)
    );
    dorsalMesh.rotation.set(Math.atan(slopeDorsal) * 0.75, -turnBend * duD * 0.85, 0, 'YXZ');

    // 巨大胸びれの優雅な羽ばたき・水中グライド運動
    const dyPec = bendYAt(pecU, amp);
    for (const { pivot, side } of pecPivots) {
      const flap = Math.sin(phase * 0.65 - 0.5) * 0.22;
      const pitchFeather = Math.cos(phase * 0.65 - 0.5) * 0.12;
      const sweep = Math.sin(phase * 0.65 - 1.1) * 0.08;
      pivot.position.y = pecCY - pecR * 0.32 + dyPec;
      pivot.rotation.set(
        -0.18 + pitchFeather,
        side * (0.12 + sweep),
        -side * 0.32 + side * flap
      );
    }

    // 尾びれのしなり返し（上下速度から流体力学的な仰角遅れ kick を計算）
    const yEnd = bendYAt(1.0, amp);
    const slopeEnd = (yEnd - bendYAt(0.96, amp)) / (0.04 * length);
    const h = 0.04;
    const yPrev = bendYAt(1.0, amp, phase - rate * h);
    const instVel = (yEnd - yPrev) / h;
    tailVel += (instVel - tailVel) * Math.min(1, dt * 8.0);
    const kick = 0.55 * Math.tanh(0.38 * tailVel);

    const duEnd = 1.0 - PIVOT_U;
    flukeGroup.position.set(
      -turnBend * duEnd * Math.abs(duEnd) * 2.2,
      getProfile(1.0).cy + yEnd,
      zAt(1.0)
    );
    flukeGroup.rotation.set(Math.atan(slopeEnd) * 0.65 - kick, -turnBend * duEnd * 0.85, 0, 'YXZ');
  }

  return { group, flukeGroup, pecPivots, animate };
}

// ==============================================================================
// 2. サメ（ヨシキリザメ / Blue Shark / Prionace glauca）
// ==============================================================================
export function createShark() {
  const group = new THREE.Group();
  const length = 3.2;
  const PIVOT_U = 0.36;
  const zAt = (u) => length * (PIVOT_U - u);

  // ヨシキリザメのスマートな外洋性流線型プロファイル
  // [u, 半径r, 中心高さcy, 横幅倍率wx, 背側高さflatTop, 腹側高さflatBelly]
  const PROFILE = [
    [0.00, 0.006,  0.005, 1.45, 0.62, 0.55], // 吻端（シャープな放物線ノーズ、断崖キャップなし）
    [0.04, 0.095,  0.002, 1.32, 0.68, 0.62], // 吻部前部（上下に扁平なヘラ状）
    [0.09, 0.165, -0.004, 1.20, 0.82, 0.74], // 鼻孔・目直前
    [0.12, 0.200, -0.006, 1.14, 0.90, 0.82], // 【目の位置】：u=0.115
    [0.16, 0.242, -0.002, 1.08, 0.96, 0.88], // 下付きの三日月口（u=0.12..0.18）
    [0.24, 0.292,  0.012, 1.04, 1.02, 0.90], // 鰓裂（5本のエラ：u=0.22..0.30）
    [0.33, 0.320,  0.024, 1.02, 1.05, 0.90], // 胸びれ付け根
    [0.44, 0.330,  0.035, 0.98, 1.08, 0.88], // 最大体高（第1背びれ直前）
    [0.52, 0.305,  0.032, 0.94, 1.06, 0.86], // 【第1背びれ直下】：u=0.49
    [0.66, 0.225,  0.018, 0.88, 1.00, 0.84], // 腹びれ位置
    [0.80, 0.135,  0.008, 0.82, 0.94, 0.82], // 第2背びれ・臀びれ位置
    [0.92, 0.072,  0.002, 1.18, 0.82, 0.80], // 尾柄（水平キールにより横に張り出す）
    [0.97, 0.056,  0.000, 1.05, 0.86, 0.84], // 尾柄くびれ（極端に細くせず尾びれへ繋ぐ）
    [1.00, 0.050,  0.000, 0.90, 0.92, 0.90], // 尾びれ付け根
  ];

  const getProfile = (u) => {
    const [rRaw, cy, wx, flatTop, flatBelly] = interpolate(PROFILE, u);
    const r = u < 0.06 ? interpolate(PROFILE, 0.06)[0] * Math.pow(u / 0.06, 0.52) : rRaw;
    return { r, cy, wx, flatTop, flatBelly };
  };

  const rings = 56;
  const segs = 32;
  const ringU = new Float32Array(rings + 1);
  const positions = [];
  const colors = [];
  const indices = [];

  const cIndigo = new THREE.Color(0x06203c); // 背中の深いインディゴブルー
  const cCobalt = new THREE.Color(0x0f5ea6); // 体側の鮮やかなメタリックコバルトブルー
  const cSilver = new THREE.Color(0x8ab8d8); // 境界のシルバーブルー
  const cBelly = new THREE.Color(0xf4f8fc);  // 腹部の純白
  const cDarkGill = new THREE.Color(0x031122);
  const tempCol = new THREE.Color();

  for (let i = 0; i <= rings; i++) {
    const u = Math.pow(i / rings, 1.18);
    ringU[i] = u;
    const { r, cy, wx, flatTop, flatBelly } = getProfile(u);
    const z = zAt(u);

    for (let s = 0; s < segs; s++) {
      const th = (s / segs) * Math.PI * 2;
      const cosT = Math.cos(th);
      const sinT = Math.sin(th);

      let yMod = sinT >= 0 ? sinT * flatTop : sinT * flatBelly;
      let xMod = cosT * wx;

      // 1. 目の上の精悍な眉稜（Brow ridge: u = 0.08..0.16）
      if (u > 0.07 && u < 0.17 && sinT > 0.05 && sinT < 0.55) {
        const brow = Math.exp(-((u - 0.115) ** 2) / 0.0008) * Math.exp(-((sinT - 0.25) ** 2) / 0.02);
        xMod *= 1.0 + 0.08 * brow;
      }

      // 2. サメ特有の腹側三日月口（Ventral crescent mouth: u = 0.11..0.18）
      let mouthShadow = 0;
      if (u > 0.105 && u < 0.185 && sinT < -0.45) {
        // 放物線状の口ライン: uMouth = 0.12 + 0.045 * cosT^2
        const uMouth = 0.122 + 0.048 * (cosT * cosT);
        const distM = Math.abs(u - uMouth);
        if (distM < 0.016 && Math.abs(cosT) < 0.72) {
          const groove = 1 - smooth(0.0, 0.016, distM);
          yMod += 0.12 * groove; // 内側へくぼませる
          mouthShadow = groove;
        }
      }

      // 3. 5本の鰓裂（Gill slits: u = 0.215..0.295、浮いた別板を使わず体表のスリット溝として一体造形）
      let gillShadow = 0;
      if (u > 0.205 && u < 0.305 && Math.abs(sinT + 0.05) < 0.38 && Math.abs(cosT) > 0.75) {
        const gillPhase = ((u - 0.212) / 0.082) * 5.0 * Math.PI * 2;
        const slit = Math.pow(Math.max(0, Math.sin(gillPhase)), 6.0);
        const vertEnv = 1 - smooth(0.22, 0.38, Math.abs(sinT + 0.05));
        gillShadow = slit * vertEnv;
        xMod *= 1.0 - 0.045 * gillShadow;
      }

      // 4. 尾柄の水平隆起キール（Caudal keel: u = 0.86..0.98）
      if (u > 0.86 && u < 0.98 && Math.abs(sinT) < 0.25) {
        const keel = (1 - Math.abs(sinT) / 0.25) * smooth(0.86, 0.90, u) * (1 - smooth(0.95, 0.98, u));
        xMod *= 1.0 + 0.22 * keel;
      }

      const x = xMod * r;
      const y = cy + yMod * r;
      positions.push(x, y, z);

      // --- 頂点カラーリング（ヨシキリザメの鮮烈なカウンターシェーディング） ---
      if (sinT > 0.35) {
        tempCol.copy(cCobalt).lerp(cIndigo, smooth(0.35, 0.92, sinT));
      } else if (sinT > -0.28) {
        tempCol.copy(cCobalt);
      } else if (sinT > -0.52) {
        tempCol.copy(cSilver).lerp(cCobalt, smooth(-0.52, -0.28, sinT));
      } else {
        tempCol.copy(cBelly).lerp(cSilver, smooth(-0.72, -0.52, sinT));
      }

      if (mouthShadow > 0.05) tempCol.lerp(cDarkGill, mouthShadow * 0.85);
      if (gillShadow > 0.05) tempCol.lerp(cDarkGill, gillShadow * 0.88);

      colors.push(tempCol.r, tempCol.g, tempCol.b);
    }
  }

  for (let i = 0; i < rings; i++) {
    const rowA = i * segs;
    const rowB = (i + 1) * segs;
    for (let s = 0; s < segs; s++) {
      const nextS = (s + 1) % segs;
      indices.push(rowA + s, rowB + s, rowA + nextS);
      indices.push(rowA + nextS, rowB + s, rowB + nextS);
    }
  }

  const tipIdx = positions.length / 3;
  positions.push(0, getProfile(0).cy, zAt(0) + 0.01);
  colors.push(cIndigo.r, cIndigo.g, cIndigo.b);
  for (let s = 0; s < segs; s++) indices.push(tipIdx, s, (s + 1) % segs);

  const endIdx = positions.length / 3;
  positions.push(0, getProfile(1).cy, zAt(1) - 0.01);
  colors.push(cIndigo.r, cIndigo.g, cIndigo.b);
  const endRow = rings * segs;
  for (let s = 0; s < segs; s++) indices.push(endIdx, endRow + (s + 1) % segs, endRow + s);

  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  bodyGeo.setIndex(indices);
  bodyGeo.computeVertexNormals();

  const basePos = new Float32Array(positions);

  const bodyMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.25,
    metalness: 0.16,
  });
  group.add(new THREE.Mesh(bodyGeo, bodyMat));

  // ヒレ共通のカラー関数（基部はコバルトブルー、先端・後縁に向かって濃紺に引き締まる）
  const sharkFinColor = (v, c, sinP) => {
    const col = new THREE.Color();
    const darkTip = smooth(0.65, 0.98, v) * 0.6 + smooth(0.70, 0.98, c) * 0.4;
    col.copy(cCobalt).lerp(cIndigo, Math.min(1, 0.35 + darkTip));
    return col;
  };

  // --- 第1背びれ（3Dハイドロフォイル＋後端の遊離突起 Free rear tip） ---
  const d1U = 0.48;
  const { r: d1R, cy: d1CY, flatTop: d1Flat } = getProfile(d1U);
  const d1Geo = buildHydrofoilGeometry({
    spanSegs: 18,
    chordSegs: 20,
    stationFn: (v) => {
      const y = -0.06 + v * 0.48;
      const leadZ = 0.22 - Math.pow(v, 1.22) * 0.34;
      // 根元付近(v < 0.18)は後方へ鋭く伸びるフリーリアチップ、中間は内反り（falcate）
      const rearTip = (1 - smooth(0.0, 0.22, v)) * 0.14;
      const chord = 0.38 * (1 - Math.pow(v, 1.15) * 0.86) + rearTip;
      const trailZ = leadZ - chord;
      const thick = 0.028 * (1 - Math.pow(v, 0.9) * 0.88);
      return { lead: [0, y, leadZ], trail: [0, y, trailZ], thick, up: [1, 0, 0] };
    },
    colorFn: sharkFinColor,
  });
  const d1Mesh = new THREE.Mesh(d1Geo, bodyMat);
  d1Mesh.position.set(0, d1CY + d1R * d1Flat * 0.92, zAt(d1U));
  group.add(d1Mesh);

  // --- 第2背びれ＆臀びれ（u = 0.80） ---
  const d2U = 0.80;
  const { r: d2R, cy: d2CY, flatTop: d2Flat, flatBelly: d2Belly } = getProfile(d2U);
  const smallFinGeo = (dirY) => buildHydrofoilGeometry({
    spanSegs: 10,
    chordSegs: 14,
    stationFn: (v) => {
      const y = dirY * (-0.03 + v * 0.13);
      const leadZ = 0.08 - Math.pow(v, 1.2) * 0.11;
      const rearTip = (1 - smooth(0.0, 0.28, v)) * 0.06;
      const chord = 0.13 * (1 - v * 0.82) + rearTip;
      return {
        lead: [0, y, leadZ],
        trail: [0, y, leadZ - chord],
        thick: 0.012 * (1 - v * 0.85),
        up: [ dirY, 0, 0 ],
      };
    },
    colorFn: sharkFinColor,
  });
  const d2Mesh = new THREE.Mesh(smallFinGeo(1), bodyMat);
  d2Mesh.position.set(0, d2CY + d2R * d2Flat * 0.90, zAt(d2U));
  group.add(d2Mesh);

  const analMesh = new THREE.Mesh(smallFinGeo(-1), bodyMat);
  analMesh.position.set(0, d2CY - d2R * d2Belly * 0.88, zAt(d2U) - 0.03);
  group.add(analMesh);

  // --- 腹びれ（Pelvic fins: u = 0.66） ---
  const pelU = 0.66;
  const { r: pelR, cy: pelCY, flatBelly: pelBelly } = getProfile(pelU);
  const pelGeo = buildHydrofoilGeometry({
    spanSegs: 10,
    chordSegs: 14,
    stationFn: (v) => {
      const span = v * 0.16;
      const leadZ = 0.07 - Math.pow(v, 1.2) * 0.12;
      const chord = 0.14 * (1 - v * 0.80);
      return {
        lead: [span, -v * 0.06, leadZ],
        trail: [span, -v * 0.06, leadZ - chord],
        thick: 0.012 * (1 - v * 0.85),
        up: [0, 1, 0],
      };
    },
    colorFn: (v, c, sinP) => (sinP < -0.1 ? cBelly : sharkFinColor(v, c, sinP)),
  });
  const pelGroup = new THREE.Group();
  pelGroup.position.set(0, pelCY - pelR * pelBelly * 0.78, zAt(pelU));
  [-1, 1].forEach((side) => {
    const m = new THREE.Mesh(pelGeo, bodyMat);
    m.scale.set(side, 1, 1);
    m.position.x = side * pelR * 0.55;
    m.rotation.z = -side * 0.35;
    pelGroup.add(m);
  });
  group.add(pelGroup);

  // --- 長大なサーベル状胸びれ（3Dハイドロフォイル：上面コバルトブルー、裏面ホワイト＋先端黒縁） ---
  const pecU = 0.32;
  const { r: pecR, cy: pecCY, wx: pecWX } = getProfile(pecU);
  const pecGeo = buildHydrofoilGeometry({
    spanSegs: 26,
    chordSegs: 20,
    stationFn: (v) => {
      const span = v * 0.96;
      const sweepBack = Math.pow(v, 1.38) * 0.56;
      // 付け根は 0.34m の十分な翼弦長を持ち、体幹へ隙間なく融合する
      const chord = 0.34 * Math.pow(1 - Math.pow(v, 1.45) * 0.92, 0.72);
      const camberY = -Math.sin(v * Math.PI * 0.75) * 0.05;
      const leadZ = 0.16 - sweepBack;
      const trailZ = leadZ - chord;
      const thick = 0.026 * (1 - Math.pow(v, 0.85) * 0.88);
      return {
        lead: [span, camberY, leadZ],
        trail: [span, camberY - 0.015 * (1 - v), trailZ],
        thick,
        up: [0, 1, 0],
      };
    },
    colorFn: (v, c, sinP) => {
      if (sinP < -0.15) {
        const tipDark = smooth(0.75, 0.98, v) * 0.75 + smooth(0.80, 0.98, c) * 0.35;
        return new THREE.Color().copy(cBelly).lerp(cIndigo, Math.min(1, tipDark));
      }
      return sharkFinColor(v, c, sinP);
    },
  });

  const pecGroup = new THREE.Group();
  pecGroup.position.set(0, pecCY - pecR * 0.28, zAt(pecU));
  [-1, 1].forEach((side) => {
    const pivot = new THREE.Group();
    const m = new THREE.Mesh(pecGeo, bodyMat);
    m.scale.set(side, 1, 1);
    pivot.add(m);
    pivot.position.set(side * pecR * pecWX * 0.76, 0, 0);
    pivot.rotation.set(-0.08, side * 0.06, -side * 0.26);
    pecGroup.add(pivot);
  });
  group.add(pecGroup);

  // --- 垂直尾びれ（歪尾 / Heterocercal tail：尾柄と100%連続する3Dハイドロフォイル） ---
  // 付け根のくびれを根絶するため、v=0（下葉先端）〜 v=0.35（尾柄中央）〜 v=1.0（上葉先端）を一続きの3D翼として生成
  const flukeGroup = new THREE.Group();
  flukeGroup.position.set(0, getProfile(1.0).cy, zAt(1.0));

  const tailGeo = buildHydrofoilGeometry({
    spanSegs: 34,
    chordSegs: 20,
    stationFn: (v) => {
      // v=0.32 が尾柄の中心軸(y=0)
      const vCenter = 0.32;
      let y, leadZ, chord, thick;
      if (v >= vCenter) {
        // 上葉（Upper lobe: 長く斜め後ろ上方へ伸び、先端手前にサブターミナルノッチを持つ）
        const t = (v - vCenter) / (1 - vCenter); // 0 .. 1
        y = t * 0.72;
        leadZ = 0.10 - Math.pow(t, 1.06) * 0.78;
        // サブターミナルノッチ（t = 0.76..0.90 で後縁がキュッと切れ込み、先端付近でわずかに広がる）
        const notch = Math.exp(-((t - 0.80) ** 2) / 0.004) * 0.055;
        chord = 0.24 * (1 - Math.pow(t, 1.25) * 0.84) - notch;
        thick = 0.036 * (1 - Math.pow(t, 0.85) * 0.88);
      } else {
        // 下葉（Lower lobe: 短く鋭い鎌形に下方へ伸びる）
        const t = (vCenter - v) / vCenter; // 0(中心) .. 1(下葉先端)
        y = -t * 0.32;
        leadZ = 0.10 - Math.pow(t, 1.15) * 0.34;
        chord = 0.24 * (1 - Math.pow(t, 1.35) * 0.88);
        thick = 0.034 * (1 - Math.pow(t, 0.9) * 0.88);
      }
      return {
        lead: [0, y, leadZ],
        trail: [0, y, leadZ - Math.max(0.02, chord)],
        thick,
        up: [1, 0, 0],
      };
    },
    colorFn: sharkFinColor,
  });
  flukeGroup.add(new THREE.Mesh(tailGeo, bodyMat));
  group.add(flukeGroup);

  // --- 目（u = 0.115：白い強膜リング＋大きな黒目） ---
  const headGroup = new THREE.Group();
  group.add(headGroup);
  const eyeU = 0.115;
  const { r: eyeR, cy: eyeCY, wx: eyeWX } = getProfile(eyeU);
  const eyeGeo = new THREE.SphereGeometry(0.025, 14, 12);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x03060a, roughness: 0.06, metalness: 0.9 });
  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side * eyeR * eyeWX * 0.97, eyeCY + 0.012, zAt(eyeU));
    eye.scale.set(0.55, 1.0, 1.15);
    headGroup.add(eye);
  });

  // --- サメ特有の左右S字進行波（Lateral S-wave undulation）アニメーション ---
  let phase = Math.random() * Math.PI * 2;
  let smoothTurn = 0;
  let tailVel = 0;
  const ringDX = new Float32Array(rings + 1);
  const ringCos = new Float32Array(rings + 1);
  const ringSin = new Float32Array(rings + 1);

  // 位置 u における背骨の横変位（頭部は安定し、胸びれより後ろから尾柄に向かってS字波が増폭）
  const bendXAt = (u, amp, turnBend, ph = phase) => {
    const env = 0.03 * (1 - smooth(0.0, 0.30, u)) + Math.pow(smooth(0.22, 1.0, u), 1.5);
    const du = u - PIVOT_U;
    const turnCurve = -turnBend * du * Math.abs(du) * 1.6;
    return amp * env * Math.sin(ph - 5.2 * u) - amp * 0.04 * Math.sin(ph) + turnCurve;
  };

  function animate(dt, speed = 2.4, yawRate = 0) {
    const rate = 3.2 + (speed / 2.4) * 1.4;
    phase += dt * rate;
    const amp = Math.min(0.22, 0.11 + speed * 0.025);
    smoothTurn += (yawRate - smoothTurn) * Math.min(1, dt * 5.0);
    const turnBend = Math.max(-0.5, Math.min(0.5, smoothTurn * 0.9));

    for (let i = 0; i <= rings; i++) {
      const u = ringU[i];
      const dx = bendXAt(u, amp, turnBend);
      const dxNext = bendXAt(Math.min(1, u + 0.02), amp, turnBend);
      const slopeX = (dxNext - dx) / (0.02 * length);
      const theta = Math.atan(slopeX) * 0.85;
      ringDX[i] = dx;
      ringCos[i] = Math.cos(theta);
      ringSin[i] = Math.sin(theta);
    }

    const posAttr = bodyGeo.attributes.position;
    const posArr = posAttr.array;
    let k = 0;
    for (let i = 0; i <= rings; i++) {
      const dx = ringDX[i], rc = ringCos[i], rs = ringSin[i];
      const z0 = zAt(ringU[i]);
      for (let s = 0; s < segs; s++) {
        const bx = basePos[k * 3];
        const by = basePos[k * 3 + 1];
        const bz = basePos[k * 3 + 2];
        const dz = bz - z0;
        posArr[k * 3] = dx + bx * rc - dz * rs;
        posArr[k * 3 + 1] = by;
        posArr[k * 3 + 2] = z0 + bx * rs + dz * rc;
        k++;
      }
    }
    posArr[tipIdx * 3] = ringDX[0];
    posArr[endIdx * 3] = ringDX[rings];
    posAttr.needsUpdate = true;

    // 頭部・各ヒレを背骨の横波と接線角に完全追従させる
    const syncPart = (obj, u) => {
      const dx = bendXAt(u, amp, turnBend);
      const slope = (bendXAt(Math.min(1, u + 0.02), amp, turnBend) - dx) / (0.02 * length);
      obj.position.x = dx;
      obj.rotation.y = -Math.atan(slope) * 0.88;
    };
    syncPart(headGroup, eyeU);
    syncPart(pecGroup, pecU);
    syncPart(d1Mesh, d1U);
    syncPart(pelGroup, pelU);
    syncPart(d2Mesh, d2U);
    syncPart(analMesh, d2U);

    // 垂直尾びれのS字スイング（背骨末端の傾き＋水を蹴る流体力学的しなり kick）
    const xEnd = bendXAt(1.0, amp, turnBend);
    const slopeEnd = (xEnd - bendXAt(0.96, amp, turnBend)) / (0.04 * length);
    const h = 0.03;
    const xPrev = bendXAt(1.0, amp, turnBend, phase - rate * h);
    const instVel = (xEnd - xPrev) / h;
    tailVel += (instVel - tailVel) * Math.min(1, dt * 10.0);
    const kick = 0.42 * Math.tanh(0.8 * tailVel);

    flukeGroup.position.x = xEnd;
    flukeGroup.rotation.y = -Math.atan(slopeEnd) * 0.85 + kick;
  }

  return { group, flukeGroup, animate };
}

// ==============================================================================
// 3. カマイルカ（Pacific White-Sided Dolphin / Lagenorhynchus obliquidens）
// ==============================================================================
export function createDolphin() {
  const group = new THREE.Group();
  const length = 2.3;
  const PIVOT_U = 0.40;
  const zAt = (u) => length * (PIVOT_U - u);

  // カマイルカの解剖学的プロファイル：
  // 短く引き締まったくちばし（u=0..0.055）から、丸いおでこ（Melon: u=0.06..0.18）へ明確な段差（Apex）で立ち上がるスマートな流線型
  // [u, 半径r, 中心高さcy, 横幅倍率wx, 上側高さtopScale, 下側高さbotScale]
  const PROFILE = [
    [0.000, 0.005, -0.020, 1.18, 0.78, 0.78], // くちばし先端（丸く収束）
    [0.025, 0.042, -0.020, 1.22, 0.76, 0.80], // 短いくちばし中央（Rostrum）
    [0.052, 0.062, -0.016, 1.18, 0.80, 0.86], // くちばし付け根（Apex crease：ここからメロンが立ち上がる）
    [0.085, 0.122,  0.005, 1.12, 1.04, 0.86], // 【メロン前部】：おでこの立ち上がり
    [0.130, 0.168,  0.016, 1.08, 1.00, 0.88], // 【目の位置】：u=0.125
    [0.200, 0.215,  0.026, 1.06, 0.94, 0.88], // 後頭部
    [0.290, 0.246,  0.032, 1.04, 0.90, 0.88], // 【胸びれ付け根】：u=0.285
    [0.400, 0.258,  0.035, 1.02, 0.90, 0.88], // 最大胴回り（引き締まったスマートな紡錘形）
    [0.490, 0.238,  0.032, 0.98, 0.92, 0.88], // 【背びれ直下】：u=0.48
    [0.620, 0.186,  0.022, 0.90, 0.94, 0.90], // 胴体後半
    [0.760, 0.122,  0.012, 0.74, 1.04, 1.00], // 尾柄前部
    [0.880, 0.072,  0.005, 0.60, 1.10, 1.06], // 尾柄中央
    [0.960, 0.038,  0.001, 0.55, 0.98, 0.96], // 尾柄くびれ
    [1.000, 0.024,  0.000, 0.60, 0.90, 0.90], // 尾びれ付け根
  ];

  const getProfile = (u) => {
    const [rRaw, cy, wx, topScale, botScale] = interpolate(PROFILE, u);
    const r = u < 0.025 ? interpolate(PROFILE, 0.025)[0] * Math.pow(u / 0.025, 0.48) : rRaw;
    return { r, cy, wx, topScale, botScale };
  };

  const rings = 52;
  const segs = 32;
  const ringU = new Float32Array(rings + 1);
  const positions = [];
  const colors = [];
  const indices = [];

  const cBlack = new THREE.Color(0x101317);      // 背中・くちばしの艶やかな黒
  const cDarkGray = new THREE.Color(0x46525e);   // 体側下部のスレートグレー
  const cLightPatch = new THREE.Color(0xc8d4de); // 胸部パッチの明るいシルバーグレー
  const cSuspender = new THREE.Color(0xf0f5fa);  // サスペンダー帯の鮮やかな白銀色
  const cWhiteBelly = new THREE.Color(0xf7fafc); // 腹部の純白
  const tempCol = new THREE.Color();

  for (let i = 0; i <= rings; i++) {
    const u = Math.pow(i / rings, 1.16);
    ringU[i] = u;
    const { r, cy, wx, topScale, botScale } = getProfile(u);
    const z = zAt(u);

    for (let s = 0; s < segs; s++) {
      const th = (s / segs) * Math.PI * 2;
      const cosT = Math.cos(th);
      const sinT = Math.sin(th);

      let yMod = sinT >= 0 ? sinT * topScale : sinT * botScale;
      let xMod = cosT * wx;

      // くちばしの微笑みライン（口角の細いくぼみ: u = 0.00..0.10）
      let smileLine = 0;
      if (u < 0.105 && Math.abs(sinT + 0.08 - u * 0.4) < 0.09) {
        smileLine = (1 - smooth(0.0, 0.09, Math.abs(sinT + 0.08 - u * 0.4))) * (1 - smooth(0.08, 0.105, u));
        xMod *= 1.0 - 0.05 * smileLine;
      }

      const x = xMod * r;
      const y = cy + yMod * r;
      positions.push(x, y, z);

      // --- カマイルカ特有のサスペンダー模様（単位円上の角度 sinT と位置 u で正確に定義） ---
      // 1. ベース配色：背中は黒、側面はグレー、下腹部（sinT < -0.38）は純白
      if (sinT > 0.10) {
        tempCol.copy(cDarkGray).lerp(cBlack, smooth(0.10, 0.45, sinT));
      } else if (sinT > -0.35) {
        tempCol.copy(cWhiteBelly).lerp(cDarkGray, smooth(-0.35, 0.10, sinT));
      } else {
        tempCol.copy(cWhiteBelly);
      }

      // 2. 体側前部の大きな明灰色パッチ（Thoracic patch: 目の後ろ u=0.14 から胸びれ後方 u=0.45 まで広がる）
      if (u > 0.11 && u < 0.48 && sinT > -0.32 && sinT < 0.32) {
        const uEnv = smooth(0.11, 0.17, u) * (1 - smooth(0.38, 0.48, u));
        const yEnv = smooth(-0.32, -0.10, sinT) * (1 - smooth(0.12, 0.32, sinT));
        tempCol.lerp(cLightPatch, uEnv * yEnv * 0.92);
      }

      // 3. サスペンダーライン（Suspender stripe：おでこ脇 u=0.14, sinT=0.45 から背びれ脇を通り、尾柄側面 u=0.86, sinT=-0.05 へ斜めに流れる白銀の帯！）
      if (u > 0.12 && u < 0.88) {
        const targetSin = 0.48 - 0.62 * ((u - 0.12) / 0.76);
        const distSin = Math.abs(sinT - targetSin);
        // 尾柄側（u > 0.55）では帯が太く鮮やかになる（カマイルカの白い体側斑 "white-sided"）
        const halfWidth = 0.14 + 0.12 * smooth(0.45, 0.72, u);
        const stripe = (1 - smooth(halfWidth * 0.35, halfWidth, distSin)) * smooth(0.12, 0.20, u) * (1 - smooth(0.80, 0.88, u));
        tempCol.lerp(cSuspender, stripe * 0.96);
      }

      // 4. くちばし・目の周りのアイリング＆リップは黒く引き締める
      if (u < 0.058 || smileLine > 0.2) {
        tempCol.lerp(cBlack, Math.max(1 - smooth(0.04, 0.058, u), smileLine * 0.85));
      }
      // 腹部の白と体側の境界を走る細い黒縁ライン（Ventral dark stripe）
      if (u > 0.26 && u < 0.72) {
        const lineSin = -0.36 - 0.08 * Math.sin((u - 0.26) * 6.0);
        const lineMask = (1 - smooth(0.02, 0.07, Math.abs(sinT - lineSin))) * smooth(0.26, 0.32, u) * (1 - smooth(0.65, 0.72, u));
        tempCol.lerp(cBlack, lineMask * 0.75);
      }

      colors.push(tempCol.r, tempCol.g, tempCol.b);
    }
  }

  for (let i = 0; i < rings; i++) {
    const rowA = i * segs;
    const rowB = (i + 1) * segs;
    for (let s = 0; s < segs; s++) {
      const nextS = (s + 1) % segs;
      indices.push(rowA + s, rowB + s, rowA + nextS);
      indices.push(rowA + nextS, rowB + s, rowB + nextS);
    }
  }

  const tipIdx = positions.length / 3;
  positions.push(0, getProfile(0).cy, zAt(0) + 0.008);
  colors.push(cBlack.r, cBlack.g, cBlack.b);
  for (let s = 0; s < segs; s++) indices.push(tipIdx, s, (s + 1) % segs);

  const endIdx = positions.length / 3;
  positions.push(0, getProfile(1).cy, zAt(1) - 0.008);
  colors.push(cBlack.r, cBlack.g, cBlack.b);
  const endRow = rings * segs;
  for (let s = 0; s < segs; s++) indices.push(endIdx, endRow + (s + 1) % segs, endRow + s);

  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  bodyGeo.setIndex(indices);
  bodyGeo.computeVertexNormals();

  const basePos = new Float32Array(positions);

  const bodyMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.28,
    metalness: 0.12,
  });
  group.add(new THREE.Mesh(bodyGeo, bodyMat));

  // --- 背びれ（カマイルカの象徴：高く反り返った鎌形3Dハイドロフォイル＋前縁黒・後縁白灰の鮮やかなツートン） ---
  const dorsalU = 0.48;
  const { r: dR, cy: dCY, topScale: dTop } = getProfile(dorsalU);
  const dorsalGeo = buildHydrofoilGeometry({
    spanSegs: 22,
    chordSegs: 22,
    stationFn: (v) => {
      // v=0: 背中内部へ深く馴染む広い基部、v=1: 後方へ鋭くフックした鎌（Sickle）の先端
      const y = -0.06 + v * 0.36;
      // 前縁：上へ向かいながら後半で強く後ろへカーブ
      const leadZ = 0.16 - Math.pow(v, 1.48) * 0.29;
      // 後縁：内側に深くえぐれた三日月フック形状（Falcate）
      const hook = Math.sin(v * Math.PI) * 0.075;
      const chord = 0.28 * (1 - Math.pow(v, 1.25) * 0.86) - hook * 0.55;
      const trailZ = leadZ - Math.max(0.03, chord);
      const thick = 0.022 * (1 - Math.pow(v, 0.9) * 0.88);
      return {
        lead: [0, y, leadZ],
        trail: [0, y, trailZ],
        thick,
        up: [1, 0, 0],
      };
    },
    colorFn: (v, c) => {
      // カマイルカ特有のツートン背びれ：前縁側(c < 0.42)と先端(v > 0.85)は漆黒、後半内側(c > 0.45)は鮮やかな白銀〜明灰色！
      // 高密度グリッドの3Dハイドロフォイルなのでポリゴン割れが一切起きず美しい三日月境界になる
      const col = new THREE.Color();
      const whiteZone = smooth(0.36, 0.56, c) * (1 - smooth(0.78, 0.94, v)) * smooth(0.05, 0.20, v);
      return col.copy(cBlack).lerp(cSuspender, whiteZone * 0.92);
    },
  });
  const dorsalMesh = new THREE.Mesh(dorsalGeo, bodyMat);
  dorsalMesh.position.set(0, dCY + dR * dTop * 0.90, zAt(dorsalU));
  group.add(dorsalMesh);

  // --- 胸びれ（3Dハイドロフォイルの鎌形フリッパー、付け根に十分な幅を持たせて体幹と一体化） ---
  const pecU = 0.285;
  const { r: pecR, cy: pecCY, wx: pecWX } = getProfile(pecU);
  const pecGeo = buildHydrofoilGeometry({
    spanSegs: 16,
    chordSegs: 16,
    stationFn: (v) => {
      const span = v * 0.36;
      const leadZ = 0.09 - Math.pow(v, 1.35) * 0.20;
      const chord = 0.16 * (1 - Math.pow(v, 1.4) * 0.88);
      const camberY = -Math.sin(v * Math.PI * 0.8) * 0.02;
      const thick = 0.016 * (1 - Math.pow(v, 0.9) * 0.88);
      return {
        lead: [span, camberY, leadZ],
        trail: [span, camberY, leadZ - chord],
        thick,
        up: [0, 1, 0],
      };
    },
    colorFn: () => cBlack,
  });
  const pecGroup = new THREE.Group();
  pecGroup.position.set(0, pecCY - pecR * 0.32, zAt(pecU));
  [-1, 1].forEach((side) => {
    const pivot = new THREE.Group();
    const m = new THREE.Mesh(pecGeo, bodyMat);
    m.scale.set(side, 1, 1);
    pivot.add(m);
    pivot.position.set(side * pecR * pecWX * 0.78, 0, 0);
    pivot.rotation.set(-0.20, side * 0.10, -side * 0.42);
    pecGroup.add(pivot);
  });
  group.add(pecGroup);

  // --- 水平尾びれ（3Dハイドロフォイル：尾柄と滑らかに繋がる三日月形） ---
  const flukeGroup = new THREE.Group();
  flukeGroup.position.set(0, getProfile(1.0).cy, zAt(1.0));

  const flukeGeo = buildHydrofoilGeometry({
    spanSegs: 28,
    chordSegs: 16,
    stationFn: (v) => {
      const s = (v - 0.5) * 2; // -1 .. +1
      const absS = Math.abs(s);
      const x = s * 0.34;
      const leadZ = 0.06 - Math.pow(absS, 1.35) * 0.22;
      const notch = Math.exp(-(absS ** 2) / 0.01) * 0.04;
      const chord = 0.15 * (1 - Math.pow(absS, 1.7) * 0.86) - notch;
      const thick = 0.016 * (1 - Math.pow(absS, 1.0) * 0.88);
      return {
        lead: [x, 0, leadZ],
        trail: [x, 0, leadZ - Math.max(0.015, chord)],
        thick,
        up: [0, 1, 0],
      };
    },
    colorFn: () => cBlack,
  });
  flukeGroup.add(new THREE.Mesh(flukeGeo, bodyMat));
  group.add(flukeGroup);

  // --- 目（u = 0.125） ---
  const headGroup = new THREE.Group();
  group.add(headGroup);
  const eyeU = 0.125;
  const { r: eyeR, cy: eyeCY, wx: eyeWX } = getProfile(eyeU);
  const eyeGeo = new THREE.SphereGeometry(0.016, 12, 10);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.1, metalness: 0.85 });
  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side * eyeR * eyeWX * 0.97, eyeCY + 0.005, zAt(eyeU));
    eye.scale.set(0.6, 1.0, 1.15);
    headGroup.add(eye);
  });

  // --- イルカ特有のしなやかな全身上下うねり＆ジャンプ時の弓なりアーチアニメーション ---
  let phase = Math.random() * Math.PI * 2;
  let smoothTurn = 0;
  let tailVel = 0;
  const ringDY = new Float32Array(rings + 1);
  const ringDX = new Float32Array(rings + 1);

  // jumpArch: ジャンプ中に背骨全体を美しい弓なり（放物線アーチ）にしならせる量（-1..+1）
  const bendYAt = (u, amp, jumpArch = 0, ph = phase) => {
    const env = Math.pow(smooth(0.24, 1.0, u), 1.45);
    const du = u - PIVOT_U;
    const arch = -jumpArch * (du * du) * 0.85;
    return amp * env * Math.sin(ph - 4.5 * u) - amp * 0.08 * Math.sin(ph) + arch;
  };

  function animate(dt, speed = 3.2, yawRate = 0, jumpArch = 0) {
    const rate = 4.2 + speed * 1.1;
    phase += dt * rate;
    const amp = Math.min(0.18, 0.08 + speed * 0.018) * (1 - Math.abs(jumpArch) * 0.35);
    smoothTurn += (yawRate - smoothTurn) * Math.min(1, dt * 6.0);
    const turnBend = Math.max(-0.5, Math.min(0.5, smoothTurn * 0.6));

    for (let i = 0; i <= rings; i++) {
      const u = ringU[i];
      ringDY[i] = bendYAt(u, amp, jumpArch);
      const du = u - PIVOT_U;
      ringDX[i] = -turnBend * du * Math.abs(du) * 1.2;
    }

    const posAttr = bodyGeo.attributes.position;
    const posArr = posAttr.array;
    let k = 0;
    for (let i = 0; i <= rings; i++) {
      const dy = ringDY[i], dx = ringDX[i];
      for (let s = 0; s < segs; s++) {
        posArr[k * 3] = basePos[k * 3] + dx;
        posArr[k * 3 + 1] = basePos[k * 3 + 1] + dy;
        k++;
      }
    }
    posArr[tipIdx * 3] = ringDX[0];
    posArr[tipIdx * 3 + 1] = basePos[tipIdx * 3 + 1] + ringDY[0];
    posArr[endIdx * 3] = ringDX[rings];
    posArr[endIdx * 3 + 1] = basePos[endIdx * 3 + 1] + ringDY[rings];
    posAttr.needsUpdate = true;

    // 頭部・胸びれ・背びれの追従
    headGroup.position.set(ringDX[6], ringDY[6], 0);
    pecGroup.position.y = pecCY - pecR * 0.32 + bendYAt(pecU, amp, jumpArch);

    const dyDorsal = bendYAt(dorsalU, amp, jumpArch);
    const slopeDorsal = (bendYAt(dorsalU + 0.03, amp, jumpArch) - bendYAt(dorsalU - 0.03, amp, jumpArch)) / (0.06 * length);
    const duD = dorsalU - PIVOT_U;
    dorsalMesh.position.set(
      -turnBend * duD * Math.abs(duD) * 1.2,
      dCY + dR * dTop * 0.90 + dyDorsal,
      zAt(dorsalU)
    );
    dorsalMesh.rotation.set(Math.atan(slopeDorsal) * 0.8, -turnBend * duD * 0.6, 0, 'YXZ');

    // 尾びれのしなり返し（流体力学的仰角遅れ kick）
    const yEnd = bendYAt(1.0, amp, jumpArch);
    const slopeEnd = (yEnd - bendYAt(0.95, amp, jumpArch)) / (0.05 * length);
    const h = 0.025;
    const yPrev = bendYAt(1.0, amp, jumpArch, phase - rate * h);
    const instVel = (yEnd - yPrev) / h;
    tailVel += (instVel - tailVel) * Math.min(1, dt * 12.0);
    const kick = 0.52 * Math.tanh(0.6 * tailVel);

    const duEnd = 1.0 - PIVOT_U;
    flukeGroup.position.set(
      -turnBend * duEnd * Math.abs(duEnd) * 1.2,
      getProfile(1.0).cy + yEnd,
      zAt(1.0)
    );
    flukeGroup.rotation.set(Math.atan(slopeEnd) * 0.7 - kick, -turnBend * duEnd * 0.6, 0, 'YXZ');
  }

  return { group, flukeGroup, animate };
}


// ==============================================================================
// 4. アオウミガメ（Green Sea Turtle / Chelonia mydas）
// ==============================================================================
export function createSeaTurtle() {
  const group = new THREE.Group();

  const cDarkBrown = new THREE.Color(0x221b10); // 甲羅の深いマホガニーブラウン
  const cOlive = new THREE.Color(0x4b5228);     // オリーブグリーン
  const cAmber = new THREE.Color(0x886c36);     // べっ甲のアンバーゴールド
  const cRim = new THREE.Color(0xa68e56);       // 縁甲板の明るいバフカラー
  const cPlastron = new THREE.Color(0xede2be);  // 腹甲のクリームイエロー
  const cSkin = new THREE.Color(0x424a30);      // 頭部・ヒレのオリーブスキン
  const tempCol = new THREE.Color();

  // --- 1. 甲羅（背甲 Carapace ＆ 腹甲 Plastron：ハート〜ティアドロップ型の流線型ドーム） ---
  // u = 0 (甲羅前端 z=+0.52) .. u = 1 (甲羅後端 z=-0.68)、全長 1.20m、最大幅 0.96m
  const shellLen = 1.20;
  const zShell = (u) => 0.52 - u * shellLen;
  // [u, 半幅rx, 背甲高さtopY, 腹甲深さbotY, 中心cy]
  const SHELL_PROFILE = [
    [0.00, 0.02, 0.01, 0.01,  0.01],
    [0.05, 0.24, 0.08, 0.05,  0.01], // 首元のアーチ
    [0.16, 0.42, 0.17, 0.09,  0.01], // 肩の前
    [0.32, 0.48, 0.22, 0.11,  0.00], // 最大幅・最大ドーム高
    [0.50, 0.46, 0.21, 0.11,  0.00], // 甲羅中央
    [0.68, 0.39, 0.17, 0.09, -0.01], // 後半の絞り
    [0.84, 0.27, 0.11, 0.06, -0.01], // 後部
    [0.95, 0.12, 0.05, 0.03, -0.02], // 後端縁
    [1.00, 0.01, 0.01, 0.01, -0.02],
  ];

  const rings = 40;
  const segs = 36;
  const sPos = [];
  const sCol = [];
  const sIdx = [];

  for (let i = 0; i <= rings; i++) {
    const u = i / rings;
    const [rx, topY, botY, cy] = interpolate(SHELL_PROFILE, u);
    const z = zShell(u);

    for (let s = 0; s < segs; s++) {
      const th = (s / segs) * Math.PI * 2;
      const cosT = Math.cos(th);
      const sinT = Math.sin(th);

      // 縁甲板（Marginal rim: |cosT| > 0.85 でわずかに外側へフレアするリアルな甲羅の縁）
      const rimFlare = smooth(0.82, 0.98, Math.abs(cosT)) * (1 - Math.abs(sinT));
      const x = cosT * (rx + 0.025 * rimFlare * smooth(0.08, 0.2, u) * (1 - smooth(0.88, 0.98, u)));

      let y;
      if (sinT >= 0) {
        // 背甲ドーム＋盾板（Scutes）のわずかな立体凹凸
        const dome = Math.pow(sinT, 0.78) * topY;
        y = cy + dome + 0.008 * rimFlare;
      } else {
        // 平らな腹甲（Plastron）
        y = cy - Math.pow(-sinT, 0.55) * botY;
      }
      sPos.push(x, y, z);

      // 甲羅のべっ甲・盾板（Scute）模様カラーリング
      if (sinT >= -0.05) {
        // 背甲：中央の椎甲板（5枚）と左右の肋甲板（4対）の幾何学模様
        const absX = Math.abs(x) / Math.max(0.05, rx);
        if (absX > 0.86) {
          // 縁甲板（Marginal scutes）の継ぎ目と明るい縁
          const mSeam = Math.pow(Math.max(0, Math.sin(u * Math.PI * 11.0)), 8.0);
          tempCol.copy(cRim).lerp(cDarkBrown, mSeam * 0.75);
        } else {
          // 椎甲板（absX < 0.28）と肋甲板（absX >= 0.28）の六角形タイル模様
          const isCentral = absX < 0.28;
          const scuteU = isCentral ? u * 5.0 : u * 4.2 + 0.25;
          const distSeamU = Math.abs(scuteU - Math.round(scuteU));
          const distSeamX = Math.abs(absX - 0.28);
          const seam = Math.max(
            1 - smooth(0.02, 0.08, distSeamU),
            1 - smooth(0.015, 0.055, distSeamX)
          );
          // 각盾板の中心から放射状に広がるべっ甲のアンバー＆オリーブ模様
          const radial = Math.sin(scuteU * Math.PI) * (1 - seam);
          tempCol.copy(cOlive).lerp(cAmber, radial * 0.75);
          tempCol.lerp(cDarkBrown, seam * 0.85 + (1 - radial) * 0.35);
        }
      } else {
        // 腹甲：温かみのあるアイボリークリーム
        tempCol.copy(cPlastron).lerp(cRim, smooth(-0.4, -0.05, sinT) * 0.5);
      }
      sCol.push(tempCol.r, tempCol.g, tempCol.b);
    }
  }

  for (let i = 0; i < rings; i++) {
    const rA = i * segs, rB = (i + 1) * segs;
    for (let s = 0; s < segs; s++) {
      const nS = (s + 1) % segs;
      sIdx.push(rA + s, rB + s, rA + nS, rA + nS, rB + s, rB + nS);
    }
  }

  const shellGeo = new THREE.BufferGeometry();
  shellGeo.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
  shellGeo.setAttribute('color', new THREE.Float32BufferAttribute(sCol, 3));
  shellGeo.setIndex(sIdx);
  shellGeo.computeVertexNormals();

  const turtleMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.36,
    metalness: 0.08,
  });
  group.add(new THREE.Mesh(shellGeo, turtleMat));

  // --- 2. 頭部＆首（丸みのあるウミガメの頭＋くちばし＋つぶらな瞳） ---
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.0, 0.48);
  group.add(headGroup);

  const headGeo = buildHydrofoilGeometry({
    spanSegs: 16,
    chordSegs: 20,
    stationFn: (v) => {
      // v=0(首の根元 z=-0.04) .. v=1(吻端 z=+0.30)
      const z = -0.04 + v * 0.34;
      const w = 0.105 * Math.sin(Math.pow(v, 0.65) * Math.PI * 0.94) + 0.012 * (1 - v);
      const h = 0.092 * Math.sin(Math.pow(v, 0.60) * Math.PI * 0.94) + 0.010 * (1 - v);
      const y = 0.015 * Math.sin(v * Math.PI) - 0.015 * Math.pow(v, 2);
      return {
        lead: [0, y + h, z],
        trail: [0, y - h * 0.85, z],
        thick: w,
        up: [1, 0, 0],
      };
    },
    colorFn: (v, c) => {
      const scalePattern = Math.sin(v * 28.0) * Math.cos(c * 22.0);
      const col = new THREE.Color().copy(cSkin);
      if (c > 0.68) col.lerp(cPlastron, 0.65);
      else if (scalePattern > 0.25) col.lerp(cAmber, 0.35);
      else col.lerp(cDarkBrown, 0.3);
      return col;
    },
  });
  headGroup.add(new THREE.Mesh(headGeo, turtleMat));

  const eyeGeo = new THREE.SphereGeometry(0.018, 12, 10);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x050708, roughness: 0.08, metalness: 0.85 });
  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side * 0.082, 0.022, 0.19);
    eye.scale.set(0.65, 1.0, 1.15);
    headGroup.add(eye);
  });

  // --- 3. 長い翼状の前脚（Front Flippers: 水中を飛ぶ3Dハイドロフォイル翼） ---
  const frontFlipperGeo = buildHydrofoilGeometry({
    spanSegs: 22,
    chordSegs: 18,
    stationFn: (v) => {
      const span = v * 0.78;
      // 前縁は緩やかに前へ張り出してから後方へ大きくスイープ
      const sweepZ = Math.sin(v * Math.PI * 0.55) * 0.06 - Math.pow(v, 1.45) * 0.34;
      const chord = 0.21 * Math.pow(1 - Math.pow(v, 1.55) * 0.88, 0.6);
      const camberY = -Math.sin(v * Math.PI * 0.8) * 0.03;
      const thick = 0.025 * (1 - Math.pow(v, 0.9) * 0.86);
      return {
        lead: [span, camberY, 0.08 + sweepZ],
        trail: [span, camberY, 0.08 + sweepZ - chord],
        thick,
        up: [0, 1, 0],
      };
    },
    colorFn: (v, c, sinP) => {
      const col = new THREE.Color();
      if (sinP < -0.15) {
        return col.copy(cPlastron).lerp(cSkin, smooth(0.6, 0.95, c) * 0.5);
      }
      // 上面：前縁に沿って並ぶウミガメ特有の大きな鱗模様
      const scute = Math.sin(v * 34.0) * Math.cos(c * 18.0);
      col.copy(cSkin).lerp(cDarkBrown, scute > 0.15 ? 0.45 : 0.0);
      if (c < 0.18) col.lerp(cRim, 0.55);
      return col;
    },
  });

  const frontPivots = [];
  [-1, 1].forEach((side) => {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(frontFlipperGeo, turtleMat);
    mesh.scale.set(side, 1, 1);
    pivot.add(mesh);
    pivot.position.set(side * 0.34, -0.02, 0.28);
    group.add(pivot);
    frontPivots.push({ pivot, side });
  });

  // --- 4. 後脚（Rear Flippers: 舵を取る丸みのあるパドル） ---
  const rearFlipperGeo = buildHydrofoilGeometry({
    spanSegs: 12,
    chordSegs: 14,
    stationFn: (v) => {
      const span = v * 0.28;
      const z = -v * 0.24;
      const chord = 0.15 * Math.sin(Math.pow(v, 0.6) * Math.PI * 0.92) + 0.04 * (1 - v);
      return {
        lead: [span * 0.75, -v * 0.03, z],
        trail: [span * 0.75, -v * 0.03, z - chord],
        thick: 0.016 * (1 - v * 0.8),
        up: [0, 1, 0],
      };
    },
    colorFn: () => cSkin,
  });

  const rearPivots = [];
  [-1, 1].forEach((side) => {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(rearFlipperGeo, turtleMat);
    mesh.scale.set(side, 1, 1);
    pivot.add(mesh);
    pivot.position.set(side * 0.22, -0.03, -0.50);
    pivot.rotation.set(-0.12, -side * 0.35, -side * 0.18);
    group.add(pivot);
    rearPivots.push({ pivot, side });
  });

  // --- ウミガメ特有の「水中飛行（前脚の優雅な8の字羽ばたき）」アニメーション ---
  let phase = Math.random() * Math.PI * 2;
  function animate(dt, speed = 1.6, yawRate = 0) {
    phase += dt * (1.8 + speed * 0.45);
    // 前脚の羽ばたき：上下フラップ＋打ち下ろしで前縁を下げるフェザリング＋前後スイープ
    const flap = Math.sin(phase) * 0.54;
    const featherPitch = Math.cos(phase) * 0.28;
    const sweep = Math.cos(phase) * 0.16;

    for (const { pivot, side } of frontPivots) {
      pivot.rotation.set(
        -0.10 + featherPitch,
        side * (0.12 + sweep),
        -side * 0.18 + side * flap
      );
    }

    // 羽ばたきに連動する頭部の穏やかな頷き
    headGroup.rotation.x = Math.sin(phase - 0.7) * 0.08;
    headGroup.rotation.y = -yawRate * 0.25;

    // 後脚の舵取り
    for (const { pivot, side } of rearPivots) {
      pivot.rotation.z = -side * 0.18 + Math.sin(phase * 0.5 + side) * 0.10 - yawRate * 0.2;
    }
  }

  return { group, flukeGroup: null, animate };
}

// ==============================================================================
// 5. マンボウ（Ocean Sunfish / Mola mola） — Claude 改修版（2026-11-09）
// ==============================================================================
// creatures_models.js の createSunfish を、この中身でまるごと置き換える想定。
// smooth / buildHydrofoilGeometry は creatures_models.js にあるものをそのまま使う。
//
// 直したところ（くわしくは同じフォルダの「Geminiへの手紙.md」）
//   1. 輪郭の補間を smoothstep から「表の点を通る単調 3 次曲線」（makeCurve）に変えた。
//      smoothstep は表の点ごとに傾きが 0 になるので、輪郭が点ごとに段々の「こぶ」になっていた
//   2. 形を「後ろがスパッと切れた円盤」にした。体の高さは後端までほとんど落とさず、
//      最後は縦に長い薄い舵びれ（クラバス）で終わる。一点に閉じない
//   3. 背びれ・臀びれを体の一番後ろ（舵びれのすぐ前）へ移した
//   4. 形への足し込み（目の上の盛り上がり、全周の波打ち）をやめた。波打ちは舵びれの後ろの縁だけ
//   5. 斑紋をやめ、銀灰色のなだらかな濃淡だけにした。白目もやめて、目は控えめに

export function createSunfish() {
  const group = new THREE.Group();
  const length = 2.35;              // 口先から舵びれの後ろの縁まで（m）
  const PIVOT_U = 0.45;
  const zAt = (u) => length * (PIVOT_U - u);

  // 横から見た輪郭と厚み。[u, 背側の高さ, 腹側の深さ, 半分の厚み]（m）
  // ・口は小さく丸く、額はほぼ垂直に立ち上がる（横から見るとほぼ円盤）
  // ・体高は真ん中で最大（上下 1.87m、体長の約 0.8 倍）になり、上下の輪郭はなだらかな弧を描いて、後端でも最大の 7 割ほどの高さが残る（後ろがスパッと切れた円盤）
  // ・u > 0.91 は舵びれ（クラバス）：高さは残したまま、厚みだけ薄いフリルになる
  const PROFILE = [
    [0.00, 0.05, 0.05, 0.04],
    [0.02, 0.24, 0.23, 0.10],
    [0.06, 0.52, 0.50, 0.17],
    [0.12, 0.74, 0.71, 0.22],
    [0.24, 0.89, 0.86, 0.27],
    [0.44, 0.95, 0.92, 0.29],
    [0.62, 0.91, 0.88, 0.27],
    [0.76, 0.84, 0.81, 0.22],
    [0.86, 0.77, 0.74, 0.15],
    [0.92, 0.73, 0.70, 0.08],
    [0.96, 0.71, 0.68, 0.035],
    [1.00, 0.69, 0.66, 0.02],
  ];
  const getProfile = (u) => { const [topH, botH, rx] = interpolate(PROFILE, u); return { topH, botH, rx }; };

  const rings = 64;
  const segs = 40;                  // 偶数（後ろの縁を左右で閉じるため）
  const ringU = new Float32Array(rings + 1);
  const positions = [];
  const colors = [];
  const indices = [];

  const cBack = new THREE.Color(0x56687a);    // 背：青みのある鉛色
  const cSide = new THREE.Color(0xb7c2ca);    // 体側：くすんだ銀白
  const cBelly = new THREE.Color(0xd8e0e5);   // 腹：明るい銀白
  const cClavus = new THREE.Color(0x7d8c98);  // 舵びれ：少し濃い灰
  const cRim = new THREE.Color(0xd3dbe0);     // 舵びれの縁：白っぽい
  const cGill = new THREE.Color(0x3c4955);    // えら孔
  const col = new THREE.Color();

  for (let i = 0; i <= rings; i++) {
    // 輪の間隔は、形が急に変わる口先と後端ほど細かく
    const u = 0.5 - 0.5 * Math.cos((i / rings) * Math.PI);
    ringU[i] = u;
    const { topH, botH, rx } = getProfile(u);
    for (let s = 0; s < segs; s++) {
      const th = (s / segs) * Math.PI * 2;
      const cosT = Math.cos(th), sinT = Math.sin(th);
      // 断面は左右に薄い楕円（上下で高さだけ変える。べき乗などで歪めない）
      const x = cosT * rx;
      const y = sinT * (sinT >= 0 ? topH : botH);
      let z = zAt(u);
      // 舵びれの後ろの縁だけ、上下に 5 つほどの丸い波（フリル）を付ける
      if (u > 0.93) z -= 0.045 * (0.5 - 0.5 * Math.cos(sinT * Math.PI * 5)) * smooth(0.93, 1.0, u);
      positions.push(x, y, z);

      // 色：背は鉛色、体側から腹へ銀白。なだらかな大きい濃淡だけ（細かい斑紋は付けない）
      col.copy(cSide).lerp(cBack, smooth(0.25, 0.9, sinT)).lerp(cBelly, smooth(-0.3, -0.85, sinT));
      col.multiplyScalar(1 + 0.035 * Math.sin(u * 5.0 + sinT * 1.7));
      if (u > 0.86) col.lerp(cClavus, smooth(0.86, 0.94, u) * 0.6);
      if (u > 0.975) col.lerp(cRim, smooth(0.975, 1.0, u) * 0.7);
      if (u < 0.02) col.lerp(cBelly, 0.5); // 口のまわりは白っぽい
      // えら孔：胸びれのすぐ前の、小さな暗い楕円
      const gill = Math.exp(-((u - 0.255) ** 2) / 0.00025 - ((sinT - 0.02) ** 2) / 0.006) * smooth(0.6, 0.9, Math.abs(cosT));
      col.lerp(cGill, gill * 0.8);
      colors.push(col.r, col.g, col.b);
    }
  }

  for (let i = 0; i < rings; i++) {
    const rA = i * segs, rB = (i + 1) * segs;
    for (let s = 0; s < segs; s++) {
      const nS = (s + 1) % segs;
      indices.push(rA + s, rB + s, rA + nS, rA + nS, rB + s, rB + nS);
    }
  }

  // 口先と後ろの縁のふた。向きを気にしなくて済むよう表裏両方の三角形を張るが、
  // 表裏が打ち消し合って法線が壊れないよう、法線は胴体だけで計算してから、ふたを足す
  const capIdx = [];
  // 口先：小さな丸い口なので、中心の一点へ閉じる
  const tipIdx = positions.length / 3;
  positions.push(0, 0, zAt(0) + 0.012);
  colors.push(cBelly.r * 0.8, cBelly.g * 0.8, cBelly.b * 0.8);
  for (let s = 0; s < segs; s++) {
    const nS = (s + 1) % segs;
    capIdx.push(tipIdx, s, nS, tipIdx, nS, s);
  }

  // 後ろの縁：一点に絞らず、右側と左側の頂点どうしを縫い合わせて閉じる（舵びれが薄い縦の縁のまま終わる）
  const endRow = rings * segs, Q = segs / 4;
  const mirror = (s) => (((segs / 2 - s) % segs) + segs) % segs; // 左右反対側の頂点
  for (let k = -Q; k < Q; k++) {
    const a = endRow + ((k + segs) % segs), b = endRow + ((k + 1 + segs) % segs);
    const c = endRow + mirror((k + segs) % segs), d = endRow + mirror((k + 1 + segs) % segs);
    capIdx.push(a, b, c, b, d, c, a, c, b, b, c, d);
  }

  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  bodyGeo.setIndex(indices);
  bodyGeo.computeVertexNormals();
  bodyGeo.attributes.normal.setXYZ(tipIdx, 0, 0, 1); // 口先の一点は前向き
  bodyGeo.setIndex(indices.concat(capIdx));
  const basePos = new Float32Array(positions);

  const sunfishMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.08 });
  group.add(new THREE.Mesh(bodyGeo, sunfishMat));

  // --- 背びれ・臀びれ：体の一番後ろ（舵びれのすぐ前）に、上下へ高くそびえる ---
  // 付け根の前後の長さ約 0.5m、体の縁からの高さ約 1.2m。先端は丸く、少し後ろへ流れる
  const finU = 0.80;
  const { topH: fTop, botH: fBot } = getProfile(finU);
  const makeTallFinGeo = (dirY, height) => buildHydrofoilGeometry({
    spanSegs: 24,
    chordSegs: 18,
    stationFn: (v) => {
      const y = dirY * (-0.10 + v * height);
      const lead = 0.25 - 0.22 * Math.pow(v, 1.3);
      const chord = 0.5 * (1 - 0.5 * v) * Math.sqrt(Math.max(0, 1 - Math.pow(v, 4))) + 0.03;
      return { lead: [0, y, lead], trail: [0, y, lead - chord], thick: 0.065 * (1 - 0.75 * v), up: [1, 0, 0] };
    },
    colorFn: (v) => new THREE.Color().copy(cSide).lerp(cBack, 0.55 + 0.35 * smooth(0.2, 1.0, v)),
  });
  const dorsalPivot = new THREE.Group();
  dorsalPivot.position.set(0, fTop * 0.9, zAt(finU));
  dorsalPivot.add(new THREE.Mesh(makeTallFinGeo(1, 1.25), sunfishMat));
  group.add(dorsalPivot);
  const analPivot = new THREE.Group();
  analPivot.position.set(0, -fBot * 0.9, zAt(finU));
  analPivot.add(new THREE.Mesh(makeTallFinGeo(-1, 1.18), sunfishMat));
  group.add(analPivot);

  // --- 胸びれ：えら孔のすぐ後ろの、小さく丸いひれ ---
  const pecU = 0.29;
  const { rx: pecRX } = getProfile(pecU);
  const pecGeo = buildHydrofoilGeometry({
    spanSegs: 10,
    chordSegs: 14,
    stationFn: (v) => {
      const span = v * 0.2;
      const chord = 0.13 * Math.sqrt(Math.max(0, 1 - Math.pow(v, 3))) + 0.02;
      return { lead: [span, 0, 0.04 - v * 0.05], trail: [span, 0, 0.04 - v * 0.05 - chord], thick: 0.012 * (1 - 0.7 * v), up: [0, 1, 0] };
    },
    colorFn: () => cClavus,
  });
  const pecPivots = [];
  [-1, 1].forEach((side) => {
    const pivot = new THREE.Group();
    const m = new THREE.Mesh(pecGeo, sunfishMat);
    m.scale.set(side, 1, 1);
    pivot.add(m);
    pivot.position.set(side * pecRX * 0.95, 0.0, zAt(pecU));
    pivot.rotation.set(0.15, side * 0.4, -side * 0.1);
    group.add(pivot);
    pecPivots.push({ pivot, side });
  });

  // --- 目：口の少し上。白目は付けず、体の色に溶ける暗い目と、うっすら明るい縁 ---
  const eyeU = 0.10, eyeY = 0.16;
  const { topH: eTop, rx: eRX } = getProfile(eyeU);
  const eyeX = eRX * Math.sqrt(Math.max(0, 1 - (eyeY / eTop) ** 2));
  const ringGeo = new THREE.SphereGeometry(0.04, 16, 12);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x9aa7b1, roughness: 0.5 });
  const eyeGeo = new THREE.SphereGeometry(0.03, 16, 12);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1b232b, roughness: 0.2, metalness: 0.3 });
  [-1, 1].forEach((side) => {
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(side * eyeX * 0.97, eyeY, zAt(eyeU));
    ring.scale.set(0.3, 1, 1);
    group.add(ring);
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side * (eyeX * 0.97 + 0.006), eyeY, zAt(eyeU));
    eye.scale.set(0.35, 1, 1);
    group.add(eye);
  });

  // --- 動き：背びれと臀びれを同じ側へそろえてゆったりあおぎ（スカリング）、体の後ろが少ししなる ---
  let phase = Math.random() * Math.PI * 2;
  const ringDX = new Float32Array(rings + 1);
  function animate(dt, speed = 1.0) {
    phase += dt * (1.6 + speed * 0.5);
    const scull = Math.sin(phase) * 0.42;
    const twist = Math.cos(phase) * 0.18;
    dorsalPivot.rotation.set(0, twist, -scull);
    analPivot.rotation.set(0, -twist, scull);

    for (let i = 0; i <= rings; i++) {
      const rearEnv = Math.pow(smooth(0.55, 1.0, ringU[i]), 1.4);
      ringDX[i] = -Math.sin(phase - 1.0 * rearEnv) * 0.045 * rearEnv;
    }
    const pos = bodyGeo.attributes.position.array;
    for (let i = 0; i <= rings; i++) {
      for (let s = 0; s < segs; s++) {
        const k = i * segs + s;
        pos[k * 3] = basePos[k * 3] + ringDX[i];
      }
    }
    bodyGeo.attributes.position.needsUpdate = true;

    const fi = Math.round((Math.acos(1 - 2 * finU) / Math.PI) * rings); // finU に一番近い輪（輪の間隔が不均一なので逆算）
    dorsalPivot.position.x = analPivot.position.x = ringDX[fi];
    for (const { pivot, side } of pecPivots) pivot.rotation.y = side * (0.4 + Math.sin(phase * 2.0) * 0.25);
  }

  return { group, flukeGroup: null, animate };
}
