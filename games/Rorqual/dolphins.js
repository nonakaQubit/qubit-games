import * as THREE from 'three';
import { createDolphin } from './creatures_models.js?v=20261107_v39';

// イルカ（カマイルカ / Pacific white-sided dolphin）
// クジラが速く泳ぐと寄ってきて、水煙を上げながら並走・ポーポイジング（連続ジャンプ）して遊ぶ
// creatures_models.js の3Dハイドロフォイル造形＆全身うねり・ジャンプ弓なりアニメーションを使用
// ★重要：画面内での突然の消滅を完全防止（カメラ錐台による視界チェック＆離脱遊泳）

const DOLPHIN_COUNT = 3;

export class Dolphins {
  constructor(scene, sea, spout = null) {
    this.scene = scene;
    this.sea = sea;
    this.spout = spout;
    this.camera = null;
    this.enabled = true;
    this.frustum = new THREE.Frustum();
    this.projScreenMatrix = new THREE.Matrix4();
    this.checkSphere = new THREE.Sphere();
    this._splashPos = new THREE.Vector3();

    this.group = new THREE.Group();
    scene.add(this.group);

    this.dolphins = [];

    for (let i = 0; i < DOLPHIN_COUNT; i++) {
      const { group: dGroup, flukeGroup, animate } = createDolphin();
      this.group.add(dGroup);

      this.dolphins.push({
        group: dGroup,
        flukeGroup,
        animate,
        pos: new THREE.Vector3(0, -100, 0),
        yaw: 0,
        yawRate: 0,
        pitch: 0,
        roll: 0,
        speed: 2.5,
        phase: i * 2.1,
        jumpT: -1,
        jumpCooldown: 0.6 + i * 0.9, // 順番にリズミカルに跳ねる
        exitSplashed: false,
        entrySplashed: false,
        active: false,
        leaving: false, // 離脱モード中か
        sideOffset: (i === 0 ? 1 : i === 1 ? -1 : 1.4) * (4.5 + i * 1.8),
        fwdOffset: 3.5 - i * 3.5,
      });
    }
  }

  setCamera(camera) {
    this.camera = camera;
  }

  setArea(area) {
    this.enabled = area?.dolphins !== false;
    for (const d of this.dolphins) {
      d.active = false;
      d.leaving = false;
      d.jumpT = -1;
      d.group.position.set(0, -100, 0);
    }
  }

  // カメラ視野内に映っているかを判定
  isInView(pos, radius = 3.5) {
    if (!this.camera) return true;
    this.camera.updateMatrixWorld();
    this.projScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix);
    return this.frustum.intersectsSphere(this.checkSphere.set(pos, radius));
  }

  update(dt, playerPos, playerYaw, playerSpeed, Z) {
    const fwdX = Math.sin(playerYaw), fwdZ = Math.cos(playerYaw);
    const rightX = fwdZ, rightZ = -fwdX;

    // クジラが一定以上のスピード（2.8m/s 以上、ダッシュや加速時）を出しているとイルカが寄ってくる
    const shouldJoin = this.enabled && playerSpeed > 2.8 * Z.P;

    for (let i = 0; i < DOLPHIN_COUNT; i++) {
      const d = this.dolphins[i];
      d.phase += dt * (d.speed * 2.2);

      // 合流開始
      if (shouldJoin && !d.active) {
        d.active = true;
        d.leaving = false;
        d.jumpT = -1;
        d.jumpCooldown = 0.5 + i * 0.8;
        const startSide = d.sideOffset * 2.5 * Z.V;
        const startBack = -22 * Z.V;
        d.pos.set(
          playerPos.x + rightX * startSide + fwdX * startBack,
          -1.6,
          playerPos.z + rightZ * startSide + fwdZ * startBack
        );
        d.yaw = playerYaw;
        d.yawRate = 0;
        d.speed = playerSpeed * 1.25;
      }

      if (!d.active) {
        d.group.position.set(0, -100, 0);
        continue;
      }

      // プレイヤーが遅くなった場合：即消滅ではなく「離脱モード」へ
      if (!shouldJoin && !d.leaving) {
        d.leaving = true;
      }

      if (d.leaving) {
        // 離脱中は斜め前方・外側へスピードを保ちつつ泳ぎ去る
        const leaveSide = d.sideOffset > 0 ? 1 : -1;
        d.yawRate = leaveSide * 0.45;
        d.yaw += d.yawRate * dt;
        d.speed = Math.max(d.speed, 3.5 * Z.P);
        d.pos.x += Math.sin(d.yaw) * d.speed * dt;
        d.pos.z += Math.cos(d.yaw) * d.speed * dt;
        // 徐々に深く潜っていく
        d.pos.y = Math.max(-5.5, d.pos.y - dt * 0.8);
        d.pitch = -0.15;

        if (d.animate) {
          d.animate(dt, d.speed, d.yawRate, 0);
        }

        d.group.position.copy(d.pos);
        d.group.rotation.set(-d.pitch, d.yaw, -d.yawRate * 0.5, 'YXZ');

        // ★超重要：画面外に出て、かつ十分離れたら非アクティブにする！
        const dist = d.pos.distanceTo(playerPos);
        if (dist > 35 * Z.V && !this.isInView(d.pos, 4)) {
          d.active = false;
          d.leaving = false;
          d.group.position.set(0, -100, 0);
        }
        continue;
      }

      // ---- 通常の並走状態 ----
      const targetSide = d.sideOffset * Z.V;
      const targetFwd = d.fwdOffset * Z.V;
      const tx = playerPos.x + rightX * targetSide + fwdX * targetFwd;
      const tz = playerPos.z + rightZ * targetSide + fwdZ * targetFwd;

      const dFwdX = Math.sin(d.yaw), dFwdZ = Math.cos(d.yaw);
      let jumpArch = 0;

      // ジャンプ（ポーポイジング）処理：水面突破＆着水時に鮮やかな水煙・白波を上げる！
      if (d.jumpT >= 0) {
        d.jumpT += dt;
        const progress = d.jumpT / 1.10;
        if (progress < 1.0) {
          d.pos.y = -1.4 + Math.sin(progress * Math.PI) * 2.8;
          d.pitch = Math.cos(progress * Math.PI) * 0.76;
          // 放物線軌道に合わせてイルカの全身を美しい弓なり（アーチ）にしならせる
          jumpArch = Math.sin(progress * Math.PI) * 0.9;

          if (this.spout) {
            // 1. 水面突破（飛び出し）の水煙
            if (!d.exitSplashed && progress >= 0.10) {
              d.exitSplashed = true;
              this._splashPos.set(d.pos.x + dFwdX * 0.4, 0.08, d.pos.z + dFwdZ * 0.4);
              this.spout.emitDolphinSplash(this._splashPos, dFwdX, dFwdZ, 0.85);
            }
            // 2. 飛び出し直後・着水直前の水面切り航跡しぶき
            if ((progress > 0.08 && progress < 0.28) || (progress > 0.72 && progress < 0.92)) {
              this._splashPos.set(d.pos.x, 0.08, d.pos.z);
              this.spout.emitWake(this._splashPos, 0.42, 1);
            }
            // 3. 着水（頭から水面へ飛び込む瞬間）の豪快な水煙・白波
            if (!d.entrySplashed && progress >= 0.78) {
              d.entrySplashed = true;
              this._splashPos.set(d.pos.x + dFwdX * 0.85, 0.08, d.pos.z + dFwdZ * 0.85);
              this.spout.emitDolphinSplash(this._splashPos, dFwdX, dFwdZ, 1.15);
            }
          }
        } else {
          d.jumpT = -1;
          d.pos.y = -1.4;
          d.pitch = 0;
          d.jumpCooldown = 1.6 + Math.random() * 2.4;
        }
      } else {
        // 水中並走中（不要な上下ピッチングを抑え、水面下で滑らかに並走しつつ定期的にジャンプへ移行）
        d.pos.y = -1.4 + Math.sin(d.phase * 0.4) * 0.14;
        d.pitch = Math.cos(d.phase * 0.4) * 0.04;

        d.jumpCooldown -= dt;
        // 並走中は生き生きと順番に水面へジャンプ（ポーポイジング）する
        if (d.jumpCooldown <= 0 && playerSpeed > 3.0 * Z.P) {
          d.jumpT = 0;
          d.exitSplashed = false;
          d.entrySplashed = false;
        }
      }

      // 追従移動
      const dx = tx - d.pos.x, dz = tz - d.pos.z;
      const toTargetYaw = Math.atan2(dx, dz);
      let diff = toTargetYaw - d.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      const wantYawRate = Math.max(-2.2, Math.min(2.2, diff * 3.2));
      d.yawRate += (wantYawRate - d.yawRate) * Math.min(1, dt * 6.0);
      d.yaw += d.yawRate * dt;
      d.roll += (-d.yawRate * 0.45 - d.roll) * Math.min(1, dt * 6.0);
      d.speed = Math.max(playerSpeed * 1.06, 3.2 * Z.P);

      if (d.animate) {
        d.animate(dt, d.speed, d.yawRate, jumpArch);
      }

      d.pos.x += Math.sin(d.yaw) * d.speed * dt;
      d.pos.z += Math.cos(d.yaw) * d.speed * dt;

      d.group.position.copy(d.pos);
      d.group.rotation.set(-d.pitch, d.yaw, d.roll, 'YXZ');
    }
  }
}
