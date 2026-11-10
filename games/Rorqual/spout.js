import * as THREE from 'three';

// 潮吹き。三種類の粒を重ねる
//  jet  : 噴気孔から勢いよく吹き上がる細かい霧の柱
//  mist : 柱の上の方でふわっと広がり、風に流されて消えていく霧
//  drop : 柱から落ちてくる水滴
// 粒の大きさは m 単位で持ち、画面の解像度が変わっても見た目の大きさは変わらない
const N = 4000;
const JET = 0, MIST = 1, DROP = 2, FOAM = 3, SPARK = 4;
const EMIT_TIME = 0.8; // ひと吹きの長さ（秒）

// もやもやした霧のかたまりの絵（丸いぼかしに、ムラを足す）
function puffTexture() {
  const S = 64, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 3 + Math.random() * 9;
    const h = g.createRadialGradient(x, y, 0, x, y, r);
    h.addColorStop(0, 'rgba(0,0,0,0.35)');
    h.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = h;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return new THREE.CanvasTexture(c);
}

export class Spout {
  constructor(scene) {
    this.pos = new Float32Array(N * 3);
    this.vel = new Float32Array(N * 3);
    this.life = new Float32Array(N);     // 残り寿命（秒）。0 以下は未使用
    this.life0 = new Float32Array(N);    // 生まれたときの寿命
    this.kind = new Uint8Array(N);
    this.size0 = new Float32Array(N);    // 生まれたときの大きさ（m）
    this.size = new Float32Array(N);
    this.alpha = new Float32Array(N);
    this.shade = new Float32Array(N);    // 明るさのばらつき
    this.next = 0;
    this.emitters = [];

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('shade', new THREE.BufferAttribute(this.shade, 1));
    this.uniforms = { uMap: { value: puffTexture() }, uScale: { value: 500 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true, depthWrite: false,
      vertexShader: /* glsl */`
        uniform float uScale;
        attribute float size, alpha, shade;
        varying float vA, vS;
        void main() {
          vA = alpha; vS = shade;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uMap; varying float vA, vS;
        void main() {
          vec2 pc = gl_PointCoord;
          float a = texture2D(uMap, pc).a * vA;
          if (a < 0.004) discard;
          // vS >= 1.5 は食事ヒット時のきらめき泡（ゴールデンシアン〜真珠色の発光）
          if (vS >= 1.5) {
            float d = length(pc - vec2(0.5)) * 2.0;
            float core = max(0.0, 1.0 - d * d);
            vec3 cSpark = mix(vec3(0.55, 0.96, 0.90), vec3(1.0, 0.98, 0.82), clamp(vS - 1.5, 0.0, 1.0));
            gl_FragColor = vec4(cSpark + vec3(0.35 * core), min(1.0, a * 1.45));
            return;
          }
          // 上側は日に当たって明るく、下側は少し青みがかった影
          vec3 lit = vec3(1.0, 0.99, 0.96), shadow = vec3(0.74, 0.8, 0.84);
          vec3 col = mix(shadow, lit, clamp(1.1 - pc.y * 0.9, 0.0, 1.0) * vS);
          gl_FragColor = vec4(col, a);
        }`,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 20; // 水面より後に描いて、水面に曇らされないようにする
    scene.add(this.points);
  }

  // 画面の縦のピクセル数と画角から、m → ピクセルの換算係数を決める（毎フレーム呼ぶ）
  setView(renderer, camera) {
    const h = renderer.getDrawingBufferSize(new THREE.Vector2()).y;
    this.uniforms.uScale.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }

  // ひと吹き。getPos は噴気孔の今の位置を返す関数（クジラが進んでも根元が付いていく）
  // sc はクジラの大きさの倍率（体長の比）。大きいクジラほど高く太く、長く吹く
  emit(getPos, sc = 1) {
    this.emitters.push({ getPos, t: 0, sc });
  }

  // ブリーチングの豪快な着水白波（遠くへ飛ばさず、水面に濃く大きな泡・水煙の塊をどっしり残す）
  emitSplash(at, sc = 1, count = 85) {
    const ss = Math.pow(sc, 0.7) * 1.25;
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % N;
      const a = Math.random() * Math.PI * 2;
      this.kind[i] = FOAM; // 濃密な白波・水煙
      this.shade[i] = 0.94 + Math.random() * 0.06; // 純白
      // クジラの着水地点の周囲（遠くへ飛ばさず、コンパクトに集中）
      const rad = (Math.random() * 1.8 + 0.3) * sc;
      const i3 = i * 3;
      this.pos[i3] = at.x + Math.cos(a) * rad;
      this.pos[i3 + 1] = 0.15;
      this.pos[i3 + 2] = at.z + Math.sin(a) * rad;
      // 速度は極めて控えめ（飛ばさない！水面でボコボコと沸き立つ白波）
      const speed = (0.5 + Math.random() * 1.6) * Math.pow(sc, 0.4);
      const upSpeed = (1.2 + Math.random() * 2.2) * Math.pow(sc, 0.4);
      this.vel[i3] = Math.cos(a) * speed;
      this.vel[i3 + 1] = upSpeed;
      this.vel[i3 + 2] = Math.sin(a) * speed;
      this.life0[i] = 1.6 + Math.random() * 1.2;
      this.size0[i] = (2.2 + Math.random() * 2.2) * ss; // 大きな霧のかたまり（潮吹きテクスチャ）
      this.life[i] = this.life0[i];
    }
  }

  // 水面を切って進むときの連続航跡白波（巨体が水面を割る船首波・白泡トレイル）
  emitWake(at, sc = 1, count = 3) {
    const ss = Math.pow(sc, 0.7) * 1.15;
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % N;
      const a = Math.random() * Math.PI * 2;
      this.kind[i] = FOAM;
      this.shade[i] = 0.92 + Math.random() * 0.08;
      const rad = (Math.random() * 1.3 + 0.2) * sc;
      const i3 = i * 3;
      this.pos[i3] = at.x + Math.cos(a) * rad;
      this.pos[i3 + 1] = 0.12;
      this.pos[i3 + 2] = at.z + Math.sin(a) * rad;
      const speed = (0.3 + Math.random() * 1.3) * Math.pow(sc, 0.3);
      this.vel[i3] = Math.cos(a) * speed;
      this.vel[i3 + 1] = 0.6 + Math.random() * 1.2;
      this.vel[i3 + 2] = Math.sin(a) * speed;
      this.life0[i] = 1.4 + Math.random() * 1.1;
      this.size0[i] = (1.8 + Math.random() * 1.8) * ss;
      this.life[i] = this.life0[i];
    }
  }

  // イルカが水面を跳ねる・飛び込むときの水煙（立ち上る白い水しぶき＋水滴＋水面白波）
  emitDolphinSplash(at, fwdX = 0, fwdZ = 1, scale = 1.0) {
    // 1. 立ち上る白い水煙（JET / MIST）
    const nSpray = Math.round(28 * scale);
    for (let k = 0; k < nSpray; k++) {
      const i = this.next;
      this.next = (this.next + 1) % N;
      const a = Math.random() * Math.PI * 2;
      const spread = (0.3 + Math.random() * 1.2) * scale;
      const fwdPush = (0.6 + Math.random() * 1.8) * scale;
      const i3 = i * 3;
      this.kind[i] = k % 2 === 0 ? JET : MIST;
      this.shade[i] = 0.96 + Math.random() * 0.04;
      this.pos[i3] = at.x + Math.cos(a) * 0.35 * scale;
      this.pos[i3 + 1] = 0.05 + Math.random() * 0.2;
      this.pos[i3 + 2] = at.z + Math.sin(a) * 0.35 * scale;
      this.vel[i3] = Math.cos(a) * spread + fwdX * fwdPush;
      this.vel[i3 + 1] = (3.0 + Math.random() * 4.2) * scale;
      this.vel[i3 + 2] = Math.sin(a) * spread + fwdZ * fwdPush;
      this.life0[i] = 0.75 + Math.random() * 0.65;
      this.size0[i] = (0.55 + Math.random() * 0.55) * scale;
      this.life[i] = this.life0[i];
    }
    // 2. 飛び散る水滴（DROP）
    const nDrops = Math.round(22 * scale);
    for (let k = 0; k < nDrops; k++) {
      const i = this.next;
      this.next = (this.next + 1) % N;
      const a = Math.random() * Math.PI * 2;
      const s = (0.6 + Math.random() * 1.8) * scale;
      const i3 = i * 3;
      this.kind[i] = DROP;
      this.shade[i] = 0.96;
      this.pos[i3] = at.x + (Math.random() - 0.5) * 0.4;
      this.pos[i3 + 1] = 0.15;
      this.pos[i3 + 2] = at.z + (Math.random() - 0.5) * 0.4;
      this.vel[i3] = Math.cos(a) * s + fwdX * 1.2 * scale;
      this.vel[i3 + 1] = (3.4 + Math.random() * 4.5) * scale;
      this.vel[i3 + 2] = Math.sin(a) * s + fwdZ * 1.2 * scale;
      this.life0[i] = 1.2 + Math.random() * 0.6;
      this.size0[i] = 0.07 + Math.random() * 0.05;
      this.life[i] = this.life0[i];
    }
    // 3. 水面に残る白波・泡（FOAM）
    const nFoam = Math.round(20 * scale);
    for (let k = 0; k < nFoam; k++) {
      const i = this.next;
      this.next = (this.next + 1) % N;
      const a = Math.random() * Math.PI * 2;
      const rad = (0.15 + Math.random() * 0.9) * scale;
      const i3 = i * 3;
      this.kind[i] = FOAM;
      this.shade[i] = 0.95 + Math.random() * 0.05;
      this.pos[i3] = at.x + Math.cos(a) * rad;
      this.pos[i3 + 1] = 0.12;
      this.pos[i3 + 2] = at.z + Math.sin(a) * rad;
      this.vel[i3] = Math.cos(a) * 0.6 + fwdX * 0.5;
      this.vel[i3 + 1] = 0.8 + Math.random() * 1.2;
      this.vel[i3 + 2] = Math.sin(a) * 0.6 + fwdZ * 0.5;
      this.life0[i] = 1.2 + Math.random() * 0.8;
      this.size0[i] = (1.1 + Math.random() * 1.0) * scale;
      this.life[i] = this.life0[i];
    }
  }

  // 大漁に食べた後の突進終了時（海水を濾し出すとき）：クジラの喜びを表すようにクジラの体から光の粒がふわりとこぼれる
  emitWhaleJoy(whaleGroup, sc = 1, count = 28) {
    const ss = Math.pow(sc, 0.72);
    const local = new THREE.Vector3();
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % N;
      // クジラの頭部〜胸びれ・体側まわり（8m基準のローカル座標）からこぼれ出る
      local.set(
        (Math.random() - 0.5) * 1.6,
        (Math.random() - 0.35) * 1.1,
        (Math.random() - 0.35) * 4.2
      );
      whaleGroup.localToWorld(local);
      const a = Math.random() * Math.PI * 2;
      const spd = (0.25 + Math.random() * 0.75) * ss;
      const i3 = i * 3;
      this.kind[i] = SPARK;
      this.shade[i] = 1.5 + Math.random() * 1.0;
      this.pos[i3] = local.x;
      this.pos[i3 + 1] = local.y;
      this.pos[i3 + 2] = local.z;
      this.vel[i3] = Math.cos(a) * spd;
      this.vel[i3 + 1] = (0.45 + Math.random() * 1.1) * ss;
      this.vel[i3 + 2] = Math.sin(a) * spd;
      this.life0[i] = 1.2 + Math.random() * 0.9;
      this.size0[i] = (0.24 + Math.random() * 0.28) * ss;
      this.life[i] = this.life0[i];
    }
  }

  _spawn(kind, at, sc = 1) {
    const vs = Math.pow(sc, 0.8), ss = Math.pow(sc, 0.8); // 速さ（＝高さ）と粒の大きさの倍率
    const i = this.next;
    this.next = (this.next + 1) % N;
    const a = Math.random() * Math.PI * 2;
    this.kind[i] = kind;
    this.shade[i] = 0.75 + Math.random() * 0.25;
    this.pos.set([at.x + (Math.random() - 0.5) * 0.15, at.y, at.z + (Math.random() - 0.5) * 0.15], i * 3);
    if (kind === JET) {
      const s = Math.random() * 0.9;
      this.vel.set([Math.cos(a) * s * vs, (7 + Math.random() * 4) * vs, Math.sin(a) * s * vs], i * 3);
      this.life0[i] = 0.7 + Math.random() * 0.5;
      this.size0[i] = (0.25 + Math.random() * 0.2) * ss;
    } else if (kind === MIST) {
      const s = 0.8 + Math.random() * 1.6; // 上の方で横にもくもく広がる
      this.vel.set([Math.cos(a) * s * vs, (5 + Math.random() * 4) * vs, Math.sin(a) * s * vs], i * 3);
      this.life0[i] = 2.2 + Math.random() * 1.8;
      this.size0[i] = (0.5 + Math.random() * 0.5) * ss;
    } else {
      const s = 0.6 + Math.random() * 1.2;
      this.vel.set([Math.cos(a) * s * vs, (4 + Math.random() * 5) * vs, Math.sin(a) * s * vs], i * 3);
      this.life0[i] = 2.0;
      this.size0[i] = 0.06 + Math.random() * 0.05;
    }
    this.life[i] = this.life0[i];
  }

  update(dt) {
    const at = new THREE.Vector3();
    for (const e of this.emitters) {
      e.t += dt;
      e.getPos(at);
      // 吹き始めが一番強く、終わり際に弱まる（根元から柱が途切れないように長めに吹く）
      const len = EMIT_TIME * Math.sqrt(e.sc);
      const k = Math.max(0, 1 - Math.pow(e.t / len, 2));
      const nJet = Math.round(dt * 2600 * k), nMist = Math.round(dt * 700 * k), nDrop = Math.round(dt * 500 * k);
      for (let j = 0; j < nJet; j++) this._spawn(JET, at, e.sc);
      for (let j = 0; j < nMist; j++) this._spawn(MIST, at, e.sc);
      for (let j = 0; j < nDrop; j++) this._spawn(DROP, at, e.sc);
    }
    this.emitters = this.emitters.filter((e) => e.t < EMIT_TIME * Math.sqrt(e.sc));

    const { pos, vel, life, life0, kind, size, size0, alpha } = this;
    for (let i = 0; i < N; i++) {
      if (life[i] <= 0) { alpha[i] = 0; continue; }
      life[i] -= dt;
      const p = i * 3, age = 1 - life[i] / life0[i]; // 0（生まれた）→ 1（消える）
      if (kind[i] === SPARK) {
        // 食事ヒット時のきらめき泡：水中を揺らめきながら浮き上がり、キラキラ瞬いて消える
        const drag = Math.exp(-dt * 2.2);
        vel[p] *= drag;
        vel[p + 1] = vel[p + 1] * drag + 0.8 * dt;
        vel[p + 2] *= drag;
        pos[p] += vel[p] * dt + Math.sin(age * 16.0 + i) * 0.4 * dt;
        pos[p + 1] = Math.min(-0.08, pos[p + 1] + vel[p + 1] * dt);
        pos[p + 2] += vel[p + 2] * dt + Math.cos(age * 16.0 + i) * 0.4 * dt;
        const twinkle = 0.7 + 0.3 * Math.sin(age * 24.0 + i * 1.7);
        size[i] = size0[i] * (1.0 - age * 0.35) * twinkle;
        alpha[i] = 0.88 * Math.min(1, age * 8) * Math.pow(1 - age, 1.1) * twinkle;
        continue;
      }
      if (kind[i] === FOAM) {
        // 水面の濃密な白波・泡煙：空気抵抗で飛ばず、水面付近にフワッと滞留
        const drag = Math.exp(-dt * 3.6);
        vel[p] = vel[p] * drag;
        vel[p + 1] = (vel[p + 1] - 0.4) * drag;
        vel[p + 2] = vel[p + 2] * drag;
        pos[p] += vel[p] * dt;
        pos[p + 1] = Math.max(0.08, pos[p + 1] + vel[p + 1] * dt);
        pos[p + 2] += vel[p + 2] * dt;
        size[i] = size0[i] * (1 + age * 1.6);
        alpha[i] = 0.46 * Math.min(1, age * 10) * Math.pow(1 - age, 1.4);
        continue;
      }
      if (kind[i] === DROP) {
        vel[p + 1] -= 9.8 * dt;
        pos[p] += vel[p] * dt; pos[p + 1] += vel[p + 1] * dt; pos[p + 2] += vel[p + 2] * dt;
        if (pos[p + 1] < 0) life[i] = 0; // 水面に落ちたら消える
        size[i] = size0[i];
        alpha[i] = 0.5 * (1 - age);
        continue;
      }
      // 霧：空気の抵抗で上昇がすぐ止まり、ふくらみながら風に流される
      const drag = Math.exp(-dt * (kind[i] === JET ? 1.2 : 2.2));
      vel[p] = vel[p] * drag + 0.9 * dt; // ゆるい横風
      vel[p + 1] = vel[p + 1] * drag - 1.2 * dt;
      vel[p + 2] *= drag;
      if (kind[i] === MIST) { // 乱れ：霧がもやもやと形を変えながら散る
        vel[p] += (Math.random() - 0.5) * 3 * dt;
        vel[p + 1] += (Math.random() - 0.5) * 2 * dt;
        vel[p + 2] += (Math.random() - 0.5) * 3 * dt;
      }
      pos[p] += vel[p] * dt; pos[p + 1] += vel[p + 1] * dt; pos[p + 2] += vel[p + 2] * dt;
      if (kind[i] === JET) {
        size[i] = size0[i] * (1 + age * 2.5);
        alpha[i] = 0.16 * Math.min(1, age * 20) * (1 - age);
      } else {
        size[i] = size0[i] * (1 + age * 4);
        alpha[i] = 0.07 * Math.min(1, age * 6) * Math.pow(1 - age, 1.5);
      }
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = a.size.needsUpdate = a.alpha.needsUpdate = true;
  }
}
