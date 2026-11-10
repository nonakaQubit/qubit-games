import * as THREE from 'three';
import { createHumpback, createShark, createSeaTurtle, createSunfish } from './creatures_models.js?v=20261109_v44';

// 海の仲間・ゲスト生き物たち（ザトウクジラ、ヨシキリザメ、アオウミガメ、マンボウ）
// 海域（areas.js の area.creatures）ごとに異なる組み合わせで出現し、
// カメラ錐台チェックにより画面内で急に消えたり湧いたりしない自然な回遊を行う。

const MODEL_BUILDERS = {
  humpback: createHumpback,
  shark: createShark,
  turtle: createSeaTurtle,
  sunfish: createSunfish,
};

const CREATURE_SPECS = {
  humpback: { speed: 2.5, depth: -3.4, scaleZ: true, radius: 16, hitRadius: 5.5, avoidDist: 0, maxDist: 85 },
  shark:    { speed: 2.3, depth: -2.5, scaleZ: false, radius: 5,  hitRadius: 3.4, avoidDist: 13, maxDist: 58 },
  turtle:   { speed: 1.45, depth: -1.9, scaleZ: false, radius: 3, hitRadius: 3.0, avoidDist: 8,  maxDist: 48 },
  sunfish:  { speed: 0.95, depth: -2.6, scaleZ: false, radius: 5.5, hitRadius: 3.8, avoidDist: 7,  maxDist: 48 },
};

export class OceanCreatures {
  constructor(scene, sea) {
    this.scene = scene;
    this.sea = sea;
    this.camera = null;
    this.frustum = new THREE.Frustum();
    this.projScreenMatrix = new THREE.Matrix4();
    this.checkSphere = new THREE.Sphere();

    this.group = new THREE.Group();
    scene.add(this.group);

    this.items = [];
    // デフォルト海域（オホーツク海）の初期構成をセットアップ
    this.setArea({ creatures: ['humpback', 'sunfish', 'sunfish', 'turtle'] }, new THREE.Vector3(0, -2.4, 0), { S: 1, V: 1, T: 1, P: 1 }, 0);
  }

  setCamera(camera) {
    this.camera = camera;
  }

  // カメラの視野（画面内）に映っているかを判定
  isInView(pos, radius = 5) {
    if (!this.camera) return true;
    this.camera.updateMatrixWorld();
    this.projScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix);
    return this.frustum.intersectsSphere(this.checkSphere.set(pos, radius));
  }

  // 海域に応じたゲストNPC編成をセットアップし、プレイヤー周辺に自然配置する
  setArea(area, playerPos, Z = { S: 1, V: 1, T: 1, P: 1 }, playerYaw = 0) {
    for (const it of this.items) {
      this.group.remove(it.group);
    }
    this.items = [];

    const roster = area?.creatures ?? ['humpback', 'sunfish', 'turtle', 'shark'];
    const fwdX = Math.sin(playerYaw), fwdZ = Math.cos(playerYaw);
    const rightX = fwdZ, rightZ = -fwdX;

    roster.forEach((type, idx) => {
      const builder = MODEL_BUILDERS[type];
      if (!builder) return;
      const { group, flukeGroup, animate } = builder(idx);
      this.group.add(group);

      const spec = CREATURE_SPECS[type] ?? CREATURE_SPECS.shark;
      const item = {
        type,
        spec,
        group,
        flukeGroup,
        animate,
        pos: new THREE.Vector3(0, -100, 0),
        yaw: 0,
        yawRate: 0,
        pitch: 0,
        roll: 0,
        speed: spec.speed * (0.92 + Math.random() * 0.16),
        phase: idx * 2.3 + Math.random() * 3.0,
        active: false,
        spawnTimer: 2 + idx * 3,
      };

      // ステージ開始時からすぐに出会えるよう、小型〜中型NPCは前方〜側方の海中に初期配置する
      if (type !== 'humpback' || idx === 0) {
        item.active = true;
        const sideSign = idx % 2 === 0 ? 1 : -1;
        const sideDist = sideSign * (8 + (idx % 3) * 6) * Z.V;
        const fwdDist = (10 + idx * 5) * Z.V;
        const baseDepth = spec.scaleZ ? spec.depth * Z.S : spec.depth;
        item.pos.set(
          playerPos.x + rightX * sideDist + fwdX * fwdDist,
          baseDepth + (Math.random() - 0.5) * 0.5,
          playerPos.z + rightZ * sideDist + fwdZ * fwdDist
        );
        item.yaw = playerYaw + (sideSign > 0 ? -0.55 : 0.55) + (Math.random() - 0.5) * 0.4;
        group.position.copy(item.pos);
        group.rotation.set(0, item.yaw, 0, 'YXZ');
      } else {
        group.position.set(0, -100, 0);
      }

      this.items.push(item);
    });
  }

  // 図鑑ホバー判定：マウスレイが当たった生き物の種別ID（'humpback' | 'shark' | 'turtle' | 'sunfish'）を返す
  // 小型〜中型の生き物もストレスなくポイントできるよう、メッシュ厳密判定に加えてゆとりのある球体判定を行う
  pick(ray, Z = { V: 1 }) {
    const v = Math.max(1, Z?.V ?? 1);
    for (const it of this.items) {
      if (!it.active) continue;
      if (ray.intersectObjects(it.group.children, true).length > 0) {
        return it.type;
      }
      const r = (it.spec.hitRadius ?? 3.2) * Math.pow(v, 0.65);
      if (ray.ray.distanceSqToPoint(it.pos) <= r * r) {
        return it.type;
      }
    }
    return null;
  }

  _spawnItem(it, playerPos, playerYaw, Z) {
    const { type, spec } = it;
    it.active = true;
    const baseDepth = spec.scaleZ ? spec.depth * Z.S : spec.depth;

    if (type === 'humpback') {
      // ザトウクジラは視界の横（約36m）から出現し、悠然と進路を横切る
      const sideAngle = playerYaw + (Math.random() < 0.5 ? 1.25 : -1.25);
      const dist = (35 + Math.random() * 8) * Z.V;
      it.pos.set(
        playerPos.x + Math.sin(sideAngle) * dist,
        baseDepth,
        playerPos.z + Math.cos(sideAngle) * dist
      );
      it.yaw = playerYaw + (sideAngle > playerYaw ? -1.65 : 1.65) + (Math.random() - 0.5) * 0.25;
    } else {
      // サメ・ウミガメ・マンボウはプレイヤーの進行方向の少し先（画面外）に湧いて自然に出会う
      const a = playerYaw + (Math.random() - 0.5) * 2.2;
      const d = (22 + Math.random() * 14) * Z.V;
      it.pos.set(
        playerPos.x + Math.sin(a) * d,
        baseDepth + (Math.random() - 0.5) * 0.6,
        playerPos.z + Math.cos(a) * d
      );
      it.yaw = a + Math.PI + (Math.random() - 0.5) * 1.2;
    }
    it.yawRate = 0;
  }

  update(dt, playerPos, playerYaw, Z) {
    for (const it of this.items) {
      const { type, spec } = it;
      it.phase += dt;

      if (!it.active) {
        it.spawnTimer -= dt;
        if (it.spawnTimer <= 0) {
          this._spawnItem(it, playerPos, playerYaw, Z);
        }
        continue;
      }

      const baseDepth = spec.scaleZ ? spec.depth * Z.S : spec.depth;

      if (type === 'humpback') {
        // ザトウクジラ：緩やかな回遊と雄大な上下進行波
        const yawRate = Math.sin(it.phase * 0.18) * 0.04;
        it.yaw += yawRate * dt;
        if (it.animate) it.animate(dt, it.speed, yawRate);

        const wavePitch = Math.sin(it.phase * 0.95 - 1.1) * 0.045;
        const waveRoll = Math.sin(it.phase * 0.45) * 0.035 - yawRate * 0.8;

        it.pos.x += Math.sin(it.yaw) * it.speed * dt;
        it.pos.z += Math.cos(it.yaw) * it.speed * dt;
        it.pos.y = baseDepth + Math.sin(it.phase * 0.38) * 0.4;

        it.group.position.copy(it.pos);
        it.group.rotation.set(wavePitch, it.yaw, waveRoll, 'YXZ');
      } else {
        // サメ・ウミガメ・マンボウ：クジラと程よい距離を保ちつつ特徴的な泳法で回遊
        const dx = it.pos.x - playerPos.x, dz = it.pos.z - playerPos.z;
        const dPlayer = Math.hypot(dx, dz);
        let wantYawRate = Math.sin(it.phase * 0.4) * 0.28;

        if (dPlayer < spec.avoidDist * Z.S) {
          const avoidYaw = Math.atan2(dx, dz);
          let diff = avoidYaw - it.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          wantYawRate = Math.max(-1.4, Math.min(1.4, diff * 1.6));
        }

        it.yawRate += (wantYawRate - it.yawRate) * Math.min(1, dt * 3.5);
        it.yaw += it.yawRate * dt;

        if (it.animate) {
          it.animate(dt, it.speed, it.yawRate);
        }

        it.pos.x += Math.sin(it.yaw) * it.speed * dt;
        it.pos.z += Math.cos(it.yaw) * it.speed * dt;

        if (type === 'turtle') {
          // ウミガメ：前脚の羽ばたきに合わせて緩やかに上下グライド
          it.pos.y = baseDepth + Math.sin(it.phase * 0.7) * 0.35;
          const glidePitch = Math.cos(it.phase * 2.4) * 0.05;
          it.roll += (-it.yawRate * 0.35 - it.roll) * Math.min(1, dt * 4.0);
          it.group.position.copy(it.pos);
          it.group.rotation.set(glidePitch, it.yaw, it.roll, 'YXZ');
        } else if (type === 'sunfish') {
          // マンボウ：上下ヒレのスカリングに合わせて体を左右にゆったりロールさせながら漂う
          it.pos.y = baseDepth + Math.sin(it.phase * 0.35) * 0.25;
          const scullRoll = Math.sin(it.phase * 2.4) * 0.14 - it.yawRate * 0.2;
          const lazyPitch = Math.sin(it.phase * 0.5) * 0.04;
          it.group.position.copy(it.pos);
          it.group.rotation.set(lazyPitch, it.yaw, scullRoll, 'YXZ');
        } else {
          // ヨシキリザメ：水平を保ちつつS字波でシャープに遊泳
          it.roll += (-it.yawRate * 0.28 - it.roll) * Math.min(1, dt * 5.0);
          it.group.position.copy(it.pos);
          it.group.rotation.set(0, it.yaw, it.roll, 'YXZ');
        }
      }

      // 画面外かつ遠くに離れたら再配置待機へ（画面内に映っている間は絶対に消さない）
      const dist = it.pos.distanceTo(playerPos);
      if (dist > spec.maxDist * Z.V && !this.isInView(it.pos, spec.radius)) {
        it.active = false;
        it.group.position.set(0, -100, 0);
        it.spawnTimer = type === 'humpback' ? (25 + Math.random() * 25) : (5 + Math.random() * 10);
      }
    }
  }
}
