import * as THREE from 'three';

// クジラの鳴き声と水中効果音（SE）、音の波紋エフェクト
// 音は Web Audio API による合成音
// 種ごとに本物の特徴に寄せたピッチと波形を精密生成：
//   - ミンククジラ: 北太平洋の「ボイン（boing）」音（FMスイープ＋エコー）
//   - クロミンククジラ: 南極海の「バイオダック（bio-duck）」低周波パルス音列
//   - ニタリクジラ: 温帯海の情緒ある低音モーン（うなり声、120〜240Hz）
//   - ナガスクジラ: 低周波パルス音列＋倍音共鳴（「海のグレイハウンド」の重厚なパルス）
//   - シロナガスクジラ: 地球最大の超低周波のうなり声（海全体が震える深海の調べ）
// 各種にランダムなピッチ揺らぎ・個体差を導入

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// 画面外の鳴き声の方向・位置を示す視覚インジケータ
export class SoundIndicator {
  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'sound-indicators';
    this.container.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:40;';
    document.body.appendChild(this.container);
    this._v = new THREE.Vector3();
  }

  show(soundPos, camera, distGain = 1.0) {
    if (distGain <= 0.05 || !camera) return;
    this._v.copy(soundPos);
    this._v.project(camera);

    const ndcX = this._v.x;
    const ndcY = this._v.y;
    const isBehind = this._v.z > 1.0;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;
    const cy = h / 2;

    const el = document.createElement('div');
    el.style.cssText = `
      position: absolute;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 1.5s cubic-bezier(0.1, 0.8, 0.2, 1), transform 1.5s cubic-bezier(0.1, 0.8, 0.2, 1);
      opacity: 0;
      color: #9be8ff;
      filter: drop-shadow(0 0 8px rgba(155, 232, 255, 0.7));
    `;

    const isInside = !isBehind && Math.abs(ndcX) < 0.82 && Math.abs(ndcY) < 0.82;

    if (isInside) {
      const sx = (ndcX * 0.5 + 0.5) * w;
      const sy = (-ndcY * 0.5 + 0.5) * h;
      el.style.left = `${sx}px`;
      el.style.top = `${sy}px`;
      el.style.transform = 'translate(-50%, -50%) scale(0.6)';
      el.innerHTML = `
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <circle cx="22" cy="22" r="6" opacity="0.95"/>
          <circle cx="22" cy="22" r="13" opacity="0.65"/>
          <circle cx="22" cy="22" r="20" opacity="0.35"/>
        </svg>
      `;
      this.container.appendChild(el);
      requestAnimationFrame(() => {
        el.style.opacity = `${0.85 * distGain}`;
        el.style.transform = 'translate(-50%, -50%) scale(1.3)';
        setTimeout(() => {
          el.style.opacity = '0';
          el.style.transform = 'translate(-50%, -50%) scale(1.9)';
          setTimeout(() => el.remove(), 1500);
        }, 350);
      });
    } else {
      let dirX = ndcX, dirY = -ndcY;
      if (isBehind) {
        dirX = -dirX;
        dirY = -dirY;
      }
      const len = Math.hypot(dirX, dirY) || 1;
      const nx = dirX / len;
      const ny = dirY / len;
      const angle = Math.atan2(ny, nx) * (180 / Math.PI);

      const margin = 50;
      const maxX = cx - margin;
      const maxY = cy - margin;
      const k = Math.min(Math.abs(maxX / (nx || 1e-5)), Math.abs(maxY / (ny || 1e-5)));

      const px = cx + nx * k;
      const py = cy + ny * k;

      el.style.left = `${px}px`;
      el.style.top = `${py}px`;
      el.style.transform = `translate(-50%, -50%) rotate(${angle}deg) scale(0.7)`;
      el.innerHTML = `
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
          <path d="M 14 16 A 14 14 0 0 1 14 32" opacity="0.95" />
          <path d="M 22 10 A 22 22 0 0 1 22 38" opacity="0.7" />
          <path d="M 30 4 A 30 30 0 0 1 30 44" opacity="0.45" />
        </svg>
      `;
      this.container.appendChild(el);
      requestAnimationFrame(() => {
        el.style.opacity = `${0.95 * distGain}`;
        el.style.transform = `translate(-50%, -50%) rotate(${angle}deg) scale(1.1)`;
        setTimeout(() => {
          el.style.opacity = '0';
          el.style.transform = `translate(-50%, -50%) rotate(${angle}deg) scale(1.4)`;
          setTimeout(() => el.remove(), 1500);
        }, 400);
      });
    }
  }
}

// 鳴き声の合成音
export class WhaleVoice {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
  }

  init() {
    this.ctx = getAudioContext();
    if (!this.ctx) return;
    if (!this.masterGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.34; // チルな適正音量
      this.masterGain.connect(this.ctx.destination);
    }
  }

  // 種ごとの鳴き声を再生。個体差によるピッチ変調（±12%）
  play(speciesId = 'minke', pos = null, listenerPos = null) {
    this.init();
    if (!this.ctx) return 1.0;

    let distGain = 1.0;
    let pan = 0;
    if (pos && listenerPos) {
      const dx = pos.x - listenerPos.x, dz = pos.z - listenerPos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      // 大型クジラ海域でも仲間の鳴き声がしっかり届くよう減衰距離を220mまで拡大
      distGain = Math.max(0, 1 - d / 220);
      pan = Math.max(-0.85, Math.min(0.85, dx / 55));
    }
    if (distGain <= 0.01) return distGain;

    const t0 = this.ctx.currentTime;
    const gainNode = this.ctx.createGain();
    gainNode.gain.value = distGain;

    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = pan;
      gainNode.connect(panner);
      panner.connect(this.masterGain);
    } else {
      gainNode.connect(this.masterGain);
    }

    // 個体ごとのピッチ倍率（0.88〜1.12の自然なランダム揺らぎ）
    const pitchScale = 0.88 + Math.random() * 0.24;

    switch (speciesId) {
      case 'blue':
        this._playBlueWhale(t0, gainNode, pitchScale);
        break;
      case 'fin':
        this._playFinWhale(t0, gainNode, pitchScale);
        break;
      case 'bryde':
        this._playBrydeWhale(t0, gainNode, pitchScale);
        break;
      case 'antarctic_minke':
        this._playAntarcticMinke(t0, gainNode, pitchScale);
        break;
      case 'minke':
      default:
        this._playMinkeBoing(t0, gainNode, pitchScale);
        break;
    }

    return distGain;
  }

  // ミンククジラ：北太平洋の「ボイン（boing）」音
  _playMinkeBoing(t0, out, pScale = 1.0) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';

    const fStart = 1350 * pScale;
    const fMid = 430 * pScale;
    const fEnd = 400 * pScale;

    osc.frequency.setValueAtTime(fStart, t0);
    osc.frequency.exponentialRampToValueAtTime(fMid, t0 + 0.18);
    osc.frequency.linearRampToValueAtTime(fEnd, t0 + 0.9);

    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(0.35, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.25);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800 * pScale, t0);
    filter.frequency.exponentialRampToValueAtTime(650 * pScale, t0 + 0.6);

    const delay = ctx.createDelay();
    delay.delayTime.value = 0.12;
    const delayGain = ctx.createGain();
    delayGain.gain.value = 0.35;

    osc.connect(g);
    g.connect(filter);
    filter.connect(out);
    filter.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(out);
    delayGain.connect(delay);

    osc.start(t0);
    osc.stop(t0 + 1.35);
  }

  // クロミンククジラ：南極海の「バイオダック（bio-duck）」低周波パルス
  _playAntarcticMinke(t0, out, pScale = 1.0) {
    const ctx = this.ctx;
    const pulseCount = 4 + (Math.random() < 0.4 ? 1 : 0);
    for (let i = 0; i < pulseCount; i++) {
      const pt = t0 + i * 0.125;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(185 * pScale, pt);
      osc.frequency.exponentialRampToValueAtTime(90 * pScale, pt + 0.09);

      g.gain.setValueAtTime(0.001, pt);
      g.gain.linearRampToValueAtTime(0.28, pt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, pt + 0.11);

      osc.connect(g);
      g.connect(out);
      osc.start(pt);
      osc.stop(pt + 0.12);
    }
  }

  // ニタリクジラ：温帯海の情緒豊かな低周波モーン（うなり声、120〜240Hz）
  _playBrydeWhale(t0, out, pScale = 1.0) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';

    const baseF = 180 * pScale;
    osc.frequency.setValueAtTime(baseF, t0);
    osc.frequency.linearRampToValueAtTime(baseF * 1.25, t0 + 0.6);
    osc.frequency.exponentialRampToValueAtTime(baseF * 0.75, t0 + 2.0);

    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(0.38, t0 + 0.4);
    g.gain.linearRampToValueAtTime(0.30, t0 + 1.4);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 2.4);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(220 * pScale, t0);
    filter.Q.value = 1.8;

    osc.connect(g);
    g.connect(filter);
    filter.connect(out);

    osc.start(t0);
    osc.stop(t0 + 2.5);
  }

  // ナガスクジラ：低周波パルス音列＋倍音共鳴（小型スピーカーでもはっきり聞こえる重厚な3連パルス）
  _playFinWhale(t0, out, pScale = 1.0) {
    const ctx = this.ctx;
    const pulses = 3;
    for (let i = 0; i < pulses; i++) {
      const pt = t0 + i * 0.48;
      // 1. 重低音の芯（95Hz → 48Hz）
      const osc1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(95 * pScale, pt);
      osc1.frequency.exponentialRampToValueAtTime(48 * pScale, pt + 0.34);
      g1.gain.setValueAtTime(0.001, pt);
      g1.gain.linearRampToValueAtTime(0.52, pt + 0.06);
      g1.gain.exponentialRampToValueAtTime(0.001, pt + 0.40);

      // 2. 可聴域の豊かな倍音パルス（190Hz → 92Hz の三角波＋ローパスで、ノートPC等でも明確に響くパルス音）
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(190 * pScale, pt);
      osc2.frequency.exponentialRampToValueAtTime(92 * pScale, pt + 0.34);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(340 * pScale, pt);
      filter.frequency.exponentialRampToValueAtTime(140 * pScale, pt + 0.34);
      filter.Q.value = 2.2;

      g2.gain.setValueAtTime(0.001, pt);
      g2.gain.linearRampToValueAtTime(0.38, pt + 0.05);
      g2.gain.exponentialRampToValueAtTime(0.001, pt + 0.38);

      osc1.connect(g1);
      g1.connect(out);
      osc2.connect(filter);
      filter.connect(g2);
      g2.connect(out);

      osc1.start(pt);
      osc1.stop(pt + 0.42);
      osc2.start(pt);
      osc2.stop(pt + 0.42);
    }
  }

  // シロナガスクジラ：超低周波の重厚なうなり（地球最大の鳴き声）
  _playBlueWhale(t0, out, pScale = 1.0) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';

    osc.frequency.setValueAtTime(85 * pScale, t0);
    osc.frequency.linearRampToValueAtTime(48 * pScale, t0 + 1.5);
    osc.frequency.linearRampToValueAtTime(32 * pScale, t0 + 3.2);

    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(0.48, t0 + 0.6);
    g.gain.linearRampToValueAtTime(0.38, t0 + 2.4);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 3.6);

    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(170 * pScale, t0);
    osc2.frequency.linearRampToValueAtTime(72 * pScale, t0 + 3.2);
    g2.gain.setValueAtTime(0.001, t0);
    g2.gain.linearRampToValueAtTime(0.24, t0 + 0.5);
    g2.gain.exponentialRampToValueAtTime(0.001, t0 + 3.2);

    osc.connect(g);
    g.connect(out);
    osc2.connect(g2);
    g2.connect(out);

    osc.start(t0);
    osc.stop(t0 + 3.8);
    osc2.start(t0);
    osc2.stop(t0 + 3.8);
  }
}

// 水中効果音（SE：潮吹き・突進加速・飲み込み）
export class SoundEffects {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
  }

  init() {
    this.ctx = getAudioContext();
    if (!this.ctx) return;
    if (!this.masterGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.25;
      this.masterGain.connect(this.ctx.destination);
    }
  }

  // 潮吹き音：ブシューーーッという勢いある水蒸気・噴気音
  playSpout() {
    this.init();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;

    // ノイズバッファの生成（ホワイトノイズ）
    const bufSize = this.ctx.sampleRate * 1.5;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(850, t0);
    filter.frequency.exponentialRampToValueAtTime(350, t0 + 1.2);
    filter.Q.value = 1.2;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(0.40, t0 + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.4);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);

    src.start(t0);
    src.stop(t0 + 1.5);
  }

  // 突進加速音：ゴォォォという推進力と水の轟き
  playLunge() {
    this.init();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(65, t0);
    osc.frequency.exponentialRampToValueAtTime(110, t0 + 0.4);
    osc.frequency.exponentialRampToValueAtTime(45, t0 + 1.2);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(180, t0);
    filter.frequency.linearRampToValueAtTime(320, t0 + 0.4);
    filter.frequency.exponentialRampToValueAtTime(80, t0 + 1.3);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(0.35, t0 + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.3);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);

    osc.start(t0);
    osc.stop(t0 + 1.35);
  }

  // 魚の飲み込み音：ゴクッという水の吸引と満腹音
  playGulp() {
    this.init();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(75, t0 + 0.22);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(0.38, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);

    osc.connect(g);
    g.connect(this.masterGain);

    osc.start(t0);
    osc.stop(t0 + 0.4);
  }

  // 食事ヒット時のマイクロ報酬チャイム倍音：海中に溶け込む澄んだ倍音アルペジオ（食べた量に応じて和音が広がる）
  playFeedChime(richness = 0.5) {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this._lastChimeT && now - this._lastChimeT < 0.18) return;
    this._lastChimeT = now;

    // ペンタトニック系の透明感ある倍音（C5, G5, A5, D6, E6）
    const notes = richness > 0.65 ? [523.25, 783.99, 1046.5, 1318.5] : [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const t0 = now + idx * 0.055;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);

      // 2倍音の微かなきらめき
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2.0, t0);

      const g = this.ctx.createGain();
      const peak = (0.14 + Math.min(0.10, richness * 0.08)) * Math.pow(0.85, idx);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + 0.018);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);

      const g2 = this.ctx.createGain();
      g2.gain.setValueAtTime(0.0001, t0);
      g2.gain.linearRampToValueAtTime(peak * 0.25, t0 + 0.012);
      g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);

      osc.connect(g);
      g.connect(this.masterGain);
      osc2.connect(g2);
      g2.connect(this.masterGain);

      osc.start(t0);
      osc.stop(t0 + 0.6);
      osc2.start(t0);
      osc2.stop(t0 + 0.32);
    });
  }

  // 共有ノイズバッファ（突っかかり・メモリ生成ラグを完全防止）
  _getNoiseBuffer() {
    if (!this._noiseBuf && this.ctx) {
      const len = Math.floor(this.ctx.sampleRate * 0.8);
      const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._noiseBuf = b;
    }
    return this._noiseBuf;
  }

  // ブリーチング飛び出し音：水面を突き破る「ドバッ！ザパァァァッ！」
  playBreachLaunch() {
    this.init();
    if (!this.ctx) return;
    const buf = this._getNoiseBuffer();
    if (!buf) return;
    const t0 = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, t0);
    filter.frequency.linearRampToValueAtTime(1100, t0 + 0.25);
    filter.frequency.exponentialRampToValueAtTime(320, t0 + 1.45);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(0.50, t0 + 0.08);
    g.gain.exponentialRampToValueAtTime(0.15, t0 + 0.9);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.45);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);

    src.start(t0);
    src.stop(t0 + 1.5);
  }

  // ブリーチング着水音：海面を叩き割る豪快な「ドシャーーーン！バシャバシャッ！」
  playBreachSplash() {
    this.init();
    if (!this.ctx) return;
    const buf = this._getNoiseBuffer();
    if (!buf) return;
    const t0 = this.ctx.currentTime;

    // 1. 重低音インパクト（水面激突ショック）
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t0);
    osc.frequency.exponentialRampToValueAtTime(30, t0 + 0.6);
    const gOsc = this.ctx.createGain();
    gOsc.gain.setValueAtTime(0.001, t0);
    gOsc.gain.linearRampToValueAtTime(0.75, t0 + 0.04);
    gOsc.gain.exponentialRampToValueAtTime(0.001, t0 + 0.8);
    osc.connect(gOsc);
    gOsc.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + 0.85);

    // 2. 激しい水破砕・大飛沫ノイズ（キャッシュバッファのループ再生で超軽量）
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, t0);
    filter.frequency.linearRampToValueAtTime(320, t0 + 1.5);
    filter.Q.value = 0.8;

    const gNoise = this.ctx.createGain();
    gNoise.gain.setValueAtTime(0.001, t0);
    gNoise.gain.linearRampToValueAtTime(0.70, t0 + 0.05);
    gNoise.gain.exponentialRampToValueAtTime(0.25, t0 + 0.5);
    gNoise.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.1);

    src.connect(filter);
    filter.connect(gNoise);
    gNoise.connect(this.masterGain);

    src.start(t0);
    src.stop(t0 + 2.2);
  }
}

// 水中の音波（波紋リング）エフェクト
const MAX_RINGS = 8;

export class SoundRings {
  constructor(scene) {
    this.scene = scene;
    this.rings = [];
    const geom = new THREE.RingGeometry(0.8, 1.0, 32);
    geom.rotateX(-Math.PI / 2);

    for (let i = 0; i < MAX_RINGS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x9be8ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.rings.push({ mesh, mat, life: 0, maxLife: 1, scale0: 1, maxScale: 15 });
    }

    // 吹鳴ソナーが群れに当たった瞬間の反響パルス音（ピロロ〜ン・キラーンという澄んだ水中エコー音）
    this.sfx = new SoundEffects();
  }

  emit(pos, scale = 1) {
    const item = this.rings.find((r) => !r.mesh.visible) || this.rings[0];
    item.mesh.position.copy(pos);
    item.mesh.visible = true;
    item.life = 0;
    item.maxLife = 2.4 * Math.sqrt(scale);
    item.scale0 = 1.5 * scale;
    item.maxScale = (38 + 14 * scale) * scale;
    item.pinged = new Set();
  }

  update(dt, fish = null, spout = null, Z = { S: 1 }) {
    for (const r of this.rings) {
      if (!r.mesh.visible) continue;
      r.life += dt;
      if (r.life >= r.maxLife) {
        r.mesh.visible = false;
        continue;
      }
      const progress = r.life / r.maxLife;
      const sc = r.scale0 + (r.maxScale - r.scale0) * Math.pow(progress, 0.72);
      r.mesh.scale.set(sc, sc, sc);
      r.mat.opacity = 0.38 * (1 - progress) * (1 - progress);

      // 吹鳴ソナー反響：広がる音波リングがえさの群れに当たったらキラッと光らせて場所を知らせる
      if (fish && fish.schools && r.pinged) {
        const rx = r.mesh.position.x, rz = r.mesh.position.z;
        for (let s = 0; s < fish.schools.length; s++) {
          if (r.pinged.has(s)) continue;
          const school = fish.schools[s];
          if (!school || school.alive < school.size * 0.2) continue;
          const dist = Math.hypot(school.center.x - rx, school.center.z - rz);
          if (sc >= dist - 3.5 * (Z.S || 1)) {
            r.pinged.add(s);
            if (fish.triggerPing) fish.triggerPing(s);
            if (this.sfx && this.sfx.playEatChime) {
              this.sfx.playEatChime(2); // 澄んだ高音チャイムで発見を音でもフィードバック
            }
          }
        }
      }
    }
  }
}
