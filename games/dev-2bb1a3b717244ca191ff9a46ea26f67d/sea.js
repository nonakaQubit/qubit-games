import * as THREE from 'three';

const SHAFT_SPAN = 200; // 光の筋を散らす範囲（m 四方）

// 海の見た目：水面、上から差す光の筋、漂うマリンスノー。外洋なので海底は描かない
export class Sea {
  constructor(scene, sea) {
    this.sea = sea;
    this.time = { value: 0 };
    this._shafts(scene);
    this._snow(scene);
    this._surface(scene);
  }

  _shafts(scene) {
    // 縦長の板に、上ほど明るいグラデーション。加算合成でうっすら重ねる
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: this.time, uGain: this.shaftGain = { value: 0.07 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        varying vec2 vUv; varying float vSeed;
        attribute float seed;
        void main() { vUv = uv; vSeed = seed;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uGain; varying vec2 vUv; varying float vSeed;
        void main() {
          float edge = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x);
          float fade = pow(vUv.y, 1.6);
          float flick = 0.6 + 0.4 * sin(uTime * 0.5 + vSeed * 6.28);
          gl_FragColor = vec4(vec3(0.75, 0.95, 0.85) * edge * fade * flick * uGain, 1.0);
        }`,
    });
    const g = new THREE.PlaneGeometry(1, 1);
    g.translate(0, -0.5, 0);
    const N = 40;
    const seeds = new Float32Array(N);
    const mesh = new THREE.InstancedMesh(g, mat, N);
    // 光の筋は SHAFT_SPAN m 四方に散らしておき、クジラのまわりに折り返して付いてこさせる（update で）
    this.shaftBase = [];
    for (let i = 0; i < N; i++) {
      seeds[i] = Math.random();
      this.shaftBase.push({
        x: (Math.random() - 0.5) * SHAFT_SPAN, z: (Math.random() - 0.5) * SHAFT_SPAN,
        ry: Math.random() * Math.PI, rz: (Math.random() - 0.5) * 0.25, w: 2 + Math.random() * 4,
      });
    }
    this._shaftObj = new THREE.Object3D();
    g.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 1));
    mesh.frustumCulled = false;
    this.shafts = mesh;
    scene.add(mesh);
  }

  // 水面：半透明で、さざ波に空と日の光が映る。下のクジラは透けて見える
  _surface(scene) {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.time,
        uDeep: { value: new THREE.Color(0x2c6f6a) },
        uSky: { value: new THREE.Color(0xc4dde2) },
        uWave: { value: 1 },
        uSunDir: { value: new THREE.Vector3(10, 60, 5).normalize() },
      },
      transparent: true, depthWrite: false,
      vertexShader: /* glsl */`
        varying vec3 vW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uWave; uniform vec3 uDeep, uSky, uSunDir; varying vec3 vW;
        // いくつかの向きの波を重ねて、面の傾きを作る
        vec2 slope(vec2 p, float t) {
          vec2 s = vec2(0.0);
          vec3 w[5];
          // 波長はおよそ 4m〜0.6m。体長 8m のミンクに対して小さめのさざ波
          w[0] = vec3(0.9, 0.4, 1.1); w[1] = vec3(-0.35, 1.0, 1.75); w[2] = vec3(0.55, -0.85, 2.9);
          w[3] = vec3(-0.95, -0.3, 4.4); w[4] = vec3(0.15, 0.98, 6.7);
          for (int i = 0; i < 5; i++) {
            vec2 d = normalize(w[i].xy); float k = w[i].z;
            float ph = dot(d, p) * k - t * sqrt(9.8 * k) * 0.6;
            // 波ごとに強さがゆっくり場所で変わるようにして、規則的な縞に見えないようにする
            float m = 0.55 + 0.45 * sin(dot(p, d.yx) * 0.13 + float(i) * 1.7 + t * 0.07);
            s += d * cos(ph) * (0.22 / sqrt(k)) * m;
          }
          return s;
        }
        void main() {
          // 遠くの細かい波はちらつくので弱める
          float far = exp(-length(cameraPosition - vW) * 0.025);
          vec2 s = slope(vW.xz, uTime) * (0.35 + 0.65 * far) * uWave;
          vec3 n = normalize(vec3(-s.x, 1.0, -s.y));
          vec3 v = normalize(cameraPosition - vW);
          float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
          vec3 r = reflect(-v, n);
          float spec = pow(max(dot(r, uSunDir), 0.0), 60.0);
          float glint = pow(max(dot(r, uSunDir), 0.0), 12.0) * 0.15;
          vec3 col = mix(uDeep, uSky, 0.25 + fres * 0.6) + vec3(1.0, 0.97, 0.9) * (spec * 1.6 + glint);
          float a = clamp(0.28 + fres * 0.5 + spec, 0.0, 0.92);
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const g = new THREE.PlaneGeometry(900, 900);
    g.rotateX(-Math.PI / 2);
    this.surface = new THREE.Mesh(g, mat);
    this.surface.renderOrder = 10;
    scene.add(this.surface);
  }

  _snow(scene) {
    const N = 1500;
    const p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      p.set([(Math.random() - 0.5) * 120, this.sea.floorY + Math.random() * (-this.sea.floorY - 0.5), (Math.random() - 0.5) * 120], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const mat = new THREE.PointsMaterial({ color: 0xcfe6dc, size: 0.12, transparent: true, opacity: 0.55, depthWrite: false });
    this.snow = new THREE.Points(g, mat);
    scene.add(this.snow);
  }

  // 海域を切り替える：色、波の荒さ、光の筋の強さ。光の筋とマリンスノーの配置も新しくする
  setArea(area, center) {
    const u = this.surface.material.uniforms;
    u.uDeep.value.setHex(area.deep);
    u.uSky.value.setHex(area.sky);
    u.uWave.value = area.wave;
    this.shaftGain.value = area.shafts;
    this.snow.material.color.setHex(area.snow);
    this.time.value = Math.random() * 100; // 波の模様も別のものに
    this.shaftBase.forEach((b) => {
      b.x = (Math.random() - 0.5) * SHAFT_SPAN; b.z = (Math.random() - 0.5) * SHAFT_SPAN;
      b.ry = Math.random() * Math.PI; b.rz = (Math.random() - 0.5) * 0.25; b.w = 2 + Math.random() * 4;
    });
    const a = this.snow.geometry.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) {
      a[i] = center.x + (Math.random() - 0.5) * 120;
      a[i + 1] = this.sea.floorY + Math.random() * (-this.sea.floorY - 0.5);
      a[i + 2] = center.z + (Math.random() - 0.5) * 120;
    }
  }

  update(dt, center) {
    this.time.value += dt;
    const o = this._shaftObj, H = SHAFT_SPAN / 2, wrap = (v, c) => c + ((((v - c + H) % SHAFT_SPAN) + SHAFT_SPAN) % SHAFT_SPAN) - H;
    this.shaftBase.forEach((b, i) => {
      o.position.set(wrap(b.x, center.x), 0, wrap(b.z, center.z));
      o.rotation.set(0, b.ry, b.rz);
      o.scale.set(b.w, -this.sea.floorY, 1);
      o.updateMatrix();
      this.shafts.setMatrixAt(i, o.matrix);
    });
    this.shafts.instanceMatrix.needsUpdate = true;
    this.surface.position.set(center.x, 0, center.z);
    // マリンスノーはクジラの周りに付いてくる箱の中で、ゆっくり沈みながら回り込む
    const a = this.snow.geometry.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) {
      a[i + 1] -= dt * 0.3;
      if (a[i + 1] < this.sea.floorY) a[i + 1] -= this.sea.floorY + 0.5;
      if (a[i] - center.x > 60) a[i] -= 120; else if (a[i] - center.x < -60) a[i] += 120;
      if (a[i + 2] - center.z > 60) a[i + 2] -= 120; else if (a[i + 2] - center.z < -60) a[i + 2] += 120;
    }
    this.snow.geometry.attributes.position.needsUpdate = true;
  }
}
