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

    // 鳥の形状：細い胴体と広げた白い翼（シンプルな低ポリゴン形状）
    const geom = new THREE.BufferGeometry();
    // 翼を広げた V 字形の 3 つの三角形（胴体＋左右の翼）
    // 翼開長 約 80cm
    const vertices = new Float32Array([
      // 胴体
      0, 0, 0.25,   -0.04, 0, -0.15,   0.04, 0, -0.15,
      // 左翼
      0, 0, 0.05,   -0.45, 0.08, -0.05,   -0.03, 0, -0.12,
      // 右翼
      0, 0, 0.05,    0.03, 0, -0.12,     0.45, 0.08, -0.05,
    ]);
    const colors = new Float32Array([
      // 胴体（白〜薄い灰色）
      0.95, 0.95, 0.95,   0.85, 0.88, 0.9,   0.85, 0.88, 0.9,
      // 左翼（先端が暗い）
      0.9, 0.9, 0.92,     0.35, 0.38, 0.4,   0.8, 0.82, 0.85,
      // 右翼
      0.9, 0.9, 0.92,     0.8, 0.82, 0.85,   0.35, 0.38, 0.4,
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.6,
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

          bird.pos.x += (targetX - bird.pos.x) * Math.min(1, dt * 2.5);
          bird.pos.z += (targetZ - bird.pos.z) * Math.min(1, dt * 2.5);
          bird.pos.y += (targetY - bird.pos.y) * Math.min(1, dt * 3.0);

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
