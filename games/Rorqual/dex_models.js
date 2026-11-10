import * as THREE from 'three';

/**
 * 図鑑（Field Guide）用の3Dプレビューモデル群
 * - 小魚7種：それぞれの体型・体色・模様（マイワシの七つ星、サバの唐草模様、ハダカイワシの発光器など）を
 *   再現した3Dメッシュによる「生き生きと群れて泳ぐ魚群（ロング〜ミディアムショット）」
 * - ナンキョクオキアミ：海中でゆらめく赤橙色の濃密なオキアミの群れ（スウォーム）＋立体個体
 * - オオミズナギドリ：海面近くを旋回滑空する海鳥の群れ
 */

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// ============================================================================
// 1. 小魚7種（精密な魚体メッシュによる「群れ（School）」プレビュー）
// ============================================================================
const DEX_FISH_SPECS = {
  sandlance: {
    // イカナゴ：細長い槍状のスマートな体、長い背びれ、突き出た下あご
    len: 1.55, rx: 0.08, ry: 0.11, jawOut: 0.04,
    dorsalStart: 0.20, dorsalEnd: 0.84, dorsalH: 0.08,
    backCol: 0x3b6378, sideCol: 0xd0dfe8, bellyCol: 0xf4f8fa,
    stripeCol: 0x8fb8cc, pattern: 'lance', count: 22, spread: [2.2, 0.9, 1.6],
  },
  capelin: {
    // カラフトシシャモ：オリーブがかった銀色、背びれ後ろの脂びれ
    len: 1.45, rx: 0.11, ry: 0.17, jawOut: 0.015,
    dorsalStart: 0.44, dorsalEnd: 0.58, dorsalH: 0.15, adipose: true,
    backCol: 0x46634d, sideCol: 0xc2d4c8, bellyCol: 0xf2f6f2,
    stripeCol: 0x8ea892, pattern: 'capelin', count: 20, spread: [2.1, 0.95, 1.6],
  },
  herring: {
    // ニシン：体高があり左右に平たい銀青色の立派な魚体
    len: 1.65, rx: 0.13, ry: 0.26, jawOut: 0.015,
    dorsalStart: 0.42, dorsalEnd: 0.56, dorsalH: 0.19,
    backCol: 0x1e486e, sideCol: 0xa8c6dc, bellyCol: 0xf5f9fc,
    stripeCol: 0x5c8eb8, pattern: 'herring', count: 16, spread: [2.3, 1.0, 1.7],
  },
  anchovy: {
    // カタクチイワシ：緊密なベイトボール、体側に鮮やかな青銀色の縦帯
    len: 1.40, rx: 0.10, ry: 0.17, jawOut: -0.035,
    dorsalStart: 0.43, dorsalEnd: 0.56, dorsalH: 0.15,
    backCol: 0x1b5678, sideCol: 0xb8d8ec, bellyCol: 0xf4f8fb,
    stripeCol: 0x4ca6dc, pattern: 'anchovy', count: 24, spread: [1.8, 0.85, 1.4],
  },
  sardine: {
    // マイワシ：エメラルドグリーンの背と、体側に並ぶ7つの黒点（七つ星）
    len: 1.55, rx: 0.13, ry: 0.24, jawOut: 0.01,
    dorsalStart: 0.40, dorsalEnd: 0.55, dorsalH: 0.18,
    backCol: 0x1d625c, sideCol: 0xbce0da, bellyCol: 0xf6faf8,
    stripeCol: 0x3b8c84, pattern: 'sardine', count: 18, spread: [2.1, 0.95, 1.6],
  },
  mackerel: {
    // サバ：紡錘形のたくましい体、背中の特徴的な唐草模様（サバ模様）
    len: 1.70, rx: 0.16, ry: 0.26, jawOut: 0.0,
    dorsalStart: 0.34, dorsalEnd: 0.48, dorsalH: 0.18, secondDorsal: true,
    backCol: 0x145064, sideCol: 0xc4dce2, bellyCol: 0xf7fbfc,
    stripeCol: 0x0a2230, pattern: 'mackerel', count: 14, spread: [2.3, 1.0, 1.7],
  },
  lanternfish: {
    // ハダカイワシ：大きな目、腹側〜体側下部に並ぶ青白い発光器（Photophores）
    len: 1.40, rx: 0.12, ry: 0.22, jawOut: 0.0, bigEye: 1.45,
    dorsalStart: 0.40, dorsalEnd: 0.54, dorsalH: 0.17, adipose: true,
    backCol: 0x182a3e, sideCol: 0x6286a6, bellyCol: 0x9ab8d0,
    stripeCol: 0x74e8ff, pattern: 'lantern', count: 18, spread: [2.0, 0.9, 1.5],
  },
};

function buildFishTemplate(spec) {
  const len = spec.len;
  const rings = 28;
  const segs = 20;
  const positions = [];
  const colors = [];
  const indices = [];

  const cBack = new THREE.Color(spec.backCol);
  const cSide = new THREE.Color(spec.sideCol);
  const cBelly = new THREE.Color(spec.bellyCol);
  const cStripe = new THREE.Color(spec.stripeCol);
  const cDarkSpot = new THREE.Color(0x0c1820);
  const cGlow = new THREE.Color(0x7cf4ff);
  const tmp = new THREE.Color();

  const zAt = (u) => len * (0.46 - u);
  const profileAt = (u) => {
    const envY = Math.sin(Math.pow(u, 0.72) * Math.PI * 0.92);
    const envX = Math.sin(Math.pow(u, 0.68) * Math.PI * 0.94);
    const peduncle = 1 - 0.52 * smooth(0.72, 0.92, u);
    const ry = spec.ry * envY * peduncle + 0.012 * (1 - u);
    const rx = spec.rx * envX * peduncle * (1 - 0.3 * smooth(0.75, 0.95, u)) + 0.008 * (1 - u);
    return { rx, ry };
  };

  for (let i = 0; i <= rings; i++) {
    const u = i / rings;
    const { rx, ry } = profileAt(u);
    let z = zAt(u);

    for (let s = 0; s < segs; s++) {
      const th = (s / segs) * Math.PI * 2;
      const cosT = Math.cos(th);
      const sinT = Math.sin(th);

      const gillbulge = 1 + 0.06 * Math.exp(-((u - 0.21) ** 2) / 0.0008) * (1 - Math.abs(sinT) * 0.5);
      const x = cosT * rx * gillbulge;
      const y = sinT * ry;

      if (u < 0.08) {
        const tipEnv = 1 - smooth(0.0, 0.08, u);
        if (sinT < 0) z += spec.jawOut * tipEnv * (-sinT);
        else z -= spec.jawOut * 0.5 * tipEnv * sinT;
      }
      positions.push(x, y, z);

      if (sinT > 0.15) {
        tmp.copy(cSide).lerp(cBack, smooth(0.15, 0.65, sinT));
      } else if (sinT > -0.35) {
        tmp.copy(cBelly).lerp(cSide, smooth(-0.35, 0.15, sinT));
      } else {
        tmp.copy(cBelly);
      }

      if (u > 0.18 && u < 0.92) {
        const band = Math.exp(-((sinT - 0.08) ** 2) / 0.025);
        tmp.lerp(cStripe, band * (spec.pattern === 'anchovy' ? 0.85 : 0.35));
      }
      if (spec.pattern === 'sardine' && u > 0.24 && u < 0.76 && Math.abs(sinT - 0.05) < 0.22) {
        const spotPhase = (u - 0.24) / 0.52 * 7.0;
        const spotDist = Math.hypot((spotPhase - Math.floor(spotPhase) - 0.5) * 0.45, (sinT - 0.04) * 1.8);
        if (spotDist < 0.14) tmp.lerp(cDarkSpot, (1 - smooth(0.05, 0.14, spotDist)) * 0.88);
      }
      if (spec.pattern === 'mackerel' && sinT > 0.05 && u > 0.18 && u < 0.88) {
        const wave = Math.sin(u * 95.0 + Math.sin(sinT * 9.0 + u * 25.0) * 2.2);
        const mask = smooth(0.05, 0.28, sinT) * smooth(0.18, 0.24, u) * (1 - smooth(0.82, 0.88, u));
        if (wave > 0.1) tmp.lerp(cStripe, smooth(0.1, 0.6, wave) * mask * 0.82);
      }
      if (spec.pattern === 'lantern' && u > 0.12 && u < 0.88 && sinT < -0.05 && sinT > -0.78) {
        const row1 = Math.abs(sinT + 0.28) < 0.09;
        const row2 = Math.abs(sinT + 0.58) < 0.09;
        if (row1 || row2) {
          const ph = (u - 0.12) * 22.0 + (row2 ? 0.5 : 0);
          const d = Math.abs(ph - Math.round(ph));
          if (d < 0.22) tmp.lerp(cGlow, (1 - smooth(0.06, 0.22, d)) * 0.95);
        }
      }
      colors.push(tmp.r, tmp.g, tmp.b);
    }
  }

  for (let i = 0; i < rings; i++) {
    const rA = i * segs, rB = (i + 1) * segs;
    for (let s = 0; s < segs; s++) {
      const nS = (s + 1) % segs;
      indices.push(rA + s, rB + s, rA + nS, rA + nS, rB + s, rB + nS);
    }
  }
  const tipIdx = positions.length / 3;
  positions.push(0, 0, zAt(0) + 0.015);
  colors.push(cBack.r, cBack.g, cBack.b);
  for (let s = 0; s < segs; s++) indices.push(tipIdx, s, (s + 1) % segs);

  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  bodyGeo.setIndex(indices);
  bodyGeo.computeVertexNormals();

  const bodyMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.22,
    metalness: 0.42,
  });

  const finCol = new THREE.Color(spec.backCol).lerp(new THREE.Color(spec.sideCol), 0.55);
  const finMat = new THREE.MeshStandardMaterial({
    color: finCol,
    roughness: 0.35,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });

  // 背びれ
  const dShape = new THREE.Shape();
  const dz0 = zAt(spec.dorsalStart), dz1 = zAt(spec.dorsalEnd);
  const dLen = dz0 - dz1;
  dShape.moveTo(0, 0);
  dShape.bezierCurveTo(dLen * 0.15, spec.dorsalH * 0.9, dLen * 0.35, spec.dorsalH, dLen * 0.45, spec.dorsalH * 0.95);
  dShape.lineTo(dLen, spec.dorsalH * (spec.pattern === 'lance' ? 0.75 : 0.18));
  dShape.lineTo(dLen, 0);
  dShape.closePath();
  const dGeo = new THREE.ExtrudeGeometry(dShape, { depth: 0.008, bevelEnabled: false });
  dGeo.translate(0, -0.015, -0.004);
  dGeo.rotateY(Math.PI / 2);

  // V字尾びれ
  const tShape = new THREE.Shape();
  tShape.moveTo(0, 0.02);
  tShape.bezierCurveTo(0.09, 0.10, 0.19, 0.19, 0.27, 0.21);
  tShape.bezierCurveTo(0.21, 0.10, 0.15, 0.04, 0.12, 0.0);
  tShape.bezierCurveTo(0.15, -0.04, 0.21, -0.10, 0.27, -0.21);
  tShape.bezierCurveTo(0.19, -0.19, 0.09, -0.10, 0, -0.02);
  tShape.closePath();
  const tGeo = new THREE.ExtrudeGeometry(tShape, { depth: 0.008, bevelEnabled: false });
  tGeo.translate(0, 0, -0.004);
  tGeo.rotateY(Math.PI / 2);

  // 目
  const eyeU = 0.12;
  const { rx: eRx, ry: eRy } = profileAt(eyeU);
  const eyeScale = spec.bigEye ?? 1.0;
  const eyeGeo = new THREE.SphereGeometry(0.022 * eyeScale, 10, 8);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x05080c, roughness: 0.08 });

  const dMidU = (spec.dorsalStart + spec.dorsalEnd) * 0.5;
  const dorsalPos = [0, profileAt(dMidU).ry * 0.88, dz0];
  const tailZ = zAt(0.98);
  const eyePos = [eRx * 0.92, eRy * 0.18, zAt(eyeU)];

  return { bodyGeo, bodyMat, dGeo, tGeo, finMat, eyeGeo, eyeMat, dorsalPos, tailZ, eyePos };
}

export function createDexFish(speciesId) {
  const spec = DEX_FISH_SPECS[speciesId] ?? DEX_FISH_SPECS.sandlance;
  const root = new THREE.Group();
  const tpl = buildFishTemplate(spec);

  const fishes = [];
  const count = spec.count ?? 18;
  const [sx, sy, sz] = spec.spread;

  // 黄金角フィボナッチ配置で自然かつ重ならない美しい群れ（ベイトボール〜編隊）を構成
  for (let i = 0; i < count; i++) {
    const fg = new THREE.Group();
    fg.add(new THREE.Mesh(tpl.bodyGeo, tpl.bodyMat));

    const dMesh = new THREE.Mesh(tpl.dGeo, tpl.finMat);
    dMesh.position.set(...tpl.dorsalPos);
    fg.add(dMesh);

    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0, tpl.tailZ);
    tailPivot.add(new THREE.Mesh(tpl.tGeo, tpl.finMat));
    fg.add(tailPivot);

    [-1, 1].forEach((side) => {
      const e = new THREE.Mesh(tpl.eyeGeo, tpl.eyeMat);
      e.position.set(side * tpl.eyePos[0], tpl.eyePos[1], tpl.eyePos[2]);
      e.scale.set(0.5, 1, 1);
      fg.add(e);
    });

    // i=0 は中央手前のリーダー個体、残りは群れとして周囲に立体配置
    let bx, by, bz, sc;
    if (i === 0) {
      bx = 0.0; by = 0.05; bz = 0.45; sc = 0.72;
    } else {
      const r = Math.pow(i / count, 0.65);
      const theta = i * 2.39996;
      const phi = ((i % 5) / 4 - 0.5) * 1.4;
      bx = Math.cos(theta) * r * sx;
      by = Math.sin(phi) * r * sy;
      bz = Math.sin(theta) * r * sz - 0.15;
      sc = 0.54 + (1 - r) * 0.14;
    }

    fg.scale.setScalar(sc);
    fg.position.set(bx, by, bz);
    root.add(fg);

    fishes.push({
      group: fg,
      tailPivot,
      bx, by, bz,
      phase: i * 0.85,
      speed: 5.5 + (i % 4) * 0.4,
    });
  }

  let time = 0;
  function animate(dt) {
    time += dt;
    for (const f of fishes) {
      const ph = time * f.speed + f.phase;
      // 群れ全体のゆったりしたうねり＋各個体の尾びれキックと頭のヨーイング
      f.group.position.x = f.bx + Math.sin(time * 0.9 + f.phase) * 0.08;
      f.group.position.y = f.by + Math.cos(time * 1.1 + f.phase * 0.7) * 0.06;
      f.group.rotation.y = Math.sin(ph) * 0.09 + Math.sin(time * 0.7 + f.phase) * 0.08;
      f.group.rotation.z = Math.cos(time * 0.8 + f.phase) * 0.04;
      f.tailPivot.rotation.y = -Math.cos(ph) * 0.36;
    }
  }

  return { group: root, animate };
}

// ============================================================================
// 2. ナンキョクオキアミ（ゲーム内同様の赤茶色の濃密なスウォーム群＋揺らめき）
// ============================================================================
export function createDexKrill() {
  const root = new THREE.Group();

  // ゲーム内のオキアミ群と同じ質感のソフトパーティクルで、濃密に渦巻くスウォームを表現
  const COUNT = 420;
  const positions = new Float32Array(COUNT * 3);
  const basePos = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const phases = new Float32Array(COUNT);
  const c = new THREE.Color();

  for (let i = 0; i < COUNT; i++) {
    // 楕円体状に自然に集まったオキアミの雲
    const u = Math.random();
    const r = Math.pow(u, 0.55) * 1.95;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    const x = r * Math.sin(ph) * Math.cos(th) * 1.25;
    const y = r * Math.cos(ph) * 0.68;
    const z = r * Math.sin(ph) * Math.sin(th) * 1.05;

    positions.set([x, y, z], i * 3);
    basePos.set([x, y, z], i * 3);
    phases[i] = Math.random() * Math.PI * 2;

    c.setHSL(0.01 + Math.random() * 0.04, 0.82, 0.44 + Math.random() * 0.16);
    colors.set([c.r, c.g, c.b], i * 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 1.0 } },
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    vertexShader: /* glsl */`
      varying vec3 vCol;
      void main() {
        vCol = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(32.0 / max(1.5, -mv.z), 4.0, 14.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vCol;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.12, d) * 0.88;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vCol, a);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  root.add(points);

  let time = 0;
  function animate(dt) {
    time += dt * 1.4;
    const arr = geo.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      const p = i * 3;
      const ph = phases[i];
      arr[p]     = basePos[p]     + Math.sin(time + ph) * 0.09;
      arr[p + 1] = basePos[p + 1] + Math.cos(time * 1.3 + ph) * 0.06;
      arr[p + 2] = basePos[p + 2] + Math.sin(time * 0.8 - ph) * 0.09;
    }
    geo.attributes.position.needsUpdate = true;
  }

  return { group: root, animate };
}

// ============================================================================
// 3. オオミズナギドリ（旋回滑空する海鳥の編隊）
// ============================================================================
export function createDexShearwater() {
  const root = new THREE.Group();

  const cDarkBrown = new THREE.Color(0x3b332d);
  const cWingTip = new THREE.Color(0x1c1815);
  const cWhite = new THREE.Color(0xf5f7f8);
  const cBill = new THREE.Color(0xc8be96);
  const tmp = new THREE.Color();

  // 胴体ジオメトリ
  const rings = 24, segs = 16, len = 1.15;
  const zAt = (u) => len * (0.48 - u);
  const pos = [], col = [], idx = [];
  for (let i = 0; i <= rings; i++) {
    const u = i / rings;
    let r, cy = 0;
    if (u < 0.14) { r = 0.012 + (u / 0.14) * 0.035; cy = 0.04; }
    else if (u < 0.32) { const h = (u - 0.14) / 0.18; r = 0.045 + Math.sin(h * Math.PI) * 0.05; cy = 0.04 + Math.sin(h * Math.PI) * 0.03; }
    else if (u < 0.82) { const b = (u - 0.32) / 0.50; r = 0.075 + Math.sin(b * Math.PI) * 0.10; cy = 0.02 - Math.sin(b * Math.PI) * 0.025; }
    else { const t = (u - 0.82) / 0.18; r = 0.065 * (1 - t * 0.7); cy = 0.01; }

    for (let s = 0; s < segs; s++) {
      const th = (s / segs) * Math.PI * 2;
      const wx = u > 0.82 ? 1.8 : 0.92;
      const wy = u > 0.82 ? 0.25 : 1.0;
      pos.push(Math.cos(th) * r * wx, cy + Math.sin(th) * r * wy, zAt(u));
      if (u < 0.14) tmp.copy(cBill);
      else if (Math.sin(th) > 0.10 && u > 0.18) tmp.copy(cWhite).lerp(cDarkBrown, smooth(0.10, 0.35, Math.sin(th)));
      else tmp.copy(cWhite);
      col.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (let i = 0; i < rings; i++) {
    const rA = i * segs, rB = (i + 1) * segs;
    for (let s = 0; s < segs; s++) {
      const nS = (s + 1) % segs;
      idx.push(rA + s, rB + s, rA + nS, rA + nS, rB + s, rB + nS);
    }
  }
  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  bodyGeo.setIndex(idx);
  bodyGeo.computeVertexNormals();

  // 翼ジオメトリ
  const spanSegs = 16, chordSegs = 10;
  const wPos = [], wCol = [], wIdx = [];
  for (let i = 0; i <= spanSegs; i++) {
    const v = i / spanSegs;
    const x = v * 1.12;
    const leadZ = Math.sin(v * Math.PI * 0.65) * 0.09 - Math.pow(v, 1.6) * 0.32;
    const chord = 0.26 * (1 - Math.pow(v, 1.35) * 0.86);
    const camberY = Math.sin(v * Math.PI * 0.7) * 0.035;
    for (let j = 0; j <= chordSegs; j++) {
      const phi = (j / chordSegs) * Math.PI * 2;
      const c = 0.5 * (1 - Math.cos(phi));
      const sinP = Math.sin(phi);
      const thick = 0.014 * (1 - v * 0.8) * sinP * (1 - c * 0.7);
      wPos.push(x, camberY + thick, leadZ - c * chord);
      if (sinP >= 0) tmp.copy(cDarkBrown).lerp(cWingTip, smooth(0.5, 0.95, v));
      else tmp.copy(cWhite).lerp(cDarkBrown, Math.min(1, (smooth(0.65, 0.95, c) + smooth(0.75, 0.98, v)) * 0.85));
      wCol.push(tmp.r, tmp.g, tmp.b);
    }
  }
  const stride = chordSegs + 1;
  for (let i = 0; i < spanSegs; i++) {
    const rA = i * stride, rB = (i + 1) * stride;
    for (let j = 0; j < chordSegs; j++) {
      wIdx.push(rA + j, rB + j, rA + j + 1, rA + j + 1, rB + j, rB + j + 1);
    }
  }
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3));
  wingGeo.setAttribute('color', new THREE.Float32BufferAttribute(wCol, 3));
  wingGeo.setIndex(wIdx);
  wingGeo.computeVertexNormals();

  const birdMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, side: THREE.DoubleSide });

  const flock = [
    { scale: 0.88, pos: [0, 0.0, 0.35], phase: 0 },
    { scale: 0.58, pos: [-1.15, 0.38, -0.75], phase: 1.6 },
    { scale: 0.52, pos: [1.10, 0.25, -0.95], phase: 3.2 },
    { scale: 0.45, pos: [-0.45, -0.35, -1.25], phase: 4.8 },
  ].map((cfg) => {
    const bGroup = new THREE.Group();
    bGroup.add(new THREE.Mesh(bodyGeo, birdMat));
    const wings = [-1, 1].map((side) => {
      const pv = new THREE.Group();
      const m = new THREE.Mesh(wingGeo, birdMat);
      m.scale.x = side;
      pv.add(m);
      pv.position.set(side * 0.11, 0.04, zAt(0.46));
      bGroup.add(pv);
      return { pv, side };
    });
    bGroup.scale.setScalar(cfg.scale);
    bGroup.position.set(...cfg.pos);
    root.add(bGroup);
    return { bGroup, wings, baseY: cfg.pos[1], phase: cfg.phase };
  });

  let t = 0;
  function animate(dt) {
    t += dt * 3.6;
    for (const b of flock) {
      const ph = t + b.phase;
      const cycle = ph % (Math.PI * 4);
      const flapEnv = cycle < Math.PI * 2 ? 1.0 : 0.15;
      const flap = Math.sin(ph * 2.0) * 0.34 * flapEnv;
      for (const w of b.wings) {
        w.pv.rotation.z = w.side * flap;
      }
      b.bGroup.position.y = b.baseY - flap * 0.06 + Math.sin(ph * 0.8) * 0.05;
      b.bGroup.rotation.z = Math.sin(ph * 0.6) * 0.18;
    }
  }

  return { group: root, animate };
}
