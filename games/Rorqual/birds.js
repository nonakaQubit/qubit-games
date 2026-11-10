import * as THREE from 'three';

// 海鳥（ミズナギドリ / カモメ類）
// えさの群れ（魚の群れ）の上空や水面近くを旋回し、時折水面へダイブする
// 遠くからでも魚の群れの目印になり、クジラが突進すると驚いて飛び立つ
// 軽量化のため、シンプルな InstancedMesh で羽ばたきながら群れで飛ぶ

const BIRDS_PER_SCHOOL = 6;
const MAX_BIRDS = 40;

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const _m = new THREE.Matrix4();
const FWD = new THREE.Vector3(0, 0, 1);

export class Seabirds {
  constructor(scene, fishSchools) {
    this.scene = scene;
    this.fish = fishSchools;

    // オオミズナギドリ（背中・翼上が黒褐色、腹部・翼下面が白）の軽量ローポリ形状
    // 背面（上向き）と腹面（下向き）の独立ポリゴンで構成し、図鑑と同じ配色を実現
    const geom = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      // 背面（上面：黒褐色〜翼端ダーク）
      // 胴体背中
      0, 0.02, 0.25,   -0.04, 0.01, -0.15,   0.04, 0.01, -0.15,
      // 左翼上面
      0, 0.02, 0.05,   -0.48, 0.08, -0.05,   -0.03, 0.01, -0.12,
      // 右翼上面
      0, 0.02, 0.05,    0.03, 0.01, -0.12,    0.48, 0.08, -0.05,

      // 腹面（下面：白〜翼端グレー）
      // 胴体お腹
      0, -0.02, 0.25,   0.04, -0.01, -0.15,  -0.04, -0.01, -0.15,
      // 左翼下面
      0, -0.01, 0.05,  -0.03, -0.01, -0.12,  -0.48, 0.06, -0.05,
      // 右翼下面
      0, -0.01, 0.05,   0.48, 0.06, -0.05,    0.03, -0.01, -0.12,
    ]);

    // 図鑑の cDarkBrown (0.16, 0.14, 0.12), cWingTip (0.10, 0.09, 0.08), cWhite (0.92, 0.92, 0.90) に準拠
    const colors = new Float32Array([
      // 背面（胴体）
      0.18, 0.15, 0.13,   0.16, 0.14, 0.12,   0.16, 0.14, 0.12,
      // 左翼上面（基部ダークブラウン〜翼端ダーク）
      0.18, 0.15, 0.13,   0.10, 0.09, 0.08,   0.15, 0.13, 0.11,
      // 右翼上面
      0.18, 0.15, 0.13,   0.15, 0.13, 0.11,   0.10, 0.09, 0.08,

      // 腹面（胴体：白）
      0.94, 0.94, 0.92,   0.90, 0.90, 0.88,   0.90, 0.90, 0.88,
      // 左翼下面（白〜翼端グレー）
      0.92, 0.92, 0.90,   0.85, 0.85, 0.83,   0.24, 0.22, 0.20,
      // 右翼下面
      0.92, 0.92, 0.90,   0.24, 0.22, 0.20,   0.85, 0.85, 0.83,
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.55,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.InstancedMesh(geom, mat, MAX_BIRDS);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this.birds = [];
    for (let i = 0; i < MAX_BIRDS; i++) {
      this.birds.push({
        active: false,
        pos: new THREE.Vector3(0, 10, 0),
        vel: new THREE.Vector3(),
        yaw: Math.random() * Math.PI * 2,
        pitch: 0,
        roll: 0,
        wingPhase: Math.random() * Math.PI * 2,
        schoolIdx: -1,
        angle: Math.random() * Math.PI * 2,
        radius: 3 + Math.random() * 6,
        targetY: 1.5 + Math.random() * 2.5,
        diveTimer: 5 + Math.random() * 15,
        isDiving: false,
        initialized: false,
      });
      this.mesh.setMatrixAt(i, _m.compose(new THREE.Vector3(0, -100, 0), _q.identity(), _s.setScalar(0)));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt, playerPos, Z) {
    if (!this.fish || !this.fish.schools) return;

    let birdIdx = 0;
    const schools = this.fish.schools;

    // 各魚の群れに海鳥を割り当てる（生きている魚の群れの上空）
    for (let s = 0; s < schools.length; s++) {
      const sc = schools[s];
      // オキアミ（海面から深い）以外の魚の群れで、ある程度魚が残っている群れに集まる
      const hasFish = sc.alive > sc.size * 0.2 && sc.species?.dots !== true;

      for (let b = 0; b < BIRDS_PER_SCHOOL; b++) {
        if (birdIdx >= MAX_BIRDS) break;
        const bird = this.birds[birdIdx];
        bird.active = hasFish;

        if (hasFish) {
          bird.schoolIdx = s;
          const center = sc.center;

          // 群れのまわりを円を描いて旋回
          bird.angle += (0.9 / Math.max(1, bird.radius)) * dt;
          bird.wingPhase += dt * 10; // 羽ばたき

          // ダイブ（水面への突入）のタイマー
          bird.diveTimer -= dt;
          if (bird.diveTimer <= 0) {
            if (!bird.isDiving) {
              bird.isDiving = true;
              bird.diveTimer = 1.2; // 水面に突っ込む時間
            } else {
              bird.isDiving = false;
              bird.diveTimer = 6 + Math.random() * 14;
              bird.targetY = 1.2 + Math.random() * 2.8;
            }
          }

          const targetY = bird.isDiving ? 0.05 : bird.targetY;
          const targetX = center.x + Math.sin(bird.angle) * (bird.radius * Z.V);
          const targetZ = center.z + Math.cos(bird.angle) * (bird.radius * Z.V);

          // 魚の群れがリスポーン等で遠くに移動した場合や初回配置時は瞬間移動（画面横断バグを防止）
          const dx = targetX - bird.pos.x;
          const dz = targetZ - bird.pos.z;
          if (!bird.initialized || (dx * dx + dz * dz > 20 * 20 * Z.V * Z.V)) {
            bird.pos.set(targetX, targetY, targetZ);
            bird.initialized = true;
          } else {
            bird.pos.x += (targetX - bird.pos.x) * Math.min(1, dt * 2.5);
            bird.pos.z += (targetZ - bird.pos.z) * Math.min(1, dt * 2.5);
            bird.pos.y += (targetY - bird.pos.y) * Math.min(1, dt * 3.0);
          }

          // 進行方向の向き
          bird.yaw = bird.angle + Math.PI / 2;
          bird.pitch = bird.isDiving ? -0.4 : (targetY - bird.pos.y) * 0.15;
          // 旋回に伴うバンク（傾き）
          bird.roll = 0.35 * Math.sin(bird.wingPhase * 0.1) - 0.25;

          // 羽ばたきのアニメーション（ピッチとスケールの微小な振動）
          const flap = Math.sin(bird.wingPhase) * 0.12;

          _q.setFromEuler(new THREE.Euler(bird.pitch + flap, bird.yaw, bird.roll, 'YXZ'));
          _s.set(1.0, 1.0 + flap * 0.5, 1.0);
          _m.compose(bird.pos, _q, _s);
          this.mesh.setMatrixAt(birdIdx, _m);
        } else {
          this.mesh.setMatrixAt(birdIdx, _m.compose(new THREE.Vector3(0, -100, 0), _q.identity(), _s.setScalar(0)));
        }
        birdIdx++;
      }
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
