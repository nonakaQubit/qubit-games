// 画面の上に重ねるダイアログ類：タイトル、図鑑（3Dライブプレビュー付き）、メニュー、クリア、エンディング、生き物の説明カード
import * as THREE from 'three';
import { LANGS, t, getLang } from './i18n.js?v=20261109_v45';
import { AREAS, DEX } from './areas.js?v=20261107_v31';
import { Whale } from './whale.js?v=20261109_v44';
import { SPECIES } from './species.js?v=20261107_v31';
import { encodeSpell, decodeSpell } from './spell.js?v=20261109_v45';
import {
  createHumpback,
  createDolphin,
  createShark,
  createSeaTurtle,
  createSunfish,
} from './creatures_models.js?v=20261109_v44';
import {
  createDexFish,
  createDexKrill,
  createDexShearwater,
} from './dex_models.js?v=20261107_v31';

const CSS = `
.ui-panel { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
  background: rgba(8, 28, 32, 0.78); backdrop-filter: blur(5px); border: 1px solid #ffffff22;
  border-radius: 14px; padding: 22px 26px; min-width: 340px; max-width: 580px; color: #e8f0ee;
  box-shadow: 0 10px 40px #0007; display: none; max-height: 92vh; overflow-y: auto; }
.ui-panel.show { display: block; }
.ui-panel.corner { left: auto; top: auto; right: 18px; bottom: 36px; transform: none; min-width: 0;
  padding: 14px 16px; } /* クリア後、しばらくしたら隅へ寄せて、そのまま泳ぎ続けられるように */
.ui-panel.corner h1 { font-size: 15px; letter-spacing: .06em; }
.ui-panel.corner .ui-row { margin-top: 10px !important; }
.ui-panel.corner .ui-btn.main { font-size: 14px; padding: 8px 14px; }
.ui-banner { width: 100%; height: 110px; object-fit: cover; border-radius: 10px; margin-bottom: 14px; border: 1px solid rgba(255,255,255,0.18); box-shadow: 0 4px 16px rgba(0,0,0,0.4); }
.ui-dex-stage { position: relative; width: 100%; height: 168px; border-radius: 10px; margin-bottom: 12px;
  border: 1px solid rgba(168, 224, 208, 0.25); box-shadow: inset 0 0 28px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.4);
  background: radial-gradient(ellipse at 50% 25%, #164858 0%, #092630 58%, #041318 100%);
  overflow: hidden; cursor: grab; user-select: none; }
.ui-dex-stage:active { cursor: grabbing; }
.ui-dex-stage canvas { width: 100% !important; height: 100% !important; display: block; }
.ui-dex-hint { position: absolute; right: 10px; bottom: 6px; font-size: 11px; color: #a8e0d0aa;
  pointer-events: none; letter-spacing: 0.04em; text-shadow: 0 1px 3px #000a; }
.ui-dex-label { position: absolute; left: 12px; top: 8px; font-size: 14px; font-weight: 500;
  color: #e8f0ee; pointer-events: none; letter-spacing: 0.06em; text-shadow: 0 1px 4px #000c; }
.ui-panel.left { left: 6vw; transform: translate(0, -50%); } /* タイトルは左に寄せて、泳ぐクジラが見えるように */
.ui-panel h1 { margin: 0; font-size: 24px; letter-spacing: .14em; font-weight: 500; }
.ui-panel .sub { opacity: .6; font-size: 13px; letter-spacing: .2em; margin: 4px 0 18px; }
.ui-panel h2 { font-size: 13px; opacity: .7; font-weight: 500; letter-spacing: .1em; margin: 14px 0 6px; }
.ui-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.ui-btn { background: #ffffff14; color: #e8f0ee; border: 1px solid #ffffff2a; border-radius: 8px;
  padding: 6px 12px; font: inherit; font-size: 13px; cursor: pointer; }
.ui-btn:hover:not(:disabled) { background: #ffffff26; }
.ui-btn:disabled { opacity: .35; cursor: default; }
.ui-btn.sel { border-color: #a8e0d0; background: #a8e0d028; }
.ui-btn.main { background: #a8e0d033; border-color: #a8e0d0aa; font-size: 16px; padding: 10px 26px; }
.ui-stage small { display: block; font-size: 11px; opacity: .6; }
.ui-select { background: #0b2428; color: #e8f0ee; border: 1px solid #ffffff2a; border-radius: 8px; padding: 6px 8px; font: inherit; }
.ui-dex { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin: 8px 0; }
.ui-dex .ui-btn { text-align: left; padding: 6px 9px; font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ui-desc { min-height: 58px; font-size: 13px; line-height: 1.65; opacity: .92; margin: 8px 0 12px;
  background: rgba(0, 12, 16, 0.32); border-radius: 8px; padding: 9px 12px; border: 1px solid #ffffff14; }
#ui-card { position: fixed; right: 18px; top: 18px; width: 300px; background: rgba(8, 28, 32, 0.72);
  border: 1px solid #ffffff22; border-radius: 12px; padding: 14px 16px; color: #e8f0ee; font-size: 13px;
  line-height: 1.7; opacity: 0; transition: opacity .6s; pointer-events: none; }
#ui-card.show { opacity: 1; }
#ui-card b { font-size: 15px; font-weight: 500; display: block; margin-bottom: 4px; }
#ui-ending { position: fixed; inset: 0; display: none; flex-direction: column; align-items: center;
  justify-content: center; gap: 18px; background: linear-gradient(#0000, #0008 40%, #000a); color: #e8f0ee; }
#ui-ending.show { display: flex; }
#ui-ending p { margin: 0; font-size: 20px; letter-spacing: .12em; opacity: 0; transition: opacity 2.5s; }
#ui-ending p.on { opacity: 1; }
.ui-details { margin: 12px 0 6px; font-size: 13px; }
.ui-details summary { cursor: pointer; color: #a8e0d0; opacity: 0.85; user-select: none; font-weight: 500; font-size: 13px; }
.ui-details summary:hover { opacity: 1; }
.ui-spell-box { background: rgba(0, 15, 20, 0.45); border: 1px solid rgba(168, 224, 208, 0.28);
  border-radius: 8px; padding: 10px 14px; margin: 8px 0 6px; font-size: 13px; line-height: 1.6; }
.ui-spell-phrase { font-size: 15px; color: #a8e0d0; font-weight: 500; letter-spacing: .06em; margin: 4px 0 6px; }
.ui-spell-input { width: 100%; box-sizing: border-box; background: rgba(0, 20, 26, 0.7);
  border: 1px solid rgba(168, 224, 208, 0.35); border-radius: 6px; padding: 8px 10px; color: #e8f0ee;
  font: inherit; font-size: 13px; margin: 6px 0 8px; }
.ui-spell-input:focus { outline: none; border-color: #a8e0d0; }
.ui-msg-tip { font-size: 12px; color: #8fc7ba; margin-top: 4px; display: none; }
@media (max-width: 680px) {
  .ui-panel { min-width: 0; width: calc(100vw - 28px); max-width: 480px; padding: 16px 18px; }
  .ui-panel.left { left: 50%; transform: translate(-50%, -50%); }
  .ui-dex { grid-template-columns: repeat(2, 1fr); }
  .ui-dex-stage { height: 140px; }
  #ui-card { width: calc(100vw - 36px); max-width: 280px; top: 48px; }
}
`;

function el(tag, cls, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (parent) parent.appendChild(e);
  return e;
}

const FISH_IDS = new Set(['sandlance', 'capelin', 'herring', 'anchovy', 'sardine', 'mackerel', 'lanternfish']);

export class UI {
  // h: { onStart(areaId), onLang(id), onResume(), onToTitle(), onNext() }
  constructor(h) {
    this.h = h;
    el('style', null, document.head).textContent = CSS;
    this.title = el('div', 'ui-panel left', document.body);
    this.dex = el('div', 'ui-panel', document.body);
    this.lore = el('div', 'ui-panel', document.body);
    this.menu = el('div', 'ui-panel', document.body);
    this.clear = el('div', 'ui-panel', document.body);
    this.card = el('div', null, document.body);
    this.card.id = 'ui-card';
    this.ending = el('div', null, document.body);
    this.ending.id = 'ui-ending';
    this.panels = [this.title, this.dex, this.lore, this.menu, this.clear];

    this._dexRAF = 0;
    this._dexCache = new Map();
  }

  hideAll() {
    clearTimeout(this.cornerT);
    this._stopDexViewer();
    if (this._watchHintEl) this._watchHintEl.style.display = 'none';
    this.panels.forEach((p) => p.classList.remove('show', 'corner'));
    this.ending.classList.remove('show');
  }

  get open() { return this.panels.some((p) => p.classList.contains('show')) || this.ending.classList.contains('show'); }

  // 図鑑用3Dビューアの初期化（1度だけ作成して使い回す）
  _ensureDexViewer() {
    if (this._dexRenderer) return;
    const W = 520, H = 168;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 100);

    // 水中らしい立体感を引き出す照明（上方からの太陽光＋海底からの照り返し＋リムライト）
    const hemi = new THREE.HemisphereLight(0xaee6f8, 0x0c2c38, 1.45);
    scene.add(hemi);
    const dir1 = new THREE.DirectionalLight(0xe8fbff, 1.55);
    dir1.position.set(4, 8, 6);
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0x48a8c8, 0.65);
    dir2.position.set(-6, -3, -4);
    scene.add(dir2);

    const root = new THREE.Group();
    scene.add(root);

    this._dexRenderer = renderer;
    this._dexScene = scene;
    this._dexCamera = camera;
    this._dexRoot = root;
    this._dexYaw = -0.68;
    this._dexPitch = 0.14;
    this._dexDist = 6.2;
    this._dexAutoRotate = true;
  }

  // 種別IDに対応する3Dモデルとアニメーション関数を生成（キャッシュして再利用）
  _getDexEntry(id) {
    if (this._dexCache.has(id)) return this._dexCache.get(id);

    let entry = null;
    if (SPECIES[id]) {
      // 主役・仲間ヒゲクジラ5種（8m基準サイズに正規化して全身を美しく見せる）
      const w = new Whale({ species: SPECIES[id] });
      w.group.scale.setScalar(1.0);
      entry = {
        group: w.group,
        dist: 7.4,
        yOffset: -0.08,
        animate: (dt) => w.animate(dt, 2.2 * w.P, 0, 0),
      };
    } else if (id === 'humpback') {
      const m = createHumpback();
      m.group.scale.setScalar(8.0 / 13.5);
      entry = {
        group: m.group,
        dist: 7.5,
        yOffset: 0.0,
        animate: (dt) => m.animate(dt, 1.8, 0),
      };
    } else if (id === 'dolphin') {
      const m = createDolphin();
      m.group.scale.setScalar(2.2);
      entry = {
        group: m.group,
        dist: 5.8,
        yOffset: -0.05,
        animate: (dt) => m.animate(dt, 3.2, 0, 0),
      };
    } else if (id === 'shark') {
      const m = createShark();
      m.group.scale.setScalar(1.65);
      entry = {
        group: m.group,
        dist: 6.0,
        yOffset: 0.0,
        animate: (dt) => m.animate(dt, 2.4, 0),
      };
    } else if (id === 'turtle') {
      const m = createSeaTurtle();
      m.group.scale.setScalar(2.6);
      entry = {
        group: m.group,
        dist: 5.0,
        yOffset: 0.0,
        animate: (dt) => m.animate(dt, 1.6, 0),
      };
    } else if (id === 'sunfish') {
      const m = createSunfish();
      m.group.scale.setScalar(1.35);
      entry = {
        group: m.group,
        dist: 5.8,
        yOffset: 0.0,
        animate: (dt) => m.animate(dt, 1.1),
      };
    } else if (id === 'shearwater') {
      const m = createDexShearwater();
      entry = {
        group: m.group,
        dist: 5.4,
        yOffset: 0.0,
        animate: (dt) => m.animate(dt),
      };
    } else if (id === 'krill') {
      const m = createDexKrill();
      entry = {
        group: m.group,
        dist: 5.4,
        yOffset: 0.0,
        animate: (dt) => m.animate(dt),
      };
    } else if (FISH_IDS.has(id)) {
      const m = createDexFish(id);
      entry = {
        group: m.group,
        dist: 5.5,
        yOffset: 0.0,
        animate: (dt) => m.animate(dt),
      };
    }

    if (entry) this._dexCache.set(id, entry);
    return entry;
  }

  // 未発見時の黒シルエット切り替え用のマテリアル保存・復元
  _setSilhouette(group, isSilhouette) {
    group.traverse((obj) => {
      if (!obj.isMesh && !obj.isPoints) return;
      if (!obj.userData._origMat) {
        obj.userData._origMat = obj.material;
      }
      if (isSilhouette) {
        if (!obj.userData._silMat) {
          if (obj.isPoints) {
            obj.userData._silMat = obj.userData._origMat.clone();
            if (obj.userData._silMat.uniforms) {
              obj.userData._silMat.uniforms = {
                uColA: { value: new THREE.Color(0x041218) },
                uColB: { value: new THREE.Color(0x08222c) },
              };
            }
          } else {
            obj.userData._silMat = new THREE.MeshBasicMaterial({ color: 0x05161e });
          }
        }
        obj.material = obj.userData._silMat;
      } else {
        obj.material = obj.userData._origMat;
      }
    });
  }

  _stopDexViewer() {
    if (this._dexRAF) {
      cancelAnimationFrame(this._dexRAF);
      this._dexRAF = 0;
    }
  }

  // 閲覧モード：タイトルダイアログを消して背景の海と泳ぐクジラをフル画面で眺める
  showWatch(onReturn) {
    this.hideAll();
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (!this._watchHintEl) {
      const hint = document.createElement('div');
      hint.id = 'ui-watch-hint';
      hint.style.cssText = 'position:fixed;bottom:22px;right:24px;background:rgba(8,28,32,0.65);backdrop-filter:blur(5px);' +
        'border:1px solid rgba(255,255,255,0.22);border-radius:20px;padding:8px 18px;color:#e8f0ee;font-size:13px;' +
        'letter-spacing:0.04em;pointer-events:auto;cursor:pointer;user-select:none;z-index:40;transition:opacity .4s;box-shadow:0 4px 16px rgba(0,0,0,0.4);';
      document.body.appendChild(hint);
      this._watchHintEl = hint;
    }
    this._watchHintEl.textContent = isTouch ? `◀ ${t('watchHintTouch')}` : `◀ ${t('watchHint')}`;
    this._watchHintEl.style.display = 'block';
    this._watchHintEl.style.opacity = '1';

    let exited = false;
    const exitWatch = (e) => {
      if (exited) return;
      exited = true;
      if (e) e.stopPropagation();
      window.removeEventListener('click', exitWatch, true);
      window.removeEventListener('touchend', exitWatch, true);
      if (this._watchHintEl) this._watchHintEl.style.display = 'none';
      onReturn();
    };

    this._watchHintEl.onclick = exitWatch;
    // 即時発火しないよう少し待ってから画面全体のクリック/タップでも戻れるようにする
    setTimeout(() => {
      if (!exited) {
        window.addEventListener('click', exitWatch, { once: true, capture: true });
        window.addEventListener('touchend', exitWatch, { once: true, capture: true });
      }
    }, 220);
  }

  // タイトル：海域の選択、はじめる、図鑑、権利とウンチク、言語
  showTitle(data, selected) {
    this.hideAll();
    const p = this.title;
    p.innerHTML = '';
    el('h1', null, p).textContent = t('title');
    el('div', 'sub', p).textContent = t('subtitle');

    el('h2', null, p).textContent = t('stage');
    const row = el('div', 'ui-row', p);
    AREAS.forEach((a, i) => {
      const unlocked = i === 0 || data.cleared.includes(AREAS[i - 1].id);
      const b = el('button', 'ui-btn ui-stage' + (a.id === selected ? ' sel' : ''), row);
      b.innerHTML = `${t('area.' + a.id)}<small>${data.cleared.includes(a.id) ? t('cleared') : unlocked ? '' : t('locked')}</small>`;
      b.disabled = !unlocked;
      b.onclick = () => {
        if (a.id === selected) return;
        if (this.h.onSelectArea) this.h.onSelectArea(a.id);
        else this.showTitle(data, a.id);
      };
    });

    const go = el('div', 'ui-row', p);
    go.style.margin = '20px 0 4px';
    const start = el('button', 'ui-btn main', go);
    start.textContent = t('start');
    start.onclick = () => this.h.onStart(selected);
    const watch = el('button', 'ui-btn', go);
    watch.textContent = t('watch');
    watch.onclick = () => this.h.onWatch ? this.h.onWatch(selected) : null;
    const dex = el('button', 'ui-btn', go);
    dex.textContent = t('dex');
    dex.onclick = () => this.showDex(data, () => this.showTitle(data, selected));
    const lore = el('button', 'ui-btn', go);
    lore.textContent = t('lore');
    lore.onclick = () => this.showLore(data, () => this.showTitle(data, selected));

    // 言語選択：ラベルの横に並べて省スペース化
    const langRow = el('div', 'ui-row', p);
    langRow.style.marginTop = '14px';
    const langLabel = el('span', null, langRow);
    langLabel.style.fontSize = '13px';
    langLabel.style.opacity = '0.75';
    langLabel.style.marginRight = '4px';
    langLabel.textContent = t('language') + ':';
    const sel = el('select', 'ui-select', langRow);
    LANGS.forEach((l) => {
      const o = el('option', null, sel);
      o.value = l.id;
      o.textContent = l.enabled ? l.label : `${l.label}（${t('soon')}）`;
      o.disabled = !l.enabled;
    });
    sel.value = data.lang;
    sel.onchange = () => { this.h.onLang(sel.value); this.showTitle(data, selected); };

    // 復活の呪文（旅の言葉）と𝕏シェアセクション：初期状態は折りたたみ（閉じた状態）
    const details = el('details', 'ui-details', p);
    const summary = el('summary', null, details);
    summary.textContent = `▶ ${t('shareTitle')}`;
    details.ontoggle = () => {
      summary.textContent = `${details.open ? '▼' : '▶'} ${t('shareTitle')}`;
    };

    const spellBox = el('div', 'ui-spell-box', details);
    const spellObj = encodeSpell({ ...data, area: selected }, data.lang);
    el('div', null, spellBox).textContent = t('spellLabel') + ':';
    const phraseEl = el('div', 'ui-spell-phrase', spellBox);
    phraseEl.textContent = spellObj.phrase;

    const rowShare = el('div', 'ui-row', spellBox);
    rowShare.style.marginTop = '8px';

    const btnCopy = el('button', 'ui-btn', rowShare);
    btnCopy.textContent = t('copySpellBtn');
    btnCopy.onclick = () => {
      navigator.clipboard?.writeText(spellObj.phrase).then(() => {
        msgTip.textContent = t('copiedMsg');
        msgTip.style.display = 'block';
        setTimeout(() => { msgTip.style.display = 'none'; }, 3000);
      });
    };

    const btnTweet = el('button', 'ui-btn', rowShare);
    btnTweet.textContent = t('shareBtn');
    btnTweet.onclick = () => {
      const areaName = t('area.' + selected);
      const curAreaObj = AREAS.find((a) => a.id === selected) || AREAS[0];
      const whaleName = t('sp.' + curAreaObj.whale);
      const text = t('tweetTemplate', { whale: whaleName, area: areaName, words: spellObj.phrase });
      const pageUrl = window.location.origin + window.location.pathname;
      const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(pageUrl)}`;
      window.open(tweetUrl, '_blank', 'noopener,noreferrer');
    };

    const inputSpell = el('input', 'ui-spell-input', spellBox);
    inputSpell.placeholder = t('inputSpellPlaceholder');

    const btnApply = el('button', 'ui-btn', spellBox);
    btnApply.textContent = t('applySpellBtn');
    const msgTip = el('div', 'ui-msg-tip', spellBox);

    btnApply.onclick = () => {
      const val = inputSpell.value.trim();
      if (!val) return;
      const restored = decodeSpell(val);
      if (restored) {
        msgTip.textContent = t('spellSuccessMsg');
        msgTip.style.color = '#a8e0d0';
        msgTip.style.display = 'block';
        this.h.onRestore?.(restored);
        setTimeout(() => {
          this.showTitle(restored, restored.area);
        }, 1000);
      } else {
        msgTip.textContent = t('spellErrorMsg');
        msgTip.style.color = '#ff9282';
        msgTip.style.display = 'block';
      }
    };

    p.classList.add('show');
  }

  // 図鑑：選択した生き物の3Dモデル（大型種は単体、小魚・オキアミ・海鳥はロングの群れ）をライブ表示
  showDex(data, back) {
    this.hideAll();
    this._ensureDexViewer();

    const p = this.dex;
    p.innerHTML = '';
    el('h1', null, p).textContent = t('dex');

    // 3Dプレビュー枠
    const stage = el('div', 'ui-dex-stage', p);
    stage.style.marginTop = '10px';
    stage.appendChild(this._dexRenderer.domElement);
    const stageLabel = el('div', 'ui-dex-label', stage);
    const stageHint = el('div', 'ui-dex-hint', stage);
    stageHint.textContent = data.lang === 'en' ? 'Drag to rotate / Scroll to zoom' : 'ドラッグで回転・ホイールで拡大';

    // マウスドラッグ回転＆ホイールズーム操作
    let dragging = false, lastX = 0, lastY = 0;
    stage.onpointerdown = (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      this._dexAutoRotate = false;
      stage.setPointerCapture(e.pointerId);
    };
    stage.onpointermove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      this._dexYaw += dx * 0.011;
      this._dexPitch = Math.max(-0.75, Math.min(0.75, this._dexPitch + dy * 0.009));
    };
    stage.onpointerup = stage.onpointercancel = () => { dragging = false; };
    stage.onwheel = (e) => {
      e.preventDefault();
      this._dexDist = Math.max(2.6, Math.min(12.0, this._dexDist + e.deltaY * 0.004));
    };

    const grid = el('div', 'ui-dex', p);
    const desc = el('div', 'ui-desc', p);

    let activeEntry = null;
    const selectItem = (id, btn) => {
      grid.querySelectorAll('.ui-btn').forEach((x) => x.classList.remove('sel'));
      if (btn) btn.classList.add('sel');
      const seen = data.seen.includes(id);
      desc.textContent = seen ? t('sp.' + id + '.desc') : t('unknownDesc');
      stageLabel.textContent = seen ? t('sp.' + id) : t('unknown');

      // 3Dモデルの切り替え
      while (this._dexRoot.children.length) {
        this._dexRoot.remove(this._dexRoot.children[0]);
      }
      activeEntry = this._getDexEntry(id);
      if (activeEntry) {
        this._setSilhouette(activeEntry.group, !seen);
        activeEntry.group.position.set(0, activeEntry.yOffset || 0, 0);
        this._dexRoot.add(activeEntry.group);
        this._dexDist = activeEntry.dist || 6.0;
        this._dexYaw = -0.72; // 頭が左前方を向く見やすい斜め側面アングル
        this._dexPitch = 0.14;
        this._dexAutoRotate = true;
      }
    };

    let firstSeenBtn = null, firstSeenId = DEX[0];
    let firstBtn = null;
    DEX.forEach((id, idx) => {
      const seen = data.seen.includes(id);
      const b = el('button', 'ui-btn', grid);
      b.textContent = seen ? t('sp.' + id) : t('unknown');
      b.onclick = () => selectItem(id, b);
      if (idx === 0) firstBtn = b;
      if (seen && !firstSeenBtn) {
        firstSeenBtn = b;
        firstSeenId = id;
      }
    });

    // 初期表示：最初に見つけた生き物（なければ先頭）を自動選択
    selectItem(firstSeenBtn ? firstSeenId : DEX[0], firstSeenBtn || firstBtn);

    // プレビューアニメーションループ（図鑑を開いている間だけ動かす）
    let lastT = performance.now();
    const tick = (now) => {
      if (!this.dex.classList.contains('show')) return;
      this._dexRAF = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      if (activeEntry && activeEntry.animate) {
        activeEntry.animate(dt);
      }
      if (this._dexAutoRotate) {
        this._dexYaw += dt * 0.22;
      }
      this._dexRoot.rotation.set(this._dexPitch, this._dexYaw, 0, 'YXZ');
      this._dexCamera.position.set(0, 0.15, this._dexDist);
      this._dexCamera.lookAt(0, 0, 0);
      this._dexRenderer.render(this._dexScene, this._dexCamera);
    };
    this._dexRAF = requestAnimationFrame(tick);

    const close = el('button', 'ui-btn', p);
    close.textContent = t('close');
    close.onclick = () => {
      this._stopDexViewer();
      back();
    };
    p.classList.add('show');
  }

  // 権利とウンチク（About & License ダイアログ）
  showLore(data, back) {
    this.hideAll();
    const p = this.lore;
    p.innerHTML = '';
    el('h1', null, p).textContent = t('loreTitle');

    const descBox = el('div', 'ui-desc', p);
    descBox.style.minHeight = 'auto';
    descBox.style.marginTop = '14px';
    descBox.style.padding = '12px 14px';

    const hLic = el('div', null, descBox);
    hLic.style.fontWeight = 'bold';
    hLic.style.color = '#a8e0d0';
    hLic.style.marginBottom = '4px';
    hLic.textContent = t('loreLicenseHead');

    const pLic = el('div', null, descBox);
    pLic.style.marginBottom = '14px';
    pLic.style.opacity = '0.9';
    pLic.textContent = t('loreLicenseText');

    const hTriv = el('div', null, descBox);
    hTriv.style.fontWeight = 'bold';
    hTriv.style.color = '#a8e0d0';
    hTriv.style.marginBottom = '4px';
    hTriv.textContent = t('loreTriviaHead');

    const pTriv = el('div', null, descBox);
    pTriv.style.opacity = '0.9';
    pTriv.textContent = t('loreTriviaText');

    const row = el('div', 'ui-row', p);
    row.style.marginTop = '16px';
    const close = el('button', 'ui-btn main', row);
    close.textContent = t('close');
    close.onclick = () => back();
    p.classList.add('show');
  }

  // プレイ中の Esc メニュー
  showMenu() {
    this.hideAll();
    const p = this.menu;
    p.innerHTML = '';
    el('h1', null, p).textContent = t('paused');
    const row = el('div', 'ui-row', p);
    row.style.marginTop = '18px';
    const r = el('button', 'ui-btn main', row);
    r.textContent = t('resume');
    r.onclick = () => this.h.onResume();
    const tt = el('button', 'ui-btn', row);
    tt.textContent = t('toTitle');
    tt.onclick = () => this.h.onToTitle();
    p.classList.add('show');
  }

  // 海域クリア：最初から右下の隅にコンパクトに出し、視界を遮らずそのまま泳ぎ続けられるようにする
  showClear(areaId, hasNext, data = null) {
    this.hideAll();
    const p = this.clear;
    p.innerHTML = '';
    el('h1', null, p).textContent = t('full', { area: t('area.' + areaId) });
    const row = el('div', 'ui-row', p);
    row.style.marginTop = '18px';
    if (hasNext) {
      const n = el('button', 'ui-btn main', row);
      n.textContent = t('nextArea');
      n.onclick = () => this.h.onNext();
    }
    const tt = el('button', 'ui-btn', row);
    tt.textContent = t('toTitle');
    tt.onclick = () => this.h.onToTitle();

    // 𝕏 で記録・共有ボタン（クリア時）
    const tweetBtn = el('button', 'ui-btn', row);
    tweetBtn.textContent = t('shareBtn');
    tweetBtn.onclick = () => {
      const curData = data || { cleared: [areaId], seen: [areaId], area: areaId, lang: getLang() };
      const spellObj = encodeSpell(curData, getLang());
      const curAreaObj = AREAS.find((a) => a.id === areaId) || AREAS[0];
      const whaleName = t('sp.' + curAreaObj.whale);
      const text = `${t('full', { area: t('area.' + areaId) })}\n` + t('tweetTemplate', { whale: whaleName, area: t('area.' + areaId), words: spellObj.phrase });
      const pageUrl = window.location.origin + window.location.pathname;
      const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(pageUrl)}`;
      window.open(tweetUrl, '_blank', 'noopener,noreferrer');
    };

    p.classList.add('show', 'corner');
  }

  // エンディング：文が一行ずつ浮かんで、最後にタイトルへ
  showEnding(data = null) {
    this.hideAll();
    const e = this.ending;
    e.innerHTML = '';
    const lines = t('endingLines').map((s) => { const p = el('p', null, e); p.textContent = s; return p; });
    const row = el('div', 'ui-row', e);
    row.style.opacity = 0;
    row.style.transition = 'opacity 2s';

    const b = el('button', 'ui-btn main', row);
    b.textContent = t('toTitle');
    b.onclick = () => this.h.onToTitle();

    // 𝕏 で記録・共有ボタン（エンディング時）
    const tweetBtn = el('button', 'ui-btn', row);
    tweetBtn.textContent = t('shareBtn');
    tweetBtn.onclick = () => {
      const curData = data || { cleared: AREAS.map((a) => a.id), seen: DEX, area: 'antarctic', lang: getLang() };
      const spellObj = encodeSpell(curData, getLang());
      const text = `Rorqual — 全海域クリア！\n` + t('tweetTemplate', { whale: t('sp.blue'), area: t('area.antarctic'), words: spellObj.phrase });
      const pageUrl = window.location.origin + window.location.pathname;
      const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(pageUrl)}`;
      window.open(tweetUrl, '_blank', 'noopener,noreferrer');
    };

    e.classList.add('show');
    lines.forEach((p, i) => setTimeout(() => p.classList.add('on'), 1500 + i * 3000));
    setTimeout(() => { row.style.opacity = 1; }, 1500 + lines.length * 3000);
  }

  // 生き物の説明カード（しばらくすると消える）
  showCard(id) {
    this.card.innerHTML = `<b>${t('sp.' + id)}</b>${t('sp.' + id + '.desc')}`;
    this.card.classList.add('show');
    clearTimeout(this.cardT);
    this.cardT = setTimeout(() => this.card.classList.remove('show'), 9000);
  }
}
