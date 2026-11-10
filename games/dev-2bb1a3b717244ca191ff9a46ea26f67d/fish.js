import * as THREE from 'three';

// えさの群れ（海域ごとに多彩な小魚・オキアミの組み合わせが出現）
// 簡単な群体モデル（集まる・ぶつからない・向きをそろえる・クジラから逃げる）
// 群れごとに魚種・数・密度・泳ぎ方が変わる：一口で食べきれる密なベイトボールから、大きく広がる大群まで
const PER_SCHOOL = 260; // 一つの群れに使える枠の上限
const SCHOOLS = 5;

// えさの魚種ごとの見た目・群れ規模・性質
export const FISH_SPECIES = {
  sandlance: {
    id: 'sandlance',
    dots: false,
    color: 0xd4e2e8,          // イカナゴ：明るく輝く銀白色
    scale: [0.72, 0.68, 1.05], // 細長いスマートな体型
    min: 55, max: 110, spread: 4.5,
    maxSpeed: 3.3, minSpeed: 0.6, cruise: 0.72, schoolMax: 1.5, flee: 1.0,
    spacing: 0.65, coh: 0.42,
    value: 0.11,
  },
  capelin: {
    id: 'capelin',
    dots: false,
    color: 0xbcd4c6,          // カラフトシシャモ（カペリン）：背が淡いオリーブグリーンの銀魚
    scale: [0.86, 0.85, 0.96],
    min: 100, max: 165, spread: 6.5,
    maxSpeed: 3.0, minSpeed: 0.55, cruise: 0.75, schoolMax: 1.55, flee: 0.95,
    spacing: 0.82, coh: 0.34,
    value: 0.13,
  },
  herring: {
    id: 'herring',
    dots: false,
    color: 0x94b8d2,          // ニシン：青みがかった深い銀色
    scale: [1.32, 1.48, 1.25], // 体高があり、幅も長さも一回り大きい
    min: 150, max: 220, spread: 14.0,
    maxSpeed: 2.8, minSpeed: 0.5, cruise: 0.85, schoolMax: 1.7, flee: 0.85,
    spacing: 1.35, coh: 0.20,
    value: 0.18,              // 食べごたえがある
  },
  anchovy: {
    id: 'anchovy',
    dots: false,
    color: 0x7cb8e2,          // カタクチイワシ：黒潮で青く煌めく銀色
    scale: [0.88, 0.86, 1.02],
    min: 75, max: 145, spread: 5.0,
    maxSpeed: 3.6, minSpeed: 0.7, cruise: 0.85, schoolMax: 1.8, flee: 1.1,
    spacing: 0.70, coh: 0.44, // 緊密なベイトボールを作る
    value: 0.12,
  },
  sardine: {
    id: 'sardine',
    dots: false,
    color: 0x8ad2c8,          // マイワシ：エメラルドグリーンがかった豊かな銀魚
    scale: [1.16, 1.26, 1.15],
    min: 130, max: 195, spread: 10.5,
    maxSpeed: 3.2, minSpeed: 0.6, cruise: 0.82, schoolMax: 1.7, flee: 0.95,
    spacing: 1.05, coh: 0.26,
    value: 0.16,
  },
  mackerel: {
    id: 'mackerel',
    dots: false,
    color: 0x66b2be,          // サバ：青緑色に輝くたくましい紡錘形
    scale: [1.38, 1.36, 1.32],
    min: 90, max: 150, spread: 12.0,
    maxSpeed: 4.1, minSpeed: 0.8, cruise: 1.05, schoolMax: 2.1, flee: 1.2,
    spacing: 1.25, coh: 0.24, // 素早く泳ぎ、1匹あたりの栄養価が高い
    value: 0.22,
  },
  lanternfish: {
    id: 'lanternfish',
    dots: false,
    color: 0x9ce2ff,          // ハダカイワシ：南極海や外洋中層で青白く淡く光る小魚
    scale: [0.82, 0.90, 0.85],
    min: 80, max: 140, spread: 6.0,
    maxSpeed: 2.6, minSpeed: 0.45, cruise: 0.65, schoolMax: 1.4, flee: 0.8,
    spacing: 0.78, coh: 0.36,
    value: 0.14,
  },
  krill: {
    id: 'krill',
    dots: true,
    color: 0xe8a596,          // ナンキョクオキアミ：赤茶色の霞のような大群
    scale: [1.0, 1.0, 1.0],
    min: 235, max: 260, spread: 16.0,
    maxSpeed: 0.35, minSpeed: 0.03, cruise: 0.12, schoolMax: 0.3, flee: 0,
    spacing: 1.25, coh: 0.06,
    value: 0.07,
  },
};

// 後方互換用
export const FOODS = FISH_SPECIES;

const DOTS = 12;           // オキアミ一匹（＝群れの一かたまり）を描く点の数
const LEFTOVER = 0.25;     // 元の数のこの割合より少なくなった群れは食べ残し。しばらくしたら消えて、遠くで補給
const LEFTOVER_WAIT = 6, FADE_TIME = 2;
const FAR = 70;            // これより遠い群れは消して、近くに出し直す

const _s = new THREE.Vector3(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const FWD = new THREE.Vector3(0, 0, 1), ZERO = new THREE.Vector3();
const _pingCol = new THREE.Color(), _defaultFishCol = new THREE.Color(0xc8dce6), _sonarHighlightCol = new THREE.Color(0xd0ffff);

/**
 * 小魚用の流線型3Dメッシュ（紡錘形の胴体＋二股に分かれたV字尾びれ＋背腹のカウンターシェーディング頂点カラー）
 * +Z が頭（進行方向）、-Z が尾びれ
 */
export function buildSmallFishGeometry() {
  // 断面リング [z, rx, ry]（細すぎず太すぎず、遠くからでも自然な小魚の群れとして視認できる中間サイズ）
  const stations = [
    [ 0.21, 0.003, 0.004], // 吻端
    [ 0.14, 0.032, 0.044], // 頭部
    [ 0.03, 0.048, 0.066], // 胴体最大幅・体高
    [-0.08, 0.031, 0.046], // 胴体後半
    [-0.15, 0.011, 0.019], // 尾柄（くびれ）
  ];
  const segs = 6;
  const positions = [];
  const colors = [];
  const indices = [];

  for (let i = 0; i < stations.length; i++) {
    const [z, rx, ry] = stations[i];
    for (let s = 0; s < segs; s++) {
      const th = (s / segs) * Math.PI * 2;
      const x = Math.cos(th) * rx;
      const y = Math.sin(th) * ry;
      positions.push(x, y, z);
      // 背側と体側の明暗差をほどよく残しつつ、見下ろし視点でも沈みすぎない明度
      const shade = Math.sin(th) > 0.22 ? 0.79 : 1.06;
      colors.push(shade, shade, shade);
    }
  }

  for (let i = 0; i < stations.length - 1; i++) {
    const rA = i * segs, rB = (i + 1) * segs;
    for (let s = 0; s < segs; s++) {
      const nS = (s + 1) % segs;
      indices.push(rA + s, rB + s, rA + nS, rA + nS, rB + s, rB + nS);
    }
  }

  // 二股の尾びれ（Forked tail fin: z = -0.15 から -0.24 へ上下に広がるV字）
  const baseIdx = positions.length / 3;
  const tailVerts = [
    [0,  0.014, -0.14], // 0: 尾柄上
    [0, -0.014, -0.14], // 1: 尾柄下
    [0,  0.064, -0.24], // 2: 上葉先端
    [0,  0.000, -0.18], // 3: 中央V字切れ込み
    [0, -0.064, -0.24], // 4: 下葉先端
  ];
  for (const [tx, ty, tz] of tailVerts) {
    positions.push(tx, ty, tz);
    colors.push(0.78, 0.78, 0.78);
  }
  indices.push(
    baseIdx + 0, baseIdx + 2, baseIdx + 3,
    baseIdx + 0, baseIdx + 3, baseIdx + 1,
    baseIdx + 1, baseIdx + 3, baseIdx + 4,
    // 裏面
    baseIdx + 0, baseIdx + 3, baseIdx + 2,
    baseIdx + 0, baseIdx + 1, baseIdx + 3,
    baseIdx + 1, baseIdx + 4, baseIdx + 3
  );

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export class FishSchools {
  constructor(scene, sea) {
    this.sea = sea;
    const n = PER_SCHOOL * SCHOOLS;
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.alive = new Uint8Array(n);
    this.schools = [];
    this.kindTurn = 0;

    const g = buildSmallFishGeometry();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      metalness: 0.45,
      roughness: 0.30,
      emissive: 0x16424d,
      emissiveIntensity: 0.28,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.InstancedMesh(g, mat, n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    // オキアミ用：一かたまりを DOTS 個の細かい点で描く
    const dp = new Float32Array(n * DOTS * 3).fill(-1000), dc = new Float32Array(n * DOTS * 3);
    this.dotOff = new Float32Array(n * DOTS * 3);
    const c = new THREE.Color();
    for (let k = 0; k < n * DOTS; k++) {
      this.dotOff.set([Math.random() - 0.5, (Math.random() - 0.5) * 0.4, Math.random() - 0.5], k * 3);
      c.setHSL(0.01 + Math.random() * 0.04, 0.82, 0.42 + Math.random() * 0.14); // 水中でも視認しやすい鮮やかなオキアミの赤橙〜赤茶
      dc.set([c.r, c.g, c.b], k * 3);
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    dg.setAttribute('color', new THREE.BufferAttribute(dc, 3));
    this.dotPx = { value: 2 };
    this.dots = new THREE.Points(dg, new THREE.ShaderMaterial({
      uniforms: { uPx: this.dotPx, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 } },
      transparent: true, depthWrite: false, vertexColors: true, fog: true,
      vertexShader: /* glsl */`
        uniform float uPx;
        varying vec3 vCol;
        #include <fog_pars_vertex>
        void main() {
          vCol = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(uPx * (62.0 / max(12.0, -mvPosition.z)), uPx * 1.15, uPx * 4.2);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vCol;
        #include <fog_pars_fragment>
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.18, d) * 0.88;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vCol, a);
          #include <fog_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    this.dots.frustumCulled = false;
    this.dots.visible = true;
    this.mesh.visible = true;
    scene.add(this.dots);

    this.areaFoods = ['sandlance', 'capelin', 'herring'];
    this.food = FISH_SPECIES.sandlance;
    this.Z = { S: 1, V: 1 };

    for (let s = 0; s < SCHOOLS; s++) {
      const a = (s / SCHOOLS) * Math.PI * 2 + Math.random();
      const d = 15 + s * 18 + Math.random() * 8;
      const school = {
        center: new THREE.Vector3(Math.sin(a) * d, this._randDepth(), Math.cos(a) * d),
        target: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        alive: 0,
      };
      this.schools.push(school);
      this._respawn(s, school.center);
    }
  }

  get layerY() { return this.sea.depth - 0.5 * this.Z.S; }

  setScale(Z) { this.Z = Z; }
  _randDepth() { return this.layerY + (Math.random() - 0.5) * 0.4; }

  _newTarget(school) {
    const a = Math.random() * Math.PI * 2, d = (6 + Math.random() * 12) * this.Z.V;
    school.target.set(school.center.x + Math.sin(a) * d, this._randDepth(), school.center.z + Math.cos(a) * d);
  }

  _respawn(s, center) {
    const school = this.schools[s];
    // 海域ごとのえさリスト（areaFoods）を順番に回して多彩な魚種を出現させる
    const spKey = this.areaFoods[this.kindTurn++ % this.areaFoods.length];
    const sp = FISH_SPECIES[spKey] ?? FISH_SPECIES.sandlance;
    school.species = sp;
    school.size = sp.min + Math.floor(Math.random() * (sp.max - sp.min + 1));
    school.spacing = sp.spacing * this.Z.V * (0.85 + Math.random() * 0.3);
    school.coh = sp.coh;
    school.center.copy(center);
    this._newTarget(school);

    const i0 = s * PER_SCHOOL;
    const baseCol = new THREE.Color(sp.color);
    const tmpCol = new THREE.Color();
    for (let i = i0; i < i0 + PER_SCHOOL; i++) {
      // まず前の魚種（メッシュまたはドット）の表示を確実にクリア
      this._hide(i);
      const on = i < i0 + school.size;
      this.alive[i] = on ? 1 : 0;
      if (!on) continue;

      const spread = sp.spread * this.Z.V;
      this.pos[i * 3] = center.x + (Math.random() - 0.5) * spread;
      this.pos[i * 3 + 1] = center.y + (Math.random() - 0.5) * 1.0;
      this.pos[i * 3 + 2] = center.z + (Math.random() - 0.5) * spread;
      this.vel.set([Math.random() - 0.5, 0, Math.random() - 0.5], i * 3);
      if (!sp.dots) {
        tmpCol.copy(baseCol).offsetHSL((Math.random() - 0.5) * 0.03, 0, (Math.random() - 0.5) * 0.08);
        this.mesh.setColorAt(i, tmpCol);
      }
    }
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
    school.baseColor = baseCol.clone();
    school.pingGlow = 0;
    school.alive = school.size;
    school.leftT = 0;
    school.fade = 1;
    school.broken = false;
  }

  // 吹鳴ソナー反響：音波リングが群れに届いたときに呼ばれ、群れ全体をキラッと発光させる
  triggerPing(schoolIndex) {
    const sc = this.schools[schoolIndex];
    if (!sc || sc.alive <= 0) return;
    sc.pingGlow = 1.0;
  }

  setView(renderer) {
    const pr = renderer.getPixelRatio();
    // 低解像度（特にスマホで ratio=0.4 など）ほど点を大きくして視認性を確保
    const scaleFactor = pr < 0.6 ? (0.6 / Math.max(0.35, pr)) : 1.0;
    this.dotPx.value = Math.max(2.2, 3.2 * pr * scaleFactor);
    this.currentPixelRatio = pr;
  }

  _hide(i) {
    this.mesh.setMatrixAt(i, _m.compose(ZERO, _q.identity(), ZERO));
    const d = this.dots.geometry.attributes.position.array;
    for (let k = 0; k < DOTS; k++) d[(i * DOTS + k) * 3 + 1] = -1000;
  }

  // 海域が変わったとき：海域ごとのえさ組み合わせリスト（area.foods）を反映し、群れを配り直す
  reset(whalePos, area) {
    this.areaFoods = (area.foods && area.foods.length > 0) ? area.foods : [area.food ?? 'sandlance'];
    this.food = FISH_SPECIES[this.areaFoods[0]] ?? FISH_SPECIES.sandlance;
    this.kindTurn = 0;
    this.mesh.material.color.setHex(0xffffff);
    // 小魚メッシュとオキアミ点群の両方を常に有効化（南極海でオキアミとハダカイワシが共存可能に）
    this.mesh.visible = true;
    this.dots.visible = true;
    this.schools.forEach((sc, s) => {
      const a = (s / SCHOOLS) * Math.PI * 2 + Math.random(), d = (14 + s * 11 + Math.random() * 6) * this.Z.V;
      this._respawn(s, new THREE.Vector3(whalePos.x + Math.sin(a) * d, this._randDepth(), whalePos.z + Math.cos(a) * d));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.dots.geometry.attributes.position.needsUpdate = true;
  }

  near(point, radius) {
    const { pos, alive } = this, r2 = radius * radius;
    for (let i = 0; i < this.n; i++) {
      if (!alive[i]) continue;
      const dx = pos[i * 3] - point.x, dz = pos[i * 3 + 2] - point.z;
      if (dx * dx + dz * dz < r2) {
        const s = Math.floor(i / PER_SCHOOL);
        return this.schools[s]?.species?.id ?? this.food.id;
      }
    }
    return null;
  }

  _respawnFar(s, whalePos, heading = null) {
    for (let k = 0; k < 16; k++) {
      const a = heading === null ? Math.random() * Math.PI * 2 : heading + (Math.random() - 0.5) * 1.6;
      const d = this.Z.V * (heading === null ? 55 + Math.random() * 30 : 20 + k * 2.5 + Math.random() * 3);
      _v.set(whalePos.x + Math.sin(a) * d, this._randDepth(), whalePos.z + Math.cos(a) * d);
      if (!this.isVisible || !this.isVisible(_v, 11 * this.Z.V)) break;
    }
    this._respawn(s, _v.clone());
  }

  update(dt, whalePos, heading = 0, alarm = 0) {
    const { pos, vel, alive } = this;
    this.frame = (this.frame || 0) + 1;

    let nearest = Infinity, farS = 0, farD = -1;
    this.schools.forEach((sc, s) => {
      const d = sc.center.distanceTo(whalePos);
      if (sc.alive >= sc.size * LEFTOVER) nearest = Math.min(nearest, d);
      if (d > farD) { farD = d; farS = s; }
    });
    this.callT = (this.callT || 0) - dt;
    if (nearest > 35 * this.Z.V && this.callT <= 0) { this._respawnFar(farS, whalePos, heading); this.callT = 3; }

    for (let s = 0; s < SCHOOLS; s++) {
      const school = this.schools[s];
      const F = school.species ?? this.food;
      if (school.center.distanceTo(whalePos) > FAR * this.Z.V) { this._respawnFar(s, whalePos, heading); continue; }
      if (school.alive < school.size * LEFTOVER) {
        school.leftT += dt;
        const scatterWait = window.RORQUAL_TUNING ? window.RORQUAL_TUNING.scatterDelay : LEFTOVER_WAIT;
        if (school.leftT >= scatterWait) {
          if (!school.broken) {
            school.broken = true;
            if (window.RORQUAL_TUNING?.scatterEffect) {
              school.pingGlow = 0.8;
              const i0 = s * PER_SCHOOL, i1 = i0 + school.size;
              for (let i = i0; i < i1; i++) {
                if (alive[i]) {
                  const dx = pos[i * 3] - school.center.x;
                  const dz = pos[i * 3 + 2] - school.center.z;
                  const len = Math.hypot(dx, dz) || 1;
                  vel[i * 3] += (dx / len) * (F.maxSpeed * 2.8);
                  vel[i * 3 + 2] += (dz / len) * (F.maxSpeed * 2.8);
                }
              }
              try {
                window.onSchoolCleared?.(school.center, school.species);
              } catch (err) {
                console.warn('onSchoolCleared error:', err);
              }
            }
          }
          school.fade = Math.max(0, school.fade - dt / FADE_TIME);
          if (school.fade <= 0 || school.alive === 0) { this._respawnFar(s, whalePos); continue; }
        }
      }

      _v.subVectors(school.target, school.center);
      if (_v.length() < 3) this._newTarget(school);
      school.vel.lerp(_v.setLength(F.cruise), dt * 0.5);
      _v.subVectors(school.center, whalePos);
      const dw = _v.length();
      const near = 12 * this.Z.S;
      if (dw < near) school.vel.addScaledVector(_v.normalize(), (near - dw) / this.Z.S * 0.15 * alarm * F.flee * dt);
      if (school.vel.length() > F.schoolMax) school.vel.setLength(F.schoolMax);
      school.center.addScaledVector(school.vel, dt);
      school.center.y = Math.max(this.layerY - 0.3, Math.min(this.layerY + 0.3, school.center.y));
      const tight = dw < near ? 1.0 + 0.8 * Math.min(1, F.flee) * (1 - dw / near) : 1.0;

      const i0 = s * PER_SCHOOL, i1 = i0 + school.size, sp2 = school.spacing * school.spacing;
      // ソナー反響（pingGlow）の減衰とハイライト色更新
      let updateGlowColor = false;
      const glowCol = _pingCol;
      const glowAmt = school.pingGlow || 0;
      if (school.pingGlow > 0) {
        // 余韻を少し長めに保つ（減衰速度を 0.55 -> 0.38 に緩和）
        school.pingGlow = Math.max(0, school.pingGlow - dt * 0.38);
        updateGlowColor = true;
        glowCol.copy(school.baseColor || _defaultFishCol).lerp(_sonarHighlightCol, Math.sin(school.pingGlow * Math.PI * 0.5) * 0.95);
      }
      for (let i = i0; i < i1; i++) {
        if (!alive[i]) continue;
        const p = i * 3;
        const cx = school.center.x - pos[p], cz = school.center.z - pos[p + 2];
        // オキアミ（F.dots）が時間の経過とともに中心へ凝集しすぎて極小の塊に潰れるのを防ぐ（一定半径以内では中心引力を弱める）
        const cohScale = F.dots ? Math.min(1, Math.hypot(cx, cz) / (7.5 * this.Z.V)) : 1.0;
        let ax = cx * school.coh * cohScale * tight;
        let ay = (school.center.y - pos[p + 1]) * 1.5 * tight;
        let az = cz * school.coh * cohScale * tight;
        ax += (school.vel.x - vel[p]) * 0.8;
        ay += (school.vel.y - vel[p + 1]) * 0.8;
        az += (school.vel.z - vel[p + 2]) * 0.8;

        for (let m = 1; m <= 12; m++) {
          const j = i0 + ((i - i0 + m * 17 + this.frame * 7) % school.size);
          if (j === i || !alive[j]) continue;
          const q = j * 3;
          const dx = pos[p] - pos[q], dy = pos[p + 1] - pos[q + 1], dz = pos[p + 2] - pos[q + 2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < sp2 && d2 > 1e-6) { const f = 1.5 * sp2 / (1.69 * d2); ax += dx * f; ay += dy * f; az += dz * f; }
        }

        const wx = pos[p] - whalePos.x, wy = pos[p + 1] - whalePos.y, wz = pos[p + 2] - whalePos.z;
        const w2 = wx * wx + wy * wy + wz * wz;
        const fleeR = (2.5 + 2.5 * alarm) * this.Z.S;
        if (w2 < fleeR * fleeR) {
          const f = (fleeR - Math.sqrt(w2)) * 0.85 * F.flee / Math.sqrt(w2 + 1e-3);
          ax += wx * f; az += wz * f;
          if (i % 3 === 0) ay += (i % 2 ? 1 : -1) * f * 2.0;
        }

        vel[p] += ax * dt; vel[p + 1] += ay * dt; vel[p + 2] += az * dt;
        const sp = Math.sqrt(vel[p] * vel[p] + vel[p + 1] * vel[p + 1] + vel[p + 2] * vel[p + 2]);
        const k = sp > F.maxSpeed ? F.maxSpeed / sp : sp < F.minSpeed ? F.minSpeed / (sp + 1e-6) : 1;
        vel[p] *= k; vel[p + 1] *= k; vel[p + 2] *= k;
        pos[p] += vel[p] * dt; pos[p + 1] += vel[p + 1] * dt; pos[p + 2] += vel[p + 2] * dt;

        if (F.dots) {
          const d = this.dots.geometry.attributes.position.array, o = this.dotOff;
          const cArr = this.dots.geometry.attributes.color.array;
          const gMix = glowAmt > 0 ? Math.sin(glowAmt * Math.PI * 0.5) : 0;
          for (let k = 0; k < DOTS; k++) {
            const q = (i * DOTS + k) * 3;
            const sp = school.spacing * 1.4 * school.fade;
            d[q] = pos[p] + o[q] * sp; d[q + 1] = pos[p + 1] + o[q + 1] * sp; d[q + 2] = pos[p + 2] + o[q + 2] * sp;
            if (updateGlowColor) {
              // 反響時は真珠色〜まばゆいシアン白に発光
              cArr[q]     = THREE.MathUtils.lerp(0.88, 0.95, gMix);
              cArr[q + 1] = THREE.MathUtils.lerp(0.42, 1.0, gMix);
              cArr[q + 2] = THREE.MathUtils.lerp(0.35, 1.0, gMix);
            }
          }
        } else {
          _v.set(vel[p], vel[p + 1], vel[p + 2]).normalize();
          _q.setFromUnitVectors(FWD, _v);
          const sc = F.scale;
          // 低解像度時は特にキラッと目立つようサイズを最大1.8倍に膨張拡大
          const lowResBoost = (this.currentPixelRatio && this.currentPixelRatio < 0.6) ? 1.4 : 1.0;
          const boost = 1.0 + glowAmt * 0.75 * lowResBoost;
          _s.set(sc[0] * school.fade * boost, sc[1] * school.fade * boost, sc[2] * school.fade * boost);
          _m.compose(_v.set(pos[p], pos[p + 1], pos[p + 2]), _q, _s);
          this.mesh.setMatrixAt(i, _m);
          if (updateGlowColor) {
            this.mesh.setColorAt(i, glowCol);
          }
        }
      }
      if (updateGlowColor) {
        if (F.dots) this.dots.geometry.attributes.color.needsUpdate = true;
        else if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.dots.geometry.attributes.position.needsUpdate = true;
  }

  eatGape(inv, gp, prevInv = null) {
    let count = 0, totalVal = 0;
    const { pos, alive } = this;
    const cz = (gp.sz + gp.jz + gp.hz) / 3, cy = (gp.sy + gp.jy + gp.hy) / 3, m = 1.15;
    const S = [cz + (gp.sz - cz) * m, cy + (gp.sy - cy) * m], J = [cz + (gp.jz - cz) * m, cy + (gp.jy - cy) * m];
    const H = [cz + (gp.hz - cz) * m, cy + (gp.hy - cy) * m];
    const side = (a, b, z, y) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (z - a[0]);
    for (let i = 0; i < this.n; i++) {
      if (!alive[i]) continue;
      _v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(inv);
      let inside = false;
      if (Math.abs(_v.x) <= gp.halfW) {
        const d1 = side(S, J, _v.z, _v.y), d2 = side(J, H, _v.z, _v.y), d3 = side(H, S, _v.z, _v.y);
        if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) {
          inside = true;
        }
      }
      // FPS低下時のすり抜け補正：前フレームとの中間地点もチェック
      if (!inside && prevInv) {
        _v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(prevInv);
        if (Math.abs(_v.x) <= gp.halfW * 1.1) {
          const d1 = side(S, J, _v.z, _v.y), d2 = side(J, H, _v.z, _v.y), d3 = side(H, S, _v.z, _v.y);
          if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) {
            inside = true;
          }
        }
      }
      if (!inside) continue;
      alive[i] = 0;
      const s = Math.floor(i / PER_SCHOOL);
      this.schools[s].alive--;
      this._hide(i);
      count++;
      totalVal += (this.schools[s]?.species?.value ?? this.food.value);
    }
    return { count, value: totalVal };
  }

  scatter(center, radius = 16, force = 9) {
    const { pos, vel, alive } = this;
    const r2 = radius * radius;
    for (let s = 0; s < SCHOOLS; s++) {
      const school = this.schools[s];
      const dSchool = school.center.distanceTo(center);
      if (dSchool < radius + 8) {
        const sDir = new THREE.Vector3().subVectors(school.center, center);
        const sl = sDir.length();
        if (sl > 0.1) school.vel.addScaledVector(sDir.normalize(), force * 0.45);
      }
      const i0 = s * PER_SCHOOL, i1 = i0 + school.size;
      for (let i = i0; i < i1; i++) {
        if (!alive[i]) continue;
        const p = i * 3;
        const dx = pos[p] - center.x;
        const dy = pos[p + 1] - center.y;
        const dz = pos[p + 2] - center.z;
        const dist2 = dx * dx + dy * dy + dz * dz;
        if (dist2 < r2 && dist2 > 1e-4) {
          const dist = Math.sqrt(dist2);
          const push = (1 - dist / radius) * force;
          vel[p] += (dx / dist) * push + (Math.random() - 0.5) * 1.5;
          vel[p + 1] += (dy / dist) * push * 0.4 + (Math.random() - 0.5) * 1.0;
          vel[p + 2] += (dz / dist) * push + (Math.random() - 0.5) * 1.5;
        }
      }
    }
  }
}
