import * as THREE from 'three';
import { Whale } from './whale.js?v=20261107_v33';
import { SPECIES, scalesOf } from './species.js?v=20261107_v21';

// 仲間のクジラたち（ポッド / NPC）
// プレイヤーと同じ Whale クラスを使い、同じ物理と美しい滑らかさで自律して泳ぐ
//   - 各海域開始時の位置関係・向き・連携状態（並走/自由回遊）・体格（若鯨〜大柄な成獣）・色調を毎回ランダム生成
//   - 点座標への急激な方向転換やワープを排除し、常に優雅な大きな曲線を描いて泳ぐ
//   - タイトル画面でも体勢が崩れず、プレイヤーのまわりをゆったりと回遊
//   - プレイヤーが近づくと、個体ごとの協調性（cohesion）に応じて並走（隊列）を組み、しばらくするとまた自然に分かれていく
//   - 仲間が鳴いたときは、水中の波紋と画面端の指向性インジケータで方向がわかる

const STROKE_UP = 0.25, STROKE_DOWN = 0.5;
const LUNGE_OPEN = 0.2;
const LUNGE_PUSH_END = STROKE_UP + STROKE_DOWN;

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

// 基準色を個体の明暗・色味シフトで自然に変化させるヘルパー
function shiftColor(hex, lumDelta, coolDelta = 0) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  hsl.h = (hsl.h + coolDelta + 1) % 1;
  hsl.l = Math.max(0.05, Math.min(0.97, hsl.l + lumDelta));
  c.setHSL(hsl.h, hsl.s, hsl.l);
  return c.getHex();
}

export class WhalePod {
  constructor(scene, sea, spout, soundRings, voice, fish, soundIndicator = null) {
    this.scene = scene;
    this.sea = sea;
    this.spout = spout;
    this.soundRings = soundRings;
    this.voice = voice;
    this.fish = fish;
    this.soundIndicator = soundIndicator;
    this.camera = null;

    this.members = [];
    this.area = null;
    this.Z = { S: 1, V: 1, T: 1, P: 1 };
  }

  get depth() {
    return this.sea?.depth ?? this.sea?.sea?.depth ?? -2.4;
  }

  setCamera(camera) {
    this.camera = camera;
  }

  // 個体ごとのランダムな体格・プロポーション・体色バリエーションを生成
  _createRandomVariation(baseSpecies, index, totalCount) {
    // 仲間のサイズ：50〜60% の子クジラ（頭でっかち・寄り添い）か、90〜95% の仲間クジラをランダム決定
    const isCalf = totalCount === 2 ? (index === 0 ? (Math.random() < 0.6) : !this._lastWasCalf) : (Math.random() < 0.5);
    this._lastWasCalf = isCalf;

    let sizeScale, headWide, eye, uShapeHead, dorsalSize, slim, deep;

    if (isCalf) {
      // 50〜60% の子クジラ（頭が丸く大きく、目がつぶらで愛らしい幼体プロポーション）
      sizeScale = randRange(0.50, 0.60);
      headWide = (baseSpecies.headWide ?? 1.0) * randRange(1.18, 1.28);
      eye = (baseSpecies.eye ?? 1.0) * 1.35;
      uShapeHead = true;
      dorsalSize = randRange(1.12, 1.28);
      slim = randRange(0.93, 1.03);
      deep = randRange(1.03, 1.09);
    } else {
      // 90%〜 の仲間クジラ（自分1.0より少し控えめな標準成体）
      sizeScale = randRange(0.90, 0.95);
      headWide = baseSpecies.headWide ?? 1.0;
      eye = baseSpecies.eye ?? 1.0;
      uShapeHead = baseSpecies.uShapeHead ?? false;
      dorsalSize = randRange(0.88, 1.05);
      slim = randRange(0.96, 1.03);
      deep = randRange(0.98, 1.04);
    }

    const dorsalU = (baseSpecies.dorsalU ?? 0.69) + randRange(-0.02, 0.02);
    const basePec = baseSpecies.pecScale ?? [0.5, 0.03, 0.12];
    const pecScale = [
      basePec[0] * randRange(0.92, 1.10),
      basePec[1] * randRange(0.92, 1.10),
      basePec[2] * randRange(0.92, 1.10),
    ];
    const flukeScale = [
      randRange(0.92, 1.10),
      1.0,
      randRange(0.92, 1.10),
    ];

    // 体色のランダムな個体差（仔鯨は少し明るい青みがかったトーン）
    const lumShift = isCalf ? randRange(0.02, 0.08) : randRange(-0.05, 0.05);
    const hueShift = isCalf ? randRange(0.01, 0.03) : randRange(-0.02, 0.02);
    const bc = baseSpecies.colors;
    const colors = {
      back: shiftColor(bc.back, lumShift, hueShift),
      flank: shiftColor(bc.flank, lumShift * 1.1, hueShift),
      belly: shiftColor(bc.belly, lumShift * 0.4, 0),
      patch: shiftColor(bc.patch, lumShift * 0.9, hueShift),
    };

    return {
      isCalf,
      length: baseSpecies.length * sizeScale,
      headWide,
      eye,
      uShapeHead,
      slim,
      deep,
      dorsalSize,
      dorsalU,
      pecScale,
      flukeScale,
      colors,
    };
  }

  // 海域ごとの仲間の設定（位置関係・サイズ感・連携関係を毎回ランダム化）
  setArea(area, playerPos, Z, playerYaw = 0) {
    this.area = area;
    this.Z = Z;

    for (const m of this.members) {
      this.scene.remove(m.whale.group);
    }
    this.members = [];

    // 海域ごとの仲間クジラ（南極海はクロミンク、他海域は同種）
    const companionSpeciesKey = area.id === 'antarctic' ? 'antarctic_minke' : (area.whale ?? 'minke');
    // 仲間の頭数は 1〜2 頭（多すぎて画面が騒がしくならない規模）
    const count = 1 + (Math.random() < 0.5 ? 1 : 0);

    const baseSpecies = SPECIES[companionSpeciesKey];

    const fwdX = Math.sin(playerYaw), fwdZ = Math.cos(playerYaw);
    const rightX = fwdZ, rightZ = -fwdX;

    // 他の個体やプレイヤーと重ならないランダム初期配置を生成
    // 先に全メンバーのバリエーション（仔鯨か仲間鯨か）を決定
    const variations = [];
    for (let i = 0; i < count; i++) {
      variations.push(this._createRandomVariation(baseSpecies, i, count));
    }

    const placedOffsets = [];
    for (let i = 0; i < count; i++) {
      const isCalf = variations[i].isCalf;
      let side = 0, fwd = 0;
      for (let attempt = 0; attempt < 25; attempt++) {
        if (isCalf) {
          // 子クジラ：近すぎず視界や進路を邪魔しない適度な距離に初期配置
          const sign = Math.random() < 0.5 ? 1 : -1;
          side = sign * randRange(3.8, 6.2);
          fwd = randRange(-2.5, 1.8);
        } else if (i === 0) {
          // 仲間クジラ1頭目：視界に入りやすい前方〜斜め横
          const sign = Math.random() < 0.5 ? 1 : -1;
          side = sign * randRange(4.6, 8.5);
          fwd = randRange(-2.0, 7.5);
        } else {
          // 仲間クジラ2頭目：周囲の広い範囲
          const angle = randRange(-Math.PI * 0.85, Math.PI * 0.85);
          const dist = randRange(6.0, 14.0);
          side = Math.sin(angle) * dist;
          fwd = Math.cos(angle) * dist;
        }
        // プレイヤー自身（0,0）および既に配置した仲間との距離が十分離れているか確認
        const minPlayerDist = isCalf ? 3.0 : 4.0;
        const okPlayer = Math.hypot(side, fwd) > minPlayerDist;
        const okOthers = placedOffsets.every((o) => Math.hypot(side - o.side, fwd - o.fwd) > (isCalf ? 3.2 : 4.5));
        if (okPlayer && okOthers) break;
      }
      placedOffsets.push({
        side,
        fwd,
        depthOffset: isCalf ? randRange(-0.18, 0.18) : randRange(-0.32, 0.22),
      });
    }

    for (let i = 0; i < count; i++) {
      const v = variations[i];
      const isCalf = v.isCalf;
      const indSpecies = Object.assign({}, baseSpecies, v);
      if (v.colors) indSpecies.colors = Object.assign({}, baseSpecies.colors, v.colors);
      const memberZ = scalesOf(indSpecies);

      const whale = new Whale({ species: indSpecies });
      this.scene.add(whale.group);

      const off = placedOffsets[i];
      const sideDist = off.side * Z.V;
      const fwdDist = off.fwd * Z.V;

      const x = playerPos.x + rightX * sideDist + fwdX * fwdDist;
      const z = playerPos.z + rightZ * sideDist + fwdZ * fwdDist;
      const y = this.depth + off.depthOffset;

      whale.group.position.set(x, y, z);
      whale.trail.length = 0;

      // 開始時点の連携関係：
      // 子クジラも仲間と同様に50〜55%で並走、残りは自由回遊（常時追従はしない）
      const startInFormation = Math.random() < 0.52;
      const initialYawOffset = startInFormation
        ? randRange(-0.15, 0.15)
        : randRange(-0.75, 0.75);

      const preferredSide = off.side >= 0 ? 1 : -1;
      // 並走時の希望ポジション（プレイヤーの邪魔にならない適度な間隔）
      // 子クジラ：3.8〜5.8m（プレイヤーの餌や進行を塞がない）
      // 仲間クジラ：4.6〜8.2m
      const formSideDist = isCalf
        ? preferredSide * randRange(3.8, 5.8)
        : preferredSide * randRange(4.6, 8.2);
      const formFwdDist = isCalf
        ? randRange(-3.5, 0.5)
        : randRange(-7.0, 5.5);

      // 個体ごとの協調性（プレイヤーの近くで並走に入りやすいか）
      // 子クジラは「多少追従しやすい程度」（0.025〜0.045）、仲間成体は 0.008〜0.026
      const cohesion = isCalf ? randRange(0.025, 0.045) : randRange(0.008, 0.026);

      const st = {
        id: i,
        isCalf,
        speciesKey: companionSpeciesKey,
        species: indSpecies,
        Z: memberZ,
        yaw: playerYaw + initialYawOffset,
        speed: randRange(1.6, 2.2) * memberZ.P,
        targetSpeed: 1.8 * memberZ.P,
        yawRate: 0,
        smoothYawRate: 0,
        vy: 0,
        riseGoal: 0,
        pitch: 0,
        spouted: false,
        spoutT: -1,
        lungeT: -1,
        eaten: 0,
        gulp: 0,
        open: 0,
        breathT: -1,
        sinceBreath: isCalf ? randRange(3, 18) : randRange(4, 28),
        replyTimer: -1,
        autoCallTimer: isCalf ? randRange(10, 30) : randRange(14, 42),
        mode: startInFormation ? 'formation' : 'free',
        modeTimer: startInFormation ? randRange(7, 16) : randRange(10, 24),
        preferredSide,
        formSideDist,
        formFwdDist,
        depthOffset: off.depthOffset,
        cohesion,
        autoT: randRange(0, 120),
      };

      this.members.push({ whale, st });
    }
  }

  onPlayerCall(playerPos) {
    for (const m of this.members) {
      const d = m.whale.group.position.distanceTo(playerPos);
      if (d < 110 * this.Z.V && m.st.replyTimer < 0) {
        // 子クジラは少し早めに返答（甘えたような早い鳴き返し）
        m.st.replyTimer = m.st.isCalf ? (0.4 + Math.random() * 0.7) : (0.7 + Math.random() * 1.5);
        // 声をかけられたら追従しやすい：
        // 子クジラは呼ばれると高確率（85%）で並走に入り、母クジラのもとへ泳ぎ寄ってくる
        // 成体の仲間も 50% 程度でゆったり並走に入る
        const joinProb = m.st.isCalf ? 0.85 : 0.50;
        if (Math.random() < joinProb) {
          m.st.mode = 'formation';
          m.st.modeTimer = m.st.isCalf ? randRange(14, 25) : randRange(8, 18);
        }
      }
    }
  }

  pick(ray) {
    for (const m of this.members) {
      if (ray.intersectObject(m.whale.body, false).length > 0) {
        return m.st.speciesKey;
      }
    }
    return null;
  }

  _emitCall(m, playerPos) {
    const { whale, st } = m;
    const p = whale.group.position;
    const gain = this.voice.play(st.speciesKey, p, playerPos);
    this.soundRings.emit(p, st.Z.S);
    if (this.soundIndicator && this.camera) {
      this.soundIndicator.show(p, this.camera, gain);
    }
  }

  update(dt, playerPos, playerYaw, playerSpeed = 1.5, isPlaying = true) {
    const fwdX = Math.sin(playerYaw), fwdZ = Math.cos(playerYaw);
    const rightX = fwdZ, rightZ = -fwdX;

    for (let i = 0; i < this.members.length; i++) {
      const m = this.members[i];
      const { whale, st } = m;
      const p = whale.group.position;
      const Z = st.Z;
      st.autoT += dt;

      // 鳴き返しのタイマー処理
      if (st.replyTimer > 0) {
        st.replyTimer -= dt;
        if (st.replyTimer <= 0) {
          st.replyTimer = -1;
          this._emitCall(m, playerPos);
        }
      }

      // 自発的な鳴き声タイマー
      st.autoCallTimer -= dt;
      if (st.autoCallTimer <= 0) {
        st.autoCallTimer = 22 + Math.random() * 35;
        this._emitCall(m, playerPos);
      }

      const distToPlayer = p.distanceTo(playerPos);
      st.modeTimer -= dt;

      // 目標の旋回角（targetYaw）と速度（desiredSpeed）を滑らかに計算
      let targetYaw = st.yaw;
      let desiredSpeed = (1.6 + 0.35 * Math.sin(st.autoT * 0.3)) * Z.P;

      if (!isPlaying) {
        // ---- タイトル画面中 ----
        const wave = Math.sin(st.autoT * 0.18 + st.id * 1.9) * 0.45 + Math.sin(st.autoT * 0.06) * 0.35;
        targetYaw = playerYaw + wave;

        if (distToPlayer > 18 * this.Z.V) {
          const toPlayerYaw = Math.atan2(playerPos.x - p.x, playerPos.z - p.z);
          let diff = toPlayerYaw - targetYaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          targetYaw += diff * 0.4;
        }
        desiredSpeed = 2.0 * Z.P;
      } else {
        // ---- プレイ中 ----
        if (st.mode === 'formation') {
          if (st.modeTimer <= 0) {
            // 隊列を解消して、自由気ままな回遊へ（子クジラも常時追従せず海を泳ぎ回る）
            st.mode = 'free';
            st.modeTimer = randRange(12, 26);
            st.preferredSide = Math.random() < 0.5 ? 1 : -1;
            st.formSideDist = st.preferredSide * (st.isCalf ? randRange(3.8, 5.8) : randRange(4.6, 8.2));
            st.formFwdDist = st.isCalf ? randRange(-3.5, 0.5) : randRange(-7.0, 5.5);
          } else {
            // 個体ごとの並走スロット位置（邪魔にならない適度な間隔）
            const sideDist = st.formSideDist * this.Z.V;
            const fwdDist = st.formFwdDist * this.Z.V;
            const tx = playerPos.x + rightX * sideDist + fwdX * fwdDist;
            const tz = playerPos.z + rightZ * sideDist + fwdZ * fwdDist;

            const toFormYaw = Math.atan2(tx - p.x, tz - p.z);
            let diff = toFormYaw - playerYaw;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            targetYaw = playerYaw + Math.max(-0.6, Math.min(0.6, diff));

            const dForm = Math.hypot(tx - p.x, tz - p.z);
            desiredSpeed = playerSpeed;
            if (st.isCalf) {
              if (dForm > 3.0 * this.Z.V) desiredSpeed = Math.max(playerSpeed * 1.25, 3.0 * Z.P);
              else if (dForm < 1.2 * this.Z.V) desiredSpeed = Math.min(playerSpeed * 0.9, 1.4 * Z.P);
            } else {
              if (dForm > 4 * this.Z.V) desiredSpeed = Math.max(playerSpeed * 1.25, 3.0 * Z.P);
              else if (dForm < 1.5 * this.Z.V) desiredSpeed = Math.min(playerSpeed * 0.88, 1.2 * Z.P);
            }
          }
        } else if (st.mode === 'free') {
          // 自由気ままな回遊：なめらかな自然の波で泳ぐ
          const wave = Math.sin(st.autoT * 0.16 + st.id * 2.1) * 0.5 + Math.sin(st.autoT * 0.05) * 0.3;
          targetYaw = st.yaw + wave * dt;

          // プレイヤーが仲間クジラの近く（12m 以内）に寄ってきたとき、個体ごとの協調性（cohesion）に応じて並走を組む
          // （子クジラは少し並走に入りやすい程度で、常時くっつくことはない）
          if (distToPlayer < 12 * this.Z.V && st.modeTimer < 10 && Math.random() < st.cohesion) {
            st.mode = 'formation';
            st.modeTimer = st.isCalf ? randRange(10, 20) : randRange(8, 16);
          }

          // 近く（15m 以内）に魚の群れがあれば、たまに食事モードへ
          if (st.lungeT < 0 && st.breathT < 0 && Math.random() < 0.022) {
            if (this.fish && this.fish.schools) {
              for (const sc of this.fish.schools) {
                if (sc.alive > sc.size * 0.25 && p.distanceTo(sc.center) < 15 * this.Z.V) {
                  st.mode = 'feed';
                  st.feedTarget = sc.center;
                  st.modeTimer = 5.0;
                  st.lungeT = 0;
                  break;
                }
              }
            }
          }

          // プレイヤーから離れすぎたら、自然にプレイヤーのいる海域へ旋回して戻る（ワープはしない）
          if (distToPlayer > 34 * this.Z.V) {
            const toPlayerYaw = Math.atan2(playerPos.x - p.x, playerPos.z - p.z);
            let diff = toPlayerYaw - st.yaw;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            targetYaw = st.yaw + diff * 0.6;
            desiredSpeed = Math.max(playerSpeed * 1.2, 3.2 * Z.P);
          }
        } else if (st.mode === 'feed') {
          if (st.modeTimer <= 0 || st.lungeT < 0 || !st.feedTarget) {
            st.mode = 'free';
            st.modeTimer = randRange(10, 20);
          } else {
            targetYaw = Math.atan2(st.feedTarget.x - p.x, st.feedTarget.z - p.z);
          }
        }
      }

      // 旋回処理：急旋回を抑え、クジラらしい滑らかで大きな弧（最小回転半径 2m*S）を描く
      let yawDiff = targetYaw - st.yaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;

      const maxTurn = (0.75 / Z.S) * dt;
      const turn = Math.max(-maxTurn, Math.min(maxTurn, yawDiff * 1.4 * dt));
      st.yaw += turn;
      st.yawRate = turn / dt;

      // ロールの急激なガタつきを防ぐため、yawRate をローパスフィルタで平滑化
      st.smoothYawRate += (st.yawRate - st.smoothYawRate) * Math.min(1, dt * 3.5);

      st.targetSpeed = desiredSpeed;

      // 突進アニメーション
      if (st.lungeT >= 0) {
        st.lungeT += dt;
        const tn = st.lungeT / Z.T;
        if (tn < LUNGE_PUSH_END) {
          st.targetSpeed = Math.max(st.targetSpeed, 6.2 * Z.P);
        } else if (tn < 2.0) {
          st.targetSpeed = Math.max(st.targetSpeed, 4.2 * Z.P);
        } else if (tn < 3.2) {
          st.targetSpeed = 2.0 * Z.P;
        } else {
          st.lungeT = -1;
        }
        if (tn >= LUNGE_OPEN && tn < LUNGE_OPEN + 0.35) {
          st.open = (tn - LUNGE_OPEN) / 0.35;
        } else if (tn >= 1.6 && tn < 2.1) {
          st.open = Math.max(0, 1 - (tn - 1.6) / 0.5);
        } else if (tn >= 2.1) {
          st.open = 0;
        }
        if (tn >= LUNGE_OPEN && tn < 2.0) {
          st.gulp = Math.min(1.0, st.gulp + dt * 1.8);
        } else if (tn >= 2.2) {
          st.gulp = Math.max(0, st.gulp - dt * 0.9);
        }
      } else {
        st.open = 0;
        st.gulp = Math.max(0, st.gulp - dt * 0.8);
      }

      // 加速
      st.speed += (st.targetSpeed - st.speed) * Math.min(1, dt * 1.6);
      p.x += Math.sin(st.yaw) * st.speed * dt;
      p.z += Math.cos(st.yaw) * st.speed * dt;

      // 呼吸（息つぎ）：35〜55秒ごとに浮上して潮を吹く
      st.sinceBreath += dt;
      if (st.sinceBreath > 36 && st.breathT < 0 && st.lungeT < 0) {
        st.breathT = 0;
      }

      let riseTarget = 0;
      if (st.spoutT >= 0) st.spoutT += dt;
      if (st.breathT >= 0) {
        st.breathT += dt;
        if (st.breathT < 1.8 * Z.T) riseTarget = 2.3 * Z.S;
        if (!st.spouted && p.y > this.depth + 1.2 * Z.S) {
          st.spouted = true;
          st.spoutT = 0;
          this.spout.emit((v) => whale.blowholeWorld(v), Z.S);
        }
        if (st.breathT > 5 * Z.T) {
          st.breathT = -1;
          st.sinceBreath = 0;
          st.spouted = false;
        }
      }

      const targetDepth = this.depth + (st.depthOffset ?? 0);
      st.riseGoal += (riseTarget - st.riseGoal) * Math.min(1, dt * 1.5 / Z.T);
      const K = 5 / (Z.T * Z.T), C = 2 * Math.sqrt(K);
      st.vy += (K * (targetDepth + st.riseGoal - p.y) - C * st.vy) * dt;
      p.y += st.vy * dt;

      const pitchTarget = Math.max(-0.25, Math.min(0.25, st.vy / Math.max(st.speed, 2 * Z.P) * 0.5));
      st.pitch += (pitchTarget - st.pitch) * Math.min(1, dt * 2);
      // 平滑化した smoothYawRate で自然にロール
      whale.group.rotation.set(-st.pitch, st.yaw, -st.smoothYawRate * 0.7);

      whale.group.updateMatrixWorld();
      whale.animate(dt, st.speed, st.gulp, st.open);

      if (st.open > 0.1 && this.fish) {
        const inv = new THREE.Matrix4().copy(whale.group.matrixWorld).invert();
        this.fish.eatGape(inv, whale.mouthGape(st.open));
      }
    }
  }
}
