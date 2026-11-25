import * as THREE from "three";
import { applyDayCycle, createWorld, resizeWorld, setFocus, setQuality } from "./world.js";
import { animateMarket, buildMarket, cutawayRoofs } from "./market.js";
import {
  MAX_CUSTOMERS_PER_SHOP, animateKeepers, animateShop, buildShops, finishShopDay, pulseLowStock, settleShop, startShopDay,
} from "./shops.js";
import { MAX_WALKERS, animateAmbient, buildAmbient, setCrowdFromCustomers } from "./ambient.js";
import { createCrowd, updateCrowd } from "./people.js";
import { animateTraffic, buildTraffic } from "./traffic.js";
import { createCameraRig } from "./camera.js";
import { createSound, setSound, updateSound } from "./sound.js";
import * as hud from "./hud.js";
import { LAYOUT } from "./layout.js";

const MS_PER_DAY_AT_1X = 8000;
const LOW_QUALITY_CUSTOMERS = 4;
const CROWD_CAPACITY = 560;
const QUALITY_KEY = "kimironko-quality";
const SPEEDS = [1, 2, 4, 8];
const LABEL_GAP = 6;
const LABEL_RANGE = 55;
const PRESET_KEYS = { Digit6: "main", Digit7: "side", Digit8: "back", Digit9: "roadside", Digit0: "five" };

const app = {
  meta: null, seed: 1000, market: "default", speed: 1, playing: true, source: null, queue: [], lastReceivedDay: 0,
  ended: false, summary: null, endShown: false, current: null, dayElapsed: 0, dayProgress: 0.2, latest: null,
};
const container = document.getElementById("scene");
const labels = document.getElementById("labels");
const world = createWorld(container);
const clock = new THREE.Clock();
const fps = { frames: 0, since: performance.now() };
const projected = new THREE.Vector3();
const sound = createSound();
let market;
let shopsView;
let ambient;
let crowd;
let cameraRig;
let traffic;

function readQuality() {
  /** Return the saved quality setting, or high when storage is unavailable. */
  try {
    return localStorage.getItem(QUALITY_KEY) === "low" ? "low" : "high";
  } catch {
    return "high";
  }
}

function applyQuality(quality) {
  /** Switch quality: shadows, resolution, detail props, shoppers shown per shop and people in the lanes. */
  setQuality(world, quality);
  shopsView.customerCap = quality === "low" ? LOW_QUALITY_CUSTOMERS : MAX_CUSTOMERS_PER_SHOP;
  document.getElementById("quality-btn").textContent = `Quality: ${quality === "low" ? "Low" : "High"}`;
  setCrowdFromCustomers(ambient, app.latest ? app.latest.total_customers : 120, quality);
  try {
    localStorage.setItem(QUALITY_KEY, quality);
  } catch {
    return;
  }
}

function productCaps() {
  /** Return the storage cap of each product, and the start cash, for sizing the 3D goods. */
  return { caps: Object.fromEntries(app.meta.products.map((product) => [product.key, product.cap])), startCash: app.meta.start_cash };
}

function dayDuration() {
  /** Return how long one day lasts on screen at the current speed. */
  return MS_PER_DAY_AT_1X / app.speed;
}

function startDay(frame) {
  /** Begin animating one market day for every shop and update the HUD. */
  const meta = productCaps();
  app.current = frame;
  app.latest = frame;
  app.dayElapsed = 0;
  frame.shops.forEach((shopFrame, index) => startShopDay(shopsView, shopsView.shops[index], shopFrame, meta));
  setCrowdFromCustomers(ambient, frame.total_customers, world.quality);
  hud.updateDay(frame);
}

function finishDay() {
  /** Settle every shop at the end of the day. */
  const meta = productCaps();
  for (const shop of shopsView.shops) finishShopDay(shopsView, shop, meta);
  app.current = null;
}

function project(element, point, lift) {
  /** Work out where a label goes on screen, or return null when it is behind the camera or too far away. */
  projected.copy(point).project(world.camera);
  const distance = world.camera.position.distanceTo(point);
  if (projected.z > 1 || distance > LABEL_RANGE) return null;
  const scale = THREE.MathUtils.clamp(14 / distance, 0.75, 1.15);
  const width = element.offsetWidth * scale;
  const height = element.offsetHeight * scale;
  const x = ((projected.x + 1) / 2) * container.clientWidth;
  const y = ((1 - projected.y) / 2) * container.clientHeight - lift;
  return { element, x, y, scale, width, height, distance };
}

function laneInView() {
  /** Return whether the camera can see our lane: inside it, or high enough to look over the roofs. */
  const camera = world.camera.position;
  const inLane = camera.x > LAYOUT.facadeX - 0.5 && camera.x < LAYOUT.hall.xMin + 3 && camera.z > -9 && camera.z < 6.5;
  const overBlock = camera.x > LAYOUT.block.west - 4 && camera.x < LAYOUT.block.east && camera.z > LAYOUT.block.north && camera.z < LAYOUT.block.south;
  return inLane || (camera.y > 6 && overBlock);
}

function placeLabels() {
  /** Pin every shop's bubble and jara float above its counter, nudging them upward so no two ever overlap. */
  const placed = [];
  const items = [];
  const visible = laneInView();
  for (const shop of shopsView.shops) {
    for (const [element, point, lift] of [[shop.bubble, shop.anchors.bubble, 0], [shop.float, shop.anchors.bowl, (shop.floatRise || 0) * 50]]) {
      const item = visible && element.dataset.on ? project(element, point, lift) : null;
      if (item) items.push(item);
      else element.style.display = "none";
    }
  }
  items.sort((a, b) => a.distance - b.distance);
  for (const item of items) {
    let moved = true;
    for (let guard = 0; moved && guard < 12; guard += 1) {
      moved = false;
      for (const other of placed) {
        const overlapX = Math.abs(item.x - other.x) < (item.width + other.width) / 2 + LABEL_GAP;
        const overlapY = item.y > other.y - other.height - LABEL_GAP && item.y - item.height < other.y + LABEL_GAP;
        if (overlapX && overlapY) {
          item.y = other.y - other.height - LABEL_GAP;
          moved = true;
        }
      }
    }
    placed.push(item);
    item.element.style.display = "";
    item.element.style.transform = `translate(-50%, -100%) translate(${item.x}px, ${item.y}px) scale(${item.scale})`;
  }
}

function countFps() {
  /** Update the small fps counter twice a second from wall-clock time, with draw calls, triangles and people in its tooltip. */
  fps.frames += 1;
  const now = performance.now();
  if (now - fps.since >= 500) {
    const counter = document.getElementById("fps");
    const info = world.renderer.info.render;
    counter.textContent = `${Math.round((fps.frames * 1000) / (now - fps.since))} fps`;
    counter.title = `${info.calls} draw calls, ${info.triangles.toLocaleString("en-US")} triangles, ${crowd.visible} people drawn`;
    fps.frames = 0;
    fps.since = now;
  }
}

function tick() {
  /** Advance animation, camera and lighting by one browser frame, and start the next queued day when ready. */
  const delta = Math.min(clock.getDelta(), 0.1);
  const time = clock.elapsedTime;
  world.time.value = time;
  if (app.current && app.playing) app.dayElapsed += delta * 1000;
  if (app.current) {
    const progress = Math.min(app.dayElapsed / dayDuration(), 1);
    app.dayProgress = progress;
    for (const shop of shopsView.shops) animateShop(shopsView, shop, progress);
    if (progress >= 1) finishDay();
  }
  if (!app.current && app.playing && app.queue.length) startDay(app.queue.shift());
  if (!app.current && !app.queue.length && app.ended && app.summary && !app.endShown) {
    app.endShown = true;
    hud.showEnd(app.summary);
  }
  cameraRig.update(delta);
  setFocus(world, cameraRig.rig.look);
  hud.setPhase(applyDayCycle(world, app.dayProgress));
  animateMarket(market, world, time);
  cutawayRoofs(market, world.camera);
  pulseLowStock(world, time);
  animateKeepers(shopsView, time, app.dayProgress);
  animateAmbient(ambient, delta, time);
  animateTraffic(traffic, crowd, delta, time, world.quality);
  world.camera.updateMatrixWorld();
  updateCrowd(crowd, delta, time, world.camera, world.quality);
  world.renderer.render(world.scene, world.camera);
  placeLabels();
  updateSound(sound, { busy: ambient.activeWalkers / MAX_WALKERS.high, time, camera: world.camera, crowd, traffic });
  countFps();
  requestAnimationFrame(tick);
}

function closeStream() {
  /** Stop receiving days from the server. */
  if (app.source) app.source.close();
  app.source = null;
}

function connect(fromDay) {
  /** Open the day stream from a given day at the current seed, market and speed. */
  closeStream();
  const url = `/api/stream?seed=${app.seed}&market=${app.market}&speed=${app.speed}&from_day=${fromDay}`;
  const source = new EventSource(url);
  app.source = source;
  source.addEventListener("init", (event) => {
    const frame = JSON.parse(event.data);
    const meta = productCaps();
    frame.shops.forEach((shopFrame, index) => settleShop(shopsView, shopsView.shops[index], shopFrame, meta));
    hud.showOpening(frame);
  });
  source.onmessage = (event) => {
    const frame = JSON.parse(event.data);
    app.lastReceivedDay = frame.day;
    app.queue.push(frame);
    hud.setStatus("");
  };
  source.addEventListener("end", (event) => {
    app.summary = JSON.parse(event.data);
    app.ended = true;
    closeStream();
  });
  source.onerror = () => {
    if (app.ended || app.source !== source) return;
    hud.setStatus("Lost the connection to play.py. Is it still running?");
    closeStream();
  };
}

function restart() {
  /** Start the episode again from day 1 with the seed and market in the top bar. */
  closeStream();
  app.seed = Number(document.getElementById("seed-input").value) || app.meta.seed;
  app.market = document.getElementById("market-select").value;
  Object.assign(app, { queue: [], lastReceivedDay: 0, ended: false, summary: null, endShown: false, current: null,
    dayElapsed: 0, dayProgress: 0.2 });
  for (const shop of shopsView.shops) finishShopDay(shopsView, shop, productCaps());
  hud.resetHud();
  setPlaying(true);
  connect(1);
}

function setPlaying(playing) {
  /** Pause or resume: pausing freezes the day and stops the stream, resuming picks up the next day. */
  app.playing = playing;
  document.getElementById("play-btn").textContent = playing ? "Pause" : "Play";
  if (!playing) closeStream();
  else if (!app.ended && !app.source && app.meta) connect(app.lastReceivedDay + 1);
}

function setSpeed(speed) {
  /** Change the playback speed and ask the server to pace the next days to match. */
  app.speed = speed;
  for (const button of document.querySelectorAll("#speed-group button")) {
    button.classList.toggle("active", Number(button.dataset.speed) === speed);
  }
  if (app.playing && !app.ended && app.source) connect(app.lastReceivedDay + 1);
}

function leaderIndex() {
  /** Return the index of the shop with the highest net worth right now. */
  const leader = app.latest ? app.latest.leaderboard[0].id : app.meta.shops[0].id;
  return app.meta.shops.findIndex((shop) => shop.id === leader);
}

function onModeChange(mode, shopIndex = null, preset = null) {
  /** Reflect the camera mode and any view preset in the top bar, the shop panel and the walk hint. */
  for (const button of document.querySelectorAll("[data-mode]")) button.classList.toggle("active", button.dataset.mode === mode && !preset);
  for (const button of document.querySelectorAll("[data-preset]")) button.classList.toggle("active", button.dataset.preset === preset);
  hud.openShopPanel(mode === "shop" ? shopIndex : null);
  document.getElementById("walk-hint").hidden = mode !== "walk";
}

function togglePhoto() {
  /** Hide or show every HUD element for clean screenshots and recordings. */
  document.body.classList.toggle("photo");
}

function toggleSound() {
  /** Switch the ambient market sound on or off. */
  const on = setSound(sound, !sound.on);
  document.getElementById("sound-btn").textContent = on ? "Sound: On" : "Sound: Off";
}

function handleKey(event) {
  /** Handle the keyboard shortcuts, ignoring keys typed into the top bar fields. */
  if (["INPUT", "SELECT"].includes(event.target.tagName)) return;
  const mode = cameraRig.rig.mode;
  if (event.code === "Space") {
    event.preventDefault();
    setPlaying(!app.playing);
  } else if (/^Digit[1-5]$/.test(event.code)) {
    cameraRig.enterShop(Number(event.code.slice(5)) - 1);
  } else if (PRESET_KEYS[event.code]) {
    cameraRig.goPreset(PRESET_KEYS[event.code]);
  } else if (event.code === "Escape") {
    if (mode === "shop" || mode === "tour") cameraRig.leaveShop();
    document.getElementById("help-card").hidden = true;
  } else if (event.code === "KeyH") {
    togglePhoto();
  } else if (event.code === "KeyO") {
    cameraRig.setMode("overview");
  } else if (event.code === "KeyF") {
    cameraRig.setMode("walk");
  } else if (event.code === "KeyT") {
    cameraRig.setMode("tour");
  } else if (event.code === "KeyQ") {
    applyQuality(world.quality === "high" ? "low" : "high");
  } else if (event.code === "KeyM") {
    toggleSound();
  } else if (event.key === "?") {
    toggleHelp();
  }
}

function toggleHelp() {
  /** Show or hide the key list. */
  const card = document.getElementById("help-card");
  card.hidden = !card.hidden;
}

function bindControls() {
  /** Wire up the top bar, the camera buttons and the keyboard. */
  document.getElementById("play-btn").addEventListener("click", () => setPlaying(!app.playing));
  for (const button of document.querySelectorAll("#speed-group button")) {
    button.addEventListener("click", () => setSpeed(Number(button.dataset.speed)));
  }
  document.getElementById("restart-btn").addEventListener("click", restart);
  document.getElementById("end-restart").addEventListener("click", restart);
  document.getElementById("market-select").addEventListener("change", restart);
  document.getElementById("seed-input").addEventListener("keydown", (event) => event.key === "Enter" && restart());
  for (const button of document.querySelectorAll("[data-mode]")) {
    button.addEventListener("click", () => cameraRig.setMode(button.dataset.mode));
  }
  for (const button of document.querySelectorAll("[data-preset]")) {
    button.addEventListener("click", () => cameraRig.goPreset(button.dataset.preset));
  }
  document.getElementById("quality-btn").addEventListener("click", () => applyQuality(world.quality === "high" ? "low" : "high"));
  document.getElementById("sound-btn").addEventListener("click", toggleSound);
  document.getElementById("help-btn").addEventListener("click", toggleHelp);
  document.getElementById("help-close").addEventListener("click", toggleHelp);
  document.getElementById("panel-close").addEventListener("click", () => cameraRig.leaveShop());
  window.addEventListener("keydown", handleKey);
  window.addEventListener("resize", () => {
    resizeWorld(world, container);
    hud.drawChart();
  });
}

function buildScene() {
  /** Build the market, the five shops, the crowd, the ambient life and the camera rig. */
  crowd = createCrowd(world, CROWD_CAPACITY);
  market = buildMarket(world);
  shopsView = buildShops(world, app.meta.shops, labels, market, crowd);
  ambient = buildAmbient(world, market, crowd);
  traffic = buildTraffic(world, crowd);
  market.finished = market.finish();
  cameraRig = createCameraRig(world, world.renderer.domElement, shopsView.shops, {
    hitBoxes: shopsView.hitBoxes,
    leaderIndex,
    onModeChange,
    onWalkLock: (locked) => {
      document.getElementById("walk-hint").hidden = locked || cameraRig.rig.mode !== "walk";
    },
  });
}

async function start() {
  /** Load the metadata, build the market, apply the URL options and start the first episode. */
  app.meta = await (await fetch("/api/meta")).json();
  const params = new URLSearchParams(window.location.search);
  app.seed = Number(params.get("seed")) || app.meta.seed;
  app.market = app.meta.markets.includes(params.get("market")) ? params.get("market") : app.meta.market;
  document.getElementById("seed-input").value = app.seed;
  document.getElementById("market-select").value = app.market;
  document.getElementById("day-total").textContent = app.meta.episode_days;
  buildScene();
  hud.initHud(app.meta, { onShopClick: (index) => cameraRig.enterShop(index) });
  bindControls();
  resizeWorld(world, container);
  applyQuality(params.get("quality") === "low" ? "low" : params.get("quality") === "high" ? "high" : readQuality());
  const speed = Number(params.get("speed"));
  setSpeed(SPEEDS.includes(speed) ? speed : speed > 0 ? speed : 1);
  restart();
  if (params.get("camera") && ["walk", "tour"].includes(params.get("camera"))) cameraRig.setMode(params.get("camera"));
  if (params.get("view")) cameraRig.goPreset(params.get("view"));
  window.kimironko = { app, world, rig: () => cameraRig, shops: () => shopsView, crowd: () => crowd, traffic: () => traffic, sound: () => sound };
  requestAnimationFrame(tick);
}

start().catch((error) => hud.setStatus(`Could not start: ${error.message}`));
