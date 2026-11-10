// ゲームの流れ：タイトル → 海域でプレイ → クリア → 次の海域 … → エンディング → タイトル
// ほかに、Esc メニュー、言語の切り替え、図鑑（生き物をクリックで説明）、進み具合の保存
import * as THREE from 'three';
import { UI } from './ui.js?v=20261109_v45';
import { t, setLang } from './i18n.js?v=20261109_v45';
import { areaById, nextArea } from './areas.js?v=20261107_v31';
import { load, save, encodeSpell, decodeSpell } from './save.js?v=20261109_v45';
import { SPECIES } from './species.js?v=20261107_v31';

// ctx: { scene, sea, fish, whale, st, belly, camera, resetPlayer, setSpecies, Z }
export function setupFlow(ctx) {
  const { scene, sea, fish, whale, st, belly, camera, resetPlayer, setSpecies, Z, pod, dolphins, creatures, birds } = ctx;
  const data = load();
  setLang(data.lang);

  const game = { mode: 'title', area: areaById(data.area), data };
  const hud = document.getElementById('hud'), help = document.getElementById('help');
  const touchControls = document.getElementById('touchControls');
  const touchMenuBtn = document.getElementById('touchMenuBtn');
  const btnCall = document.getElementById('btnCall');
  const btnSpout = document.getElementById('btnSpout');
  const btnBreach = document.getElementById('btnBreach');
  let isTouchMode = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  function refreshTexts() {
    document.getElementById('area').textContent = t('area.' + game.area.id);
    document.getElementById('species').textContent = t('sp.' + game.area.whale);
    help.textContent = isTouchMode ? t('helpTouch') : t('help');
    if (btnCall) btnCall.textContent = t('btnCall');
    if (btnSpout) btnSpout.textContent = t('btnSpout');
    if (btnBreach) btnBreach.textContent = t('btnBreach');
    if (touchMenuBtn) touchMenuBtn.textContent = t('btnMenu');
  }

  function setHud(on) {
    hud.style.display = help.style.display = on ? '' : 'none';
    if (touchControls) touchControls.classList.toggle('show', !!(on && isTouchMode));
    if (touchMenuBtn) touchMenuBtn.classList.toggle('show', !!(on && isTouchMode));
  }

  game.enableTouchUI = () => {
    if (!isTouchMode) {
      isTouchMode = true;
      refreshTexts();
      if (game.mode === 'play') setHud(true);
    }
  };

  if (touchMenuBtn) {
    touchMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (game.mode === 'play') { game.mode = 'menu'; ui.showMenu(); }
      else if (game.mode === 'menu') { game.mode = 'play'; ui.hideAll(); }
    });
  }

  function see(id) {
    if (!data.seen.includes(id)) { data.seen.push(id); save(data); }
  }

  // 海域を入れ替える：クジラとカメラを初期位置へ戻し、海の色・濁り・波・光の筋・魚の群れ・ゲストNPCを新しくする
  function applyArea(area) {
    game.area = area;
    setSpecies(SPECIES[area.whale]);
    resetPlayer();
    scene.background.setHex(area.fog);
    scene.fog.color.setHex(area.fog);
    scene.fog.density = area.murk / (Z.V * (Z.camPull || 1)); // カメラを引いた分、遠くまで見えるように
    sea.setArea(area, whale.group.position);
    fish.reset(whale.group.position, area);
    if (pod) pod.setArea(area, whale.group.position, Z, st.yaw);
    if (creatures) creatures.setArea(area, whale.group.position, Z, st.yaw);
    if (dolphins && dolphins.setArea) dolphins.setArea(area);
    refreshTexts();
  }

  // 暗転：暗くなりきったところで fn を呼び、また明るくする
  const fade = document.createElement('div');
  fade.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;transition:opacity .7s;pointer-events:none;z-index:50';
  document.body.appendChild(fade);
  function blackout(fn) {
    fade.style.pointerEvents = 'auto';
    fade.style.opacity = 1;
    setTimeout(() => { fn(); fade.style.opacity = 0; fade.style.pointerEvents = 'none'; }, 750);
  }

  function startArea(id) {
    ui.hideAll();
    blackout(() => {
      data.area = id;
      save(data);
      applyArea(areaById(id));
      belly.value = 30; belly.full = false;
      see(game.area.whale); // 自分のクジラは、はじめから見たことにする
      game.mode = 'play';
      game.cleared = false;
      setHud(true);
    });
  }

  function toTitle() {
    game.mode = 'title';
    setHud(false);
    ui.showTitle(data, game.area.id);
  }

  const ui = new UI({
    onStart: (id) => startArea(id),
    onSelectArea: (id) => {
      if (game.area.id === id) return;
      blackout(() => {
        data.area = id;
        save(data);
        applyArea(areaById(id));
        ui.showTitle(data, id);
      });
    },
    onWatch: () => {
      game.mode = 'watch';
      setHud(false);
      ui.showWatch(() => {
        game.mode = 'title';
        toTitle();
      });
    },
    onLang: (id) => { setLang(id); data.lang = id; save(data); refreshTexts(); },
    onResume: () => {
      game.mode = 'play';
      ui.hideAll();
      if (game.cleared) ui.showClear(game.area.id, !!nextArea(game.area.id), data); // クリア後なら隅のダイアログを戻す
    },
    onToTitle: toTitle,
    onNext: () => { const n = nextArea(game.area.id); if (n) startArea(n.id); },
    onRestore: (restored) => {
      Object.assign(data, restored);
      save(data);
      game.area = areaById(data.area);
      refreshTexts();
    },
  });

  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (game.mode === 'play') { game.mode = 'menu'; ui.showMenu(); }
    else if (game.mode === 'menu') { game.mode = 'play'; ui.hideAll(); }
    else if (game.mode === 'watch') { game.mode = 'title'; toTitle(); }
  });

  // マウスを生き物に重ねてしばらくすると、図鑑のカードを出す（クリックは突進のまま）
  const ray = new THREE.Raycaster(), hit = new THREE.Vector3();
  const fishPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -fish.layerY);
  const pick = (ndc) => {
    ray.setFromCamera(ndc, camera);
    if (ray.intersectObject(whale.body, false).length) return game.area.whale;
    if (pod) {
      const podWhale = pod.pick(ray);
      if (podWhale) return podWhale;
    }
    if (dolphins) {
      const dHitR = 3.0 * Math.pow(Math.max(1, Z.V), 0.65);
      for (const d of dolphins.dolphins) {
        if (!d.active) continue;
        if (ray.intersectObjects(d.group.children, true).length || ray.ray.distanceSqToPoint(d.pos) <= dHitR * dHitR) {
          return 'dolphin';
        }
      }
    }
    if (creatures) {
      const cId = creatures.pick(ray, Z);
      if (cId) return cId;
    }
    if (birds && birds.mesh) {
      if (ray.intersectObject(birds.mesh, false).length) return 'shearwater';
      const bHitR = 2.8 * Math.pow(Math.max(1, Z.V), 0.65);
      for (const b of birds.birds) {
        if (b.active && ray.ray.distanceSqToPoint(b.pos) <= bHitR * bHitR) return 'shearwater';
      }
    }
    fishPlane.constant = -fish.layerY;
    if (ray.ray.intersectPlane(fishPlane, hit)) {
      const f = fish.near(hit, 1.4 * Z.V);
      if (f) return f;
    }
    return null;
  };
  let hoverId = null, hoverT = 0, shownId = null, checkT = 0;
  game.hover = (dt, ndc, inside) => {
    checkT -= dt;
    if (checkT > 0) { if (hoverId) hoverT += dt; return; }
    checkT = 0.15; // 毎コマ調べると重いので、ときどき
    const id = game.mode === 'play' && inside ? pick(ndc) : null;
    if (id !== hoverId) { hoverId = id; hoverT = 0; if (!id) shownId = null; return; }
    // まだ見たことのない生き物はすぐ、見たことのある生き物は少し長く重ねたときだけ出す（泳いでいる最中にうるさくないように）
    const wait = data.seen.includes(id) ? 1.2 : 0.4;
    if (id && hoverT > wait && shownId !== id) { ui.showCard(id); see(id); shownId = id; }
  };

  // タッチ時：タップした位置に生き物（自機以外）がいれば即座に図鑑カードを表示して登録する
  game.inspectAt = (ndc) => {
    if (game.mode !== 'play') return null;
    const id = pick(ndc);
    if (id && id !== game.area.whale) {
      ui.showCard(id);
      see(id);
      shownId = id;
      return id;
    }
    return null;
  };

  // 満腹：クリア済みにして、少し間をおいてから次へ（最後の海域ならエンディング）。
  // ダイアログは隅へ寄るので、そのまま泳ぎ続けてもよい
  game.onFull = () => {
    game.cleared = true;
    if (!data.cleared.includes(game.area.id)) { data.cleared.push(game.area.id); save(data); }
    const next = nextArea(game.area.id);
    setTimeout(() => {
      if (game.mode !== 'play' || !game.cleared) return; // その間にメニューやタイトルへ移っていたら出さない
      if (next) ui.showClear(game.area.id, true, data);
      else { game.mode = 'ending'; setHud(false); ui.showEnding(data); }
    }, 3500);
  };

  applyArea(game.area);
  toTitle();
  return game;
}
