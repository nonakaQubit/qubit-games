import * as THREE from 'three';
import { Whale } from './whale.js?v=20261109_v44';
import { FishSchools } from './fish.js?v=20261107_v37';
import { Sea } from './sea.js?v=20261109_v41';
import { Spout } from './spout.js?v=20261107_v36';
import { WhaleVoice, SoundRings, SoundIndicator, SoundEffects } from './voice.js?v=20261107_v36';
import { WhalePod } from './pod.js?v=20261107_v33';
import { Seabirds } from './birds.js';
import { Dolphins } from './dolphins.js?v=20261107_v39';
import { OceanCreatures } from './creatures.js?v=20261109_v44';
import { setupFlow } from './flow.js?v=20261109_v44';
import { t } from './i18n.js?v=20261109_v41';
import { SPECIES, scalesOf } from './species.js?v=20261107_v21';

// オホーツク海：灰緑の濁った冷たい海
// 深さの操作はなし。クジラも魚の群れも同じくらいの深さを泳ぐ
// floorY は海底ではなく、光の筋やマリンスノーを置く深さの下限
// 海に端はない。魚の群れも光の筋も、クジラのまわりに付いてくる
const SEA = { fog: 0x24504f, density: 0.018, floorY: -24, depth: -2.4 };

const renderer = new THREE.WebGLRenderer({ antialias: true });
// 描画の解像度。内蔵 GPU では画面全体を塗る量が効くので、fps を見ながら自動で上げ下げする（上限は 100%）
const MAX_RATIO = 1.0, MIN_RATIO = 0.4;
let ratio = MAX_RATIO;
renderer.setPixelRatio(ratio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(SEA.fog);
scene.fog = new THREE.FogExp2(SEA.fog, SEA.density);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 400);
const CAM_OFFSET = new THREE.Vector3(14, 16, 14); // クォータービュー

scene.add(new THREE.HemisphereLight(0xb8e0d8, 0x0b1f22, 1.4));
const sun = new THREE.DirectionalLight(0xfff4dc, 2.2);
sun.position.set(10, 60, 5);
scene.add(sun);

const sea = new Sea(scene, SEA);

const whale = new Whale({ species: SPECIES.minke });
whale.group.position.set(0, SEA.depth, 0);
// 大きさの倍率（species.js の scalesOf）。S: 体長の比、V: カメラの引き具合、T: 動きのゆっくりさ、P: 速さの倍率
// 距離・速さ・時間の値は、ミンク（S = 1）のときの値にこれらを掛けて使う
const Z = { S: 1, V: 1, T: 1, P: 1, camPull: 1 };
const BASE_DEPTH = -2.4; // ミンクが泳ぐ深さ（体の中心）
let game = null;

// 縦画面（スマホ縦持ち等 aspect < 1.35）では横方向の視野が狭くなりクジラが画面いっぱいに拡大されてしまうため、
// 視野角（fov）を少し広げつつカメラを引き（camPull）、横画面と同等の周囲の海・魚群の広さを確保する
function updateCameraLens() {
  const aspect = innerWidth / Math.max(1, innerHeight);
  camera.aspect = aspect;
  const fov = aspect < 1.35 ? Math.min(55, 42 + (1.35 - aspect) * 15) : 42;
  camera.fov = fov;
  const halfTanV = Math.tan(THREE.MathUtils.degToRad(fov * 0.5));
  const minHalfTanH = 0.58; // 横画面（約15:10）と同等の横方向の視野幅を確保
  Z.camPull = (halfTanV * aspect < minHalfTanH) ? (minHalfTanH / (halfTanV * aspect)) : 1.0;
  camera.far = 400 * Z.V * Z.camPull;
  camera.updateProjectionMatrix();
  const murk = game?.area?.murk ?? SEA.density;
  scene.fog.density = murk / (Z.V * Z.camPull);
}
updateCameraLens();
scene.add(whale.group);
const fish = new FishSchools(scene, SEA);
const spout = new Spout(scene);
const voice = new WhaleVoice();
const sfx = new SoundEffects();
const soundRings = new SoundRings(scene);
const soundIndicator = new SoundIndicator();
const pod = new WhalePod(scene, SEA, spout, soundRings, voice, fish, soundIndicator);
pod.setCamera(camera);
const birds = new Seabirds(scene, fish);
const dolphins = new Dolphins(scene, sea, spout);
dolphins.setCamera(camera);
const creatures = new OceanCreatures(scene, sea);
creatures.setCamera(camera);

// ---- お腹 ----
const belly = { value: 15, full: false };
const bellyWrapEl = document.getElementById('bellyWrap');
const bellyEl = document.getElementById('belly');
const msgEl = document.getElementById('msg');
function showMsg(text, sec = 4) {
  msgEl.textContent = text;
  msgEl.style.opacity = 1;
  clearTimeout(showMsg.t);
  showMsg.t = setTimeout(() => { msgEl.style.opacity = 0; }, sec * 1000);
}

// ---- 入力 ----
const keys = new Set();
let lungeReq = false, breathReq = false, callReq = false, breachReq = false; // 短く押しても取りこぼさないように、押した瞬間を覚えておく
addEventListener('keydown', (e) => {
  keys.add(e.code);
  const playing = game?.mode === 'play';
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat && playing) lungeReq = true; }
  if (e.code === 'KeyB' && !e.repeat && playing) breathReq = true;
  if (e.code === 'KeyC' && !e.repeat && playing) callReq = true;
  if (e.code === 'KeyJ' && !e.repeat && playing) breachReq = true;
  // 重さの切り分け用：1 水面 2 光の筋 3 マリンスノー 4 潮吹き 5 魚 の表示を切り替える
  const layer = { Digit1: sea.surface, Digit2: sea.shafts, Digit3: sea.snow,
    Digit4: spout.points, Digit5: fish.mesh }[e.code];
  if (layer && !e.repeat) layer.visible = !layer.visible;
});
addEventListener('keyup', (e) => keys.delete(e.code));
const held = (...codes) => codes.some((c) => keys.has(c));

// マウス＆タッチ：カーソルの位置またはなぞった方向を追いかける
const mouse = { inside: false, ndc: new THREE.Vector2(), target: new THREE.Vector3() };
const ray = new THREE.Raycaster();
const swimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -SEA.depth);
const canvas = renderer.domElement;
const setNdc = (e) => mouse.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);

// スマホ・タブレット用の薄い補助ボタン（鳴く・潮吹き・ジャンプ）
const btnCallEl = document.getElementById('btnCall');
const btnSpoutEl = document.getElementById('btnSpout');
const btnBreachEl = document.getElementById('btnBreach');
if (btnCallEl) btnCallEl.addEventListener('click', (e) => { e.stopPropagation(); if (game?.mode === 'play') callReq = true; });
if (btnSpoutEl) btnSpoutEl.addEventListener('click', (e) => { e.stopPropagation(); if (game?.mode === 'play') breathReq = true; });
if (btnBreachEl) btnBreachEl.addEventListener('click', (e) => { e.stopPropagation(); if (game?.mode === 'play') breachReq = true; });

let clickTimer = null;
let lastLeftClickT = 0;
let rightClickTimer = null;
let lastRightClickT = 0;

// タッチ操作用状態（なぞり遊泳・タップ突進・ダブルタップ・2本指タップ吹鳴）
let isTouchMode = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
let prevWhaleInv = null;
const activeTouches = new Map();
let touchStartX = 0, touchStartY = 0, touchStartT = 0, touchMaxMove = 0, touchMulti = false;
let lastTouchTapT = 0;

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') {
    if (!activeTouches.has(e.pointerId)) return;
    activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const dist = Math.hypot(e.clientX - touchStartX, e.clientY - touchStartY);
    if (dist > touchMaxMove) touchMaxMove = dist;
    mouse.inside = true;
    setNdc(e);
    return;
  }
  mouse.inside = true;
  setNdc(e);
});

canvas.addEventListener('pointerleave', (e) => {
  if (e.pointerType !== 'touch') mouse.inside = false;
});

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') {
    isTouchMode = true;
    if (game?.enableTouchUI) game.enableTouchUI();
    activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activeTouches.size >= 2) {
      // 2本指タップ：吹鳴（ソナー）発動
      touchMulti = true;
      if (clickTimer !== null) { clearTimeout(clickTimer); clickTimer = null; }
      if (game?.mode === 'play') callReq = true;
      return;
    }
    touchMulti = false;
    touchStartX = e.clientX;
    touchStartY = e.clientY;
    touchStartT = performance.now();
    touchMaxMove = 0;
    mouse.inside = true;
    setNdc(e);
    // タッチした位置に生き物がいれば図鑑カードを表示
    if (game?.inspectAt) game.inspectAt(mouse.ndc);
    return;
  }

  if (game?.mode !== 'play') return;
  const now = performance.now();
  // 左ボタン：シングルクリック＝突進（食べる）、ダブルクリック＝息継ぎ（潮吹き）
  if (e.button === 0) {
    if (clickTimer !== null || (now - lastLeftClickT < 320)) {
      if (clickTimer !== null) { clearTimeout(clickTimer); clickTimer = null; }
      lungeReq = false;
      breathReq = true;
      lastLeftClickT = 0;
    } else {
      lastLeftClickT = now;
      clickTimer = setTimeout(() => {
        clickTimer = null;
        lungeReq = true;
      }, 220);
    }
  }
  // 右ボタン：シングルクリック＝吹鳴（鳴く）、ダブルクリック＝ブリーチング（大ジャンプ）
  if (e.button === 2) {
    if (rightClickTimer !== null || (now - lastRightClickT < 320)) {
      if (rightClickTimer !== null) { clearTimeout(rightClickTimer); rightClickTimer = null; }
      callReq = false;
      breachReq = true;
      lastRightClickT = 0;
    } else {
      lastRightClickT = now;
      rightClickTimer = setTimeout(() => {
        rightClickTimer = null;
        callReq = true;
      }, 220);
    }
  }
});

const onTouchEnd = (e) => {
  if (e.pointerType !== 'touch') return;
  activeTouches.delete(e.pointerId);
  if (activeTouches.size === 0) {
    mouse.inside = false; // 指を離したらその向きのままゆったり巡航を続ける
    const now = performance.now();
    const dtTap = now - touchStartT;
    // 短いタップ（ドラッグ移動 22px 未満・320ms 以内）ならジェスチャー判定
    if (!touchMulti && game?.mode === 'play' && dtTap < 320 && touchMaxMove < 22) {
      if (clickTimer !== null || (now - lastTouchTapT < 340)) {
        // ダブルタップ：息継ぎ（潮吹き）
        if (clickTimer !== null) { clearTimeout(clickTimer); clickTimer = null; }
        lungeReq = false;
        breathReq = true;
        lastTouchTapT = 0;
      } else {
        // シングルタップ：突進（食べる）
        lastTouchTapT = now;
        clickTimer = setTimeout(() => {
          clickTimer = null;
          lungeReq = true;
        }, 230);
      }
    }
  }
};
canvas.addEventListener('pointerup', onTouchEnd);
canvas.addEventListener('pointercancel', onTouchEnd);

canvas.addEventListener('dblclick', (e) => {
  if (game?.mode === 'play') {
    if (clickTimer !== null) { clearTimeout(clickTimer); clickTimer = null; }
    lungeReq = false;
    breathReq = true;
  }
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// 画面の上・右にあたる水平方向
const camFwd = new THREE.Vector3(-CAM_OFFSET.x, 0, -CAM_OFFSET.z).normalize();
const camRight = new THREE.Vector3().crossVectors(camFwd, new THREE.Vector3(0, 1, 0));

// ---- クジラの状態 ----
const st = { yaw: Math.atan2(camRight.x, camRight.z), speed: 1.5, yawRate: 0, vy: 0, riseGoal: 0, pitch: 0, roll: 0, spouted: false, spoutT: -1, lungeT: -1, eaten: 0, gulp: 0, open: 0, breathT: -1, sinceBreath: 20, breachT: -1, breachType: 0, breachLaunched: false, breachSplashed: false };

// 尾のひと振りの時間配分（秒）：振り上げ（反り返り）→ 打ち下ろし。whale.js の DASH_PERIOD と合わせる
const STROKE_UP = 0.25, STROKE_DOWN = 0.5;
// 突進で口を開け始める時刻：尾を振りかぶったあたり。口を開けながら打ち下ろして突っ込む
const LUNGE_OPEN = 0.2;
// 尾を打ち下ろし終わる時刻。それまでは加速する
const LUNGE_PUSH_END = STROKE_UP + STROKE_DOWN;

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function updateWhale(dt) {
  const p = whale.group.position;
  const dir = new THREE.Vector3()
    .addScaledVector(camFwd, (held('KeyW', 'ArrowUp') ? 1 : 0) - (held('KeyS', 'ArrowDown') ? 1 : 0))
    .addScaledVector(camRight, (held('KeyD', 'ArrowRight') ? 1 : 0) - (held('KeyA', 'ArrowLeft') ? 1 : 0));
  const playing = game.mode === 'play';
  const moving = playing && dir.lengthSq() > 0;

  // ブリーチング開始トリガー（マウス右クリック または J キー）：カーブ中・ダッシュ直後・突進中・潮吹き中でも即座にシームレス接続！
  if (breachReq && st.breachT < 0) {
    // 突進中・潮吹き中であっても、勢いを殺さず即座にブリーチングへバトンタッチ
    if (st.lungeT >= 0) st.lungeT = -1;
    if (st.breathT >= 0) { st.breathT = -1; st.spouted = false; st.riseGoal = 0; }
    st.breachT = 0;
    st.breachType = (st.breachType + 1) % 3; // 3種の飛び方を順番に（0:背面スピン, 1:サイドスラム, 2:前方ベリーフロップ）
    st.breachLaunched = false;
    st.breachSplashed = false;
    st.breachRoll0 = st.roll; // カーブ中のバンク角（傾き）をそのまま保持して滑らかに繋ぐ！
    st.breachY0 = p.y; // 開始深度を記録
    st.breachPitch0 = st.pitch;
    st.breachSpeed0 = st.speed; // 開始時の前進速度を記録（低速時の水中タメ助走に反映）
    whale.dashT = 0; // 力強い尾の打ち下ろしストロークを必ず最初から発動
    if (playing) belly.value = Math.max(0, belly.value - 2.5 / Z.T); // ブリーチングで大ジャンプするとお腹が少し減る（大型種ほど変動は緩やか）
  }
  breachReq = false;

  const isBreaching = st.breachT >= 0;

  // お腹が空いていると少し遅いだけ。死にはしない
  // 空腹が極まったら（belly.value <= 0）死なせるのではなくスピード半減（0.5倍）
  const hungryFactor = (playing && belly.value < 5) ? (0.5 + 0.5 * Math.max(0, belly.value / 5)) : 1.0;
  const fast = held('ShiftLeft', 'ShiftRight') && belly.value > 3;
  let targetSpeed = (moving ? (fast ? 7 : 3) : 1.0) * Z.P * hungryFactor;
  let targetYaw = moving ? Math.atan2(dir.x, dir.z) : st.yaw;
  if (playing && mouse.inside && !moving && !isBreaching) {
    // カーソルが遠いほど速く泳ぐ。近くまで来たら追うのをやめて、ゆっくり前へ流す（ぐるぐる回らないように）
    ray.setFromCamera(mouse.ndc, camera);
    if (ray.ray.intersectPlane(swimPlane, mouse.target)) {
      const dx = mouse.target.x - p.x, dz = mouse.target.z - p.z;
      const dist = Math.hypot(dx, dz);
      const dMult = window.RORQUAL_TUNING?.deadzoneMult ?? 1.0;
      const minTurnDist = (activeTouches.size > 0 ? 2.2 : 4.0) * Z.V * dMult;
      if (dist > minTurnDist) {
        targetYaw = Math.atan2(dx, dz);
        // 画面の端で最高速（距離はカメラの引き具合 V、速さは P で換算）
        targetSpeed = Z.P * Math.min(belly.value > 3 ? 7 : 3, 1.0 + Math.max(0, dist / Z.V - minTurnDist / Z.V) * 0.5) * hungryFactor;
      }
    }
  }
  if (!playing && !isBreaching) {
    // タイトルなどの間は勝手に泳ぐ：ゆっくり向きを変えながら、前に群れがあればときどき突っ込む
    st.autoT = (st.autoT || 0) + dt;
    targetYaw = st.yaw + Math.sin(st.autoT * 0.23) * 0.5 + Math.sin(st.autoT * 0.071) * 0.4;
    targetSpeed = 2.2 * Z.P;
    ahead.set(p.x + Math.sin(st.yaw) * 7 * Z.V, fish.layerY, p.z + Math.cos(st.yaw) * 7 * Z.V);
    if (st.lungeT < 0 && st.autoT - (st.autoLunge || 0) > 9 && fish.near(ahead, 3 * Z.V)) { lungeReq = true; st.autoLunge = st.autoT; }
  }

  // 突進：後ろ半身を反らせて尾びれを振り上げ、打ち下ろして加速 → 口を大きく開ける →
  // 進む勢いで口に水が入り、開いたまま喉のひだが膨らむ → 口を閉じて膨らみだけが残る →
  // 口をわずかに開け、ひげ板の間から海水を押し出して膨らみが消える
  // 息つぎで浮いている最中は魚の上を素通りしてしまうので、突進は息つぎが終わってから
  // 息つぎの途中でも、潮を吹いている最中でなければ突進に移る（息つぎはそこで打ち切り）
  // 潮吹き中の判定：水面で潮を吹き上げている瞬間（約0.9秒）のみ突進を保留。吹き終われば直ちにダッシュ可能！
  const spoutingActive = st.spouted && st.spoutT >= 0 && st.spoutT < (0.9 * Math.sqrt(Z.S));

  // 突進（ダッシュ）の受付・再点火条件：
  // 1. 通常時（st.lungeT < 0）
  // 2. 連続ダッシュ：口が閉じた後（t >= LUNGE_OPEN + 0.7）であれば、10数秒も待たずに即座に再加速・連続突進可能！
  const lungeCanRetrigger = st.lungeT >= 0 && (st.lungeT / Z.T) >= (LUNGE_OPEN + 0.7);

  if (lungeReq && (st.lungeT < 0 || lungeCanRetrigger) && !spoutingActive && !isBreaching) {
    if (st.breathT >= 0) {
      if (st.spouted) st.sinceBreath = 0; // 吹き終わっていれば息つぎ完了
      st.breathT = -1; st.spouted = false; st.riseGoal = 0; // 浮く目標を戻して、突進で群れの深さへ急行
    }
    st.lungeT = 0; st.eaten = 0; st.joyDone = false; lungeReq = false; whale.startStroke(); sfx.playLunge();
  }
  if (st.lungeT >= 0 && !lungeCanRetrigger) lungeReq = false;

  let accel = 0.7 / Z.T; // 大きな体なので、速さはゆっくりしか変わらない（時定数 約 1.4 秒。大きい種ほど長い）
  if (st.lungeT >= 0) {
    st.lungeT += dt;
    // 突進の段取りの時刻は、ミンクの時間に換算して判定する（大きい種ほどゆっくり）
    const t = st.lungeT / Z.T;
    // 尾の打ち下ろしで力強く加速（実際に速さが増えるのは打ち下ろしの間だけ。下の「ひと振り」参照）。
    // 袋が膨らんでいる間は抵抗が小さいので勢いはほぼ保ち（この間に魚を食べる）、
    // 袋が膨らみきってからは抵抗が大きくなって、ぐっと減速する
    if (t < LUNGE_PUSH_END) { targetSpeed = 9 * Z.P * hungryFactor; accel = 1.4 / Z.T; }
    else if (st.gulp < 0.9 && t < LUNGE_OPEN + 1.1) { targetSpeed = 1.0 * Z.P; accel = 0.25 / Z.T; }
    else { targetSpeed = 2.0 * Z.P; accel = 0.8 / Z.T; } // 膨らみきったあとの減速は控えめに
    const EXPEL = LUNGE_OPEN + 1.85; // 海水を押し出し始める時刻
    // 袋は「口を開けたまま進んだ距離」の分だけ水が入って膨らむ。FILL_DIST m 進むと満杯
    const FILL_DIST = 4.5 * Z.S;
    if (t < LUNGE_OPEN) st.gulp = Math.max(0, st.gulp - dt * 0.12 / Z.T) * Math.exp(-dt * 2.2 / Z.T);
    else if (t < EXPEL) st.gulp = Math.min(1, st.gulp + st.open * st.speed * dt / FILL_DIST);
    else { st.gulp = Math.max(0, st.gulp - dt * 0.04 / Z.T) * Math.exp(-dt * 1.15 / Z.T); whale.pouchBonus = Math.max(0, whale.pouchBonus - dt * 0.03 / Z.T) * Math.exp(-dt * 1.15 / Z.T); }
    const o = t - LUNGE_OPEN; // 口を開け始めてからの時間
    st.open = smooth(0, 0.25, o) * (1 - smooth(0.85, 1.25, o))
      + (t > EXPEL ? 0.1 * smooth(EXPEL, EXPEL + 0.3, t) * st.gulp : 0); // 押し出す間のすき間
    // 口を閉じた直後（o >= 1.22）：たくさん食べていたら喜びを表すようにクジラから光の粒がぽわぽわとこぼれる
    if (!st.joyDone && o >= 1.22) {
      st.joyDone = true;
      if (playing && st.eaten >= 15) {
        spout.emitWhaleJoy(whale.group, Z.S, Math.min(55, 16 + Math.round(st.eaten * 0.5)));
      }
    }
    // 突進状態の自然終了時間を EXPEL + 3.6 から EXPEL + 1.1 へ短縮（放置しても速やかに通常遊泳に復帰）
    if (t > EXPEL + 1.1) { st.lungeT = -1; }
  } else {
    // 突進中断時や通常遊泳時：喉の膨らみや開いた口を有機的でゆったりとした速度（生物らしい筋力・排水抵抗）で滑らかに閉じてしぼませる
    if (st.gulp > 0) st.gulp = Math.max(0, st.gulp - dt * 0.04 / Z.T) * Math.exp(-dt * 1.15 / Z.T);
    else st.gulp = 0;
    if (st.open > 0) st.open = Math.max(0, st.open - dt * 0.06 / Z.T) * Math.exp(-dt * 2.2 / Z.T);
    else st.open = 0;
    if (whale.pouchBonus > 0) whale.pouchBonus = Math.max(0, whale.pouchBonus - dt * 0.03 / Z.T) * Math.exp(-dt * 1.15 / Z.T);
    else whale.pouchBonus = 0;
  }

  // 旋回制御：ブリーチング中もカーブの旋回慣性を維持しながら優雅に弧を描いて水面へ！
  if (isBreaching) {
    targetYaw = st.yaw;
    st.yawRate *= Math.max(0, 1 - dt * 1.6); // カーブの勢いを殺さず滑らかに保つ
  } else {
    // 速いほど曲がりにくい。回転半径は MIN_TURN_R m より小さくならない。
    // 曲がる速さそのものにも慣性をつけて、曲がり始めと曲がり終わりをゆっくりにする
    const rMult = window.RORQUAL_TUNING?.turnRadiusMult ?? 1.0;
    const rateMult = window.RORQUAL_TUNING?.turnRateMult ?? 1.0;
    const lungeSteer = window.RORQUAL_TUNING?.lungeSteer ?? 0.0;
    const MIN_TURN_R = Math.max(0.2, 2 * Z.S * rMult);
    const speedDamping = (st.lungeT >= 0 && lungeSteer > 0) ? (1 + (st.speed / Z.P) * 0.13 * (1 - lungeSteer * 0.7)) : (1 + (st.speed / Z.P) * 0.13);
    const maxTurn = 1.2 * rateMult;
    const turn = Math.min(maxTurn / speedDamping / Z.T, Math.max(st.speed, 1.2 * Z.P) / MIN_TURN_R);
    const d = angleDiff(st.yaw, targetYaw);
    const wantRate = Math.max(-turn, Math.min(turn, d * (0.8 * rateMult)));
    st.yawRate += (wantRate - st.yawRate) * Math.min(1, dt * 1.2 * rateMult / Z.T);
  }
  st.yaw += st.yawRate * dt;

  // ブリーチング中の物理（前進速度・垂直軌道・ロール）
  if (isBreaching) {
    st.breachT += dt;

    // 開始時の速度比（0: 低速・静止状態からの発動, 1: ダッシュ・高速遊泳からの発動）
    const s0 = st.breachSpeed0 ?? st.speed;
    const speedRatio = Math.min(1, Math.max(0, (s0 / Z.P - 1.0) / 5.5));
    // 低速時は尾びれを振りかぶって前進速度を乗せる「水中タメ助走」を少し長めに取る
    const RUN_T = (1.22 - 0.34 * speedRatio) * Z.T;
    const AIR_T = 1.65 * Z.T;
    const TOTAL_T = RUN_T + AIR_T;

    const yEntry = -0.45 * Math.pow(Z.S, 0.72); // 水面突破時の中心深さ
    const yExit  = -0.60 * Math.pow(Z.S, 0.72); // 着水時の中心深さ
    // 大型種は尾が水中に残るため、体長に対する重心上昇量を抑えつつ水面上に上半身が雄大に乗り出す放物線高
    const arcH   = 1.25 + 0.12 * Z.S;
    const yStart = st.breachY0 ?? SEA.depth;
    const bRoll0 = st.breachRoll0 || 0;
    const bPitch0 = st.breachPitch0 || 0;

    if (st.breachT < RUN_T) {
      // 1. 水中助走：低速時はまず尾びれの振りかぶり（u < 0.28）でわずかに沈み込みながら前進加速し、
      //    スピードが乗ってから（u > 0.28）水面へ加速上昇する（水面手前で減速しないべき乗曲線）
      const u = st.breachT / RUN_T;
      const peakSpeed = 9.8 * Z.P;
      const speedCurve = Math.pow(smooth(0.06, 0.86, u), 1.15);
      st.speed = s0 + (Math.max(s0, peakSpeed) - s0) * speedCurve;

      const climbPow = 2.35 - 0.65 * speedRatio;
      const shallowLack = Math.max(0, 1.35 * Z.S - (yEntry - yStart));
      const crouchAmp = 0.38 * (1 - speedRatio) * Z.S + shallowLack * 1.1;
      const dyClimb = yEntry - yStart;
      p.y = yStart + dyClimb * Math.pow(u, climbPow) - crouchAmp * u * (1 - u) * (1 - u);

      // 瞬間の上昇速度 vy から進行方向角（フライトパス角）を求め、体軸ピッチを進行方向と完全一致させる
      const vyClimb = (dyClimb * climbPow * Math.pow(Math.max(1e-4, u), climbPow - 1) - crouchAmp * (1 - u) * (1 - 3 * u)) / RUN_T;
      const pathPitch = Math.atan2(vyClimb, Math.max(st.speed, 3.2 * Z.P));
      const targetPitch = THREE.MathUtils.lerp(bPitch0, pathPitch, smooth(0.0, 0.35, u));
      st.pitch += (targetPitch - st.pitch) * Math.min(1, dt * 12 / Z.T);
      st.roll = bRoll0;
    } else if (st.breachT < TOTAL_T) {
      // 2. 水面突破・空中放物線飛翔：水中からの上昇速度のまま減速せず水面を突き破り、重力による放物線を描く
      if (!st.breachLaunched) {
        st.breachLaunched = true;
        sfx.playBreachLaunch();
        spout.emitSplash(whale.group.position, Z.S * 0.7, 45);
        fish.scatter(whale.group.position, 9 * Z.S, 4.5 * Z.P);
      }
      targetSpeed = Math.max(st.speed, 8.6 * Z.P);
      st.speed += (targetSpeed - st.speed) * Math.min(1, dt * 1.2 / Z.T);

      const jNorm = (st.breachT - RUN_T) / AIR_T; // 0..1（水面突破 〜 頂点 〜 着水）
      // 重力放物線軌道：4 * arcH * w * (1 - w) により水面突破時(w=0)の上昇速度が最大で、頂点(w=0.5)で0、着水(w=1)で落下速度最大
      p.y = yEntry * (1 - jNorm) + yExit * jNorm + 4 * arcH * jNorm * (1 - jNorm);
      const vyAir = ((yExit - yEntry) + 4 * arcH * (1 - 2 * jNorm)) / AIR_T;
      const targetPitch = Math.atan2(vyAir, Math.max(st.speed, 3.5 * Z.P));
      st.pitch += (targetPitch - st.pitch) * Math.min(1, dt * 12 / Z.T);

      // 水面を突っ切る連続航跡白波：大型クジラほど巨体が水面を割る豪快な白波トレイルが湧き上がる！
      ahead.set(p.x + Math.sin(st.yaw) * 2.2 * Z.S, 0.1, p.z + Math.cos(st.yaw) * 2.2 * Z.S);
      spout.emitWake(ahead, Z.S, Math.round(1 + 1.2 * Z.S));

      // アクション種別に応じたロール旋回（着水時に角度ジャンプが起きないよう滑らかなS字で目標角へ到達）
      const easeRoll = smooth(0.0, 1.0, jNorm);
      if (st.breachType === 0) {
        // バレルロール（スピン）：カーブの傾きからそのまま回転方向へ滑らかにロール
        st.roll = THREE.MathUtils.lerp(bRoll0, bRoll0 + Math.PI * 1.25, easeRoll);
      } else if (st.breachType === 1) {
        // サイドスラム：旋回方向に合わせて自然に胸鰭を広げて横倒し
        const sideSign = (st.yawRate < -0.02 || bRoll0 > 0.05) ? 1 : (st.yawRate > 0.02 || bRoll0 < -0.05) ? -1 : 1;
        st.roll = THREE.MathUtils.lerp(bRoll0, sideSign * Math.PI * 0.55, easeRoll);
      } else {
        // ベリーフロップ：平打ち姿勢へ滑らかに移行
        st.roll = THREE.MathUtils.lerp(bRoll0, 0, easeRoll) + Math.sin(jNorm * Math.PI) * 0.08;
      }
    } else {
      // 3. 豪快着水：海面へ着水した瞬間に大飛沫を放ち、姿勢や速度をカクつかせず通常操作へシームレス復帰！
      sfx.playBreachSplash();
      spout.emitSplash(whale.group.position, Z.S * 1.0, 85);

      fish.scatter(whale.group.position, 16 * Z.S, 11 * Z.P);

      // 着水直後の海中への運動量を引き継いで通常操作へバトンタッチ（角度の強制上書きによるカクつきを廃止）
      st.breachT = -1;
      st.sinceBreath = 0; // 呼吸完了
      st.vy = -3.0 * Z.P; // 放物線終端の落下速度を引き継ぐ水中潜行初速
      st.speed = Math.max(st.speed, 6.2 * Z.P); // 着水スプリントの余韻速度
    }
  } else {
    // 通常の速度変化・尾びれのひと振り
    if (targetSpeed - st.speed > 2.5 * Z.P) whale.startStroke();
    const sk = whale.strokeT / Z.T;
    if (whale.strokeT >= 0 && targetSpeed > st.speed) {
      if (sk < STROKE_UP) accel *= 0.6;
      else if (sk < STROKE_UP + STROKE_DOWN) accel *= 2.5;
    }
    st.speed += (targetSpeed - st.speed) * Math.min(1, dt * accel);

    // 通常の呼吸・浮上処理（ダブルクリック等の breathReq はいつでも最優先で即座に発動！）
    st.sinceBreath += dt;
    if (breathReq) {
      if (st.lungeT >= 0) st.lungeT = -1; // 突進中なら即時キャンセル
      st.breathT = 0;
      st.spouted = false; // まだ吹いていない状態にリセットして確実に潮吹きを発生
      st.riseGoal = 2.3 * Z.S;
      st.vy = Math.max(st.vy, 1.8 * Z.P); // 水面へ向かう上昇初速を付与してキビキビ浮上
      targetSpeed = Math.max(targetSpeed, 3.8 * Z.P);
    } else if (st.sinceBreath > 30 && st.breathT < 0 && st.lungeT < 0) {
      st.breathT = 0;
    }
    breathReq = false;

    let riseTarget = 0;
    if (st.spoutT >= 0) st.spoutT += dt;
    if (st.breathT >= 0) {
      st.breathT += dt;
      if (st.breathT < 1.8 * Z.T) riseTarget = 2.3 * Z.S;
      if (!st.spouted && p.y > SEA.depth + 1.3 * Z.S) { st.spouted = true; st.spoutT = 0; spout.emit((v) => whale.blowholeWorld(v), Z.S); sfx.playSpout(); }
      if (st.breathT > 5 * Z.T) { st.breathT = -1; st.sinceBreath = 0; st.spouted = false; }
    }

    st.riseGoal += (riseTarget - st.riseGoal) * Math.min(1, dt * 1.5 / Z.T);
    const K = 5 / (Z.T * Z.T), C = 2 * Math.sqrt(K);
    st.vy += (K * (SEA.depth + st.riseGoal - p.y) - C * st.vy) * dt;
    p.y += st.vy * dt;

    const pitchTarget = Math.max(-0.25, Math.min(0.25, st.vy / Math.max(st.speed, 2 * Z.P) * 0.5));
    st.pitch += (pitchTarget - st.pitch) * Math.min(1, dt * 2);
  }

  // 水平移動の反映（ブリーチ中も前進力を維持して力強く進む！）
  p.x += Math.sin(st.yaw) * st.speed * dt;
  p.z += Math.cos(st.yaw) * st.speed * dt;


  // あるべきロール姿勢（目標姿勢：旋回バンク角）への滑らかな追従
  // 急な切り替え時（ブリーチ着水直後など）も、水流の中で自然に起き上がるように追いつき、通常時は常に一致
  if (st.breachT < 0) {
    const targetRoll = -st.yawRate * 0.8;
    let rollDiff = targetRoll - st.roll;
    while (rollDiff > Math.PI) rollDiff -= Math.PI * 2;
    while (rollDiff < -Math.PI) rollDiff += Math.PI * 2;
    st.roll += rollDiff * Math.min(1, dt * (3.2 / Z.T));
  }
  whale.group.rotation.set(-st.pitch, st.yaw, st.roll);

  whale.group.updateMatrixWorld(); // 口の位置をこのコマの姿勢で計算するため
  whale.animate(dt, st.speed, st.gulp, st.open);

  // 鳴き声（C キー）：鳴くと波紋が広がり、種ごとの合成音が鳴る
  st.callCooldown = Math.max(0, (st.callCooldown || 0) - dt);
  if (callReq && st.callCooldown <= 0) {
    st.callCooldown = 2.2;
    const speciesId = game?.area?.whale ?? 'minke';
    voice.play(speciesId);
    soundRings.emit(whale.group.position, Z.S);
    pod.onPlayerCall(whale.group.position);
  }
  callReq = false;

  // 口を開けている間、開いた口のあたりにいる魚を飲み込む。口が開き始めた瞬間から有効
  whale.mouthWorld(mouth);
  // 開いた口の開口部（上あご・下がった下あご・あごの付け根で囲まれた三角形）に入った魚を、まとめて飲み込む
  const tn = st.lungeT / Z.T;
  if (tn >= LUNGE_OPEN && tn < LUNGE_OPEN + 1.25 && st.open > 0.05) {
    const inv = new THREE.Matrix4().copy(whale.group.matrixWorld).invert();
    const res = fish.eatGape(inv, whale.mouthGape(st.open), prevWhaleInv);
    prevWhaleInv = inv;
    const n = typeof res === 'number' ? res : res.count;
    const val = typeof res === 'number' ? n * fish.food.value : res.value;
    if (st.eaten === 0) sfx.playGulp();
    st.eaten += n;
    whale.pouchBonus = Math.min(0.5, st.eaten / 200); // たくさん飲み込むほど袋が少し大きく膨らむ
    // 中では 100 を超えて持つ（表示だけ 100 で止める）。
    // 大きい種のときは群れの間隔をカメラの引き具合 V だけ広げているので、一匹が表す量も V 倍にする
    if (n > 0 && playing) {
      // 大型クジラほど胃袋が大きく代謝もゆったりしているため、1匹あたりのゲージ戻り量も緩やかにする
      // タッチ操作（スマホ）時は視界や旋回操作のハンデを考慮して栄養摂取を1.35倍アシスト
      const touchBonus = isTouchMode ? 1.35 : 1.0;
      const gain = (val / Math.pow(Z.S, 0.25)) * touchBonus;
      belly.value = Math.min(100, belly.value + gain);
      st.sinceEat = 0;
      // 目的ガイドが表示中だったら、食べられた瞬間にふわっと消す
      if (st.guideShowing) {
        st.guideShowing = false;
        msgEl.style.opacity = 0;
      }
      if (belly.value >= 100 && !belly.full) {
        belly.full = true;
        showMsg(t('full', { area: t('area.' + game.area.id) }), 3);
        game.onFull();
      }
    }
  } else {
    prevWhaleInv = null;
  }
  if (playing) {
    // 基礎代謝＋泳ぐ速さに応じたエネルギー消費（見てわかる自然なペースでお腹が減る）
    // 大型クジラほど時間の流れ（Z.T）に合わせて空腹の進みも緩やかにする
    // タッチ操作（スマホ）時は画面が指で隠れがちなため空腹減衰を約25%マイルドに補正
    const touchFactor = isTouchMode ? 0.75 : 1.0;
    const drainRate = ((0.18 + (st.speed / Z.P) * 0.035 + (st.speed > 6 * Z.P ? 0.22 : 0)) / Z.T) * touchFactor;
    belly.value = Math.max(0, belly.value - dt * drainRate);

    // 目的ガイド：ある程度おなかがすいてきて（belly <= 12）、しばらく食べていないときに案内を出す
    st.sinceEat = (st.sinceEat || 0) + dt;
    st.guideCooldown = Math.max(0, (st.guideCooldown || 0) - dt);
    if (!belly.full && belly.value <= 12.5 && st.sinceEat > 9 && st.guideCooldown <= 0) {
      st.guideCooldown = 28;
      st.guideShowing = true;
      showMsg(t('hungryGuide'), 5.5);
    }
  }
  bellyEl.style.width = Math.min(100, belly.value) + '%';
  if (bellyWrapEl) {
    bellyWrapEl.style.background = (playing && belly.value <= 0.5) ? 'rgba(255, 110, 90, 0.38)' : '#ffffff22';
    bellyWrapEl.style.boxShadow = (playing && belly.value <= 0.5) ? '0 0 8px rgba(255, 110, 90, 0.55)' : 'none';
  }
}
const mouth = new THREE.Vector3(), ahead = new THREE.Vector3();

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// 主役のクジラの種を切り替える：形と、大きさから決まる倍率（深さ、カメラ、えさの配り方など）
function setSpecies(sp) {
  whale.setSpecies(sp);
  Object.assign(Z, scalesOf(sp));
  SEA.depth = BASE_DEPTH * Z.S;
  swimPlane.constant = -SEA.depth;
  fish.setScale(Z);
  updateCameraLens();
}

// ---- ゲームの流れ（タイトル・海域・クリア・エンディング） ----
const camTarget = new THREE.Vector3().copy(whale.group.position), camAim = new THREE.Vector3();
const START_YAW = st.yaw;
// 海域に入るとき：クジラを初期の位置・向き・状態に戻し、カメラもその場へ
function resetPlayer() {
  whale.group.position.set(0, SEA.depth, 0);
  Object.assign(st, { yaw: START_YAW, speed: 1.5, yawRate: 0, vy: 0, riseGoal: 0, pitch: 0, spouted: false, spoutT: -1,
    lungeT: -1, eaten: 0, joyDone: false, gulp: 0, open: 0, breathT: -1, sinceBreath: 20, breachT: -1, roll: 0,
    sinceEat: 0, guideCooldown: 0, guideShowing: false });
  whale.trail.length = 0;
  whale.dashT = -1;
  whale.pouchBonus = 0;
  lungeReq = breathReq = callReq = breachReq = false;
  camTarget.copy(whale.group.position);
}
game = setupFlow({ scene, sea, fish, whale, st, belly, camera, resetPlayer, setSpecies, Z, pod, dolphins, creatures, birds });

// 画面に映っているかの判定（魚の群れを見えないところに出すため）。視野はコマごとに作り直す
const frustum = new THREE.Frustum(), viewProj = new THREE.Matrix4(), sphere = new THREE.Sphere();
fish.isVisible = (p, r) => frustum.intersectsSphere(sphere.set(p, r));

// ---- ループ ----
const clock = new THREE.Clock();
const fpsEl = document.getElementById('fps');
let fpsN = 0, fpsT = 0;
function loop() {
  const raw = clock.getDelta();
  const dt = Math.min(raw, 0.05);
  fpsN++; fpsT += raw;
  if (fpsT > 0.5) {
    const fps = fpsN / fpsT;
    const next = fps < 45 ? Math.max(MIN_RATIO, ratio * 0.8) : fps > 58 ? Math.min(MAX_RATIO, ratio * 1.05) : ratio;
    if (Math.abs(next - ratio) > 1e-3) { ratio = next; renderer.setPixelRatio(ratio); }
    fpsEl.textContent = `${Math.round(fps)} fps / ${Math.round(ratio * 100)}%`;
    fpsN = 0; fpsT = 0;
  }
  updateWhale(dt);
  game.hover(dt, mouse.ndc, mouse.inside);
  // 魚の警戒：突進の踏み込み（尾の打ち下ろし）で半分ほど気づき、口が開き始めると全力で逃げる
  const alarm = st.lungeT >= 0 ? Math.max(0.5 * smooth(0.15, 0.45, st.lungeT / Z.T), smooth(0.05, 0.4, st.open)) : 0;
  fish.update(dt, mouth, st.yaw, alarm);
  sea.update(dt, whale.group.position);
  spout.update(dt);
  soundRings.update(dt, fish, spout, Z);
  pod.update(dt, whale.group.position, st.yaw, st.speed, game.mode === 'play');
  birds.update(dt, whale.group.position, Z);
  dolphins.update(dt, whale.group.position, st.yaw, st.speed, Z);
  creatures.update(dt, whale.group.position, st.yaw, Z);
  spout.setView(renderer, camera);
  fish.setView(renderer);
  // タイトルなどの間は、左のダイアログに隠れないよう、クジラが画面の右寄りに映るようにカメラをずらす（スマホ縦画面では中央）
  const titleOffset = (game.mode === 'play' || innerWidth <= 680) ? 0 : -7 * Z.V;
  camAim.copy(whale.group.position).addScaledVector(camRight, titleOffset);
  camTarget.lerp(camAim, Math.min(1, dt * 1.5));
  camTarget.y = SEA.depth; // 呼吸で浮いてもカメラは上下させない
  camera.position.copy(camTarget).addScaledVector(CAM_OFFSET, Z.V * Z.camPull); // 大きい種や縦画面ほどカメラを引く
  camera.lookAt(camTarget);
  camera.updateMatrixWorld();
  frustum.setFromProjectionMatrix(viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();

addEventListener('resize', () => {
  updateCameraLens();
  renderer.setSize(innerWidth, innerHeight);
});

window.__rorqual = { whale, st, keys, fish, belly, spout, sea, renderer, scene, camera, mouse, game, Z, voice, soundRings, soundIndicator, pod, birds, dolphins, creatures };

window.__debug = { whale, st, sfx, spout, camera, game };

// 群れ完食時のマイクロ報酬演出ハンドラ
window.onSchoolCleared = (schoolPos, species) => {
  if (!playing) return;
  // 1. クジラから小さな喜びの光の粒をふわっと放出
  if (spout?.emitWhaleJoy) {
    spout.emitWhaleJoy(whale.group, Z.S, 18);
  }
  // 2. 控えめな泡のさざ波
  if (spout?.emitSplash) {
    spout.emitSplash(schoolPos, Z.S * 0.4, 15);
  }
  // 3. 画面中央上部の控えめなトースト表示
  const toast = document.getElementById('clearToast');
  if (toast) {
    toast.textContent = '群れを捕食完了';
    toast.style.opacity = '0.9';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 1600);
  }
};
