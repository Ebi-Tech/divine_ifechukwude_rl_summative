import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { PointerLockControls } from "three/addons/PointerLockControls.js";
import { LAYOUT, pushOutOfColliders } from "./layout.js";

const OVERVIEW = { position: new THREE.Vector3(-25, 6.8, 4.6), target: new THREE.Vector3(2, 1.3, -2.2) };
const WALK_START = { position: new THREE.Vector3(-41, 1.6, 0.75), look: new THREE.Vector3(-30, 1.8, 0.75) };
const EYE_HEIGHT = 1.62;
const MIN_CAMERA_HEIGHT = 1.2;
const WALK_SPEED = 3.2;
const RUN_FACTOR = 2.2;
const WALK_RADIUS = 0.35;
const FLIGHT_SECONDS = 1.8;
const PRESET_SECONDS = 2.6;
const TOUR_HOLD = 6;
const TOUR_RETURN = 3.5;
export const PRESETS = {
  main: { label: "Main gate", position: [-53, 7, 16.25], look: [-34, 1.0, 2.75] },
  side: { label: "Side entrance", position: [63, 2.8, -36.5], look: [50, 3.4, -18.2] },
  back: { label: "South gate", position: [21, 3.2, 38.8], look: [28.5, 2.2, 30] },
  roadside: { label: "Roadside shops", position: [-12, 2.8, -28.6], look: [4, 1.9, -38.5] },
  five: { label: "Our five shops", position: [16.5, 2.5, 1.3], look: [-3, 1.6, -2.3] },
};
const APPROACH_KEYS = [
  [0, [-56, 8.5, -10.75], [-34.5, 1.2, 6.75]],
  [7, [-46, 2.6, -3.75], [-34, 1.6, 4.25]],
  [13, [-38, 2.0, 0.75], [-26, 2.0, 1.0]],
  [20, [-29, 2.2, 1.0], [-18, 2.0, 1.2]],
  [28, [-19, 2.6, 1.3], [-8, 2.2, 1.0]],
  [36, [-6, 3.0, 2.0], [6, 2.0, -1.2]],
];
const CIRCUIT_KEYS = [
  [5, null, [-12, 3, 8]],
  [12, [-12.4, 4, 8], [10, 3, 1.7]],
  [19, [30, 5, 1.2], [48.5, 3, -14]],
  [25, [48.5, 4.5, -11], [50, 3, -24]],
  [31, [50, 4, -23], [50, 3, -32]],
  [38, [40, 5, -37], [50, 4, -18.2]],
  [45, [24, 5, -28], [8, 2.2, -39]],
  [52, [72, 8, -30], [68, 2, -6]],
  [59, [80, 5, 8], [67, 1.5, 3]],
  [67, [84, 10, 43], [64, 2, 53.5]],
  [75, [55, 14, 57.5], [30, 2, 63.5]],
  [83, [35, 5, 38.6], [28, 2.4, 30]],
  [91, [0, 5, 37.5], [-20, 2, 32]],
  [97, [-44, 6, 40], [-36, 2, 30]],
  [103, [-56, 8.5, -10.75], [-34.5, 1.2, 6.75]],
];

export function easeInOut(t) {
  /** Smooth sine easing from 0 to 1. */
  return 0.5 - 0.5 * Math.cos(Math.PI * THREE.MathUtils.clamp(t, 0, 1));
}

function easeFlight(t) {
  /** Cubic ease-in-out for camera flights. */
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function groundUnder(position) {
  /** Return the floor height under the walker: the hall floor is raised a little. */
  const { hall } = LAYOUT;
  return position.x > hall.xMin && position.x < hall.xMax && position.z > hall.zMin && position.z < hall.zMax ? 0.1 : 0.04;
}

function curves(keys) {
  /** Turn [time, position, look] keyframes into a timed pair of smooth camera curves. */
  const vector = (values) => new THREE.Vector3(...values);
  return {
    times: keys.map(([time]) => time), duration: keys[keys.length - 1][0] - keys[0][0],
    positions: new THREE.CatmullRomCurve3(keys.map(([, position]) => vector(position)), false, "centripetal"),
    looks: new THREE.CatmullRomCurve3(keys.map(([, , look]) => vector(look)), false, "centripetal"),
  };
}

function legParameter(leg, time) {
  /** Map time within a tour leg onto its curves, so each stretch takes the time its keyframes give it, eased at both ends. */
  const t = THREE.MathUtils.clamp(time / leg.duration, 0, 1);
  const eased = leg.times[0] + leg.duration * (0.2 * easeInOut(t) + 0.8 * t);
  const { times } = leg;
  let i = 1;
  while (i < times.length - 1 && times[i] < eased) i += 1;
  const local = THREE.MathUtils.clamp((eased - times[i - 1]) / (times[i] - times[i - 1]), 0, 1);
  return (i - 1 + local) / (times.length - 1);
}

export function createCameraRig(world, dom, shops, hooks) {
  /** Create the camera rig with overview, presets, walk, shop and tour modes, and return its controller. */
  const camera = world.camera;
  const orbit = new OrbitControls(camera, dom);
  orbit.enableDamping = true;
  orbit.maxPolarAngle = 1.5;
  orbit.minDistance = 2.5;
  orbit.maxDistance = 170;
  const walk = new PointerLockControls(camera, dom);
  const rig = {
    mode: "overview", orbit, walk, look: OVERVIEW.target.clone(), flight: null, tour: null, shopIndex: null,
    keys: new Set(), raycaster: new THREE.Raycaster(), pointer: new THREE.Vector2(),
  };
  camera.position.copy(OVERVIEW.position);
  orbit.target.copy(OVERVIEW.target);

  function flyTo(position, look, then, seconds = FLIGHT_SECONDS) {
    /** Fly the camera smoothly from where it is to a position and look target, then run a callback. */
    orbit.enabled = false;
    rig.flight = { fromPosition: camera.position.clone(), fromLook: rig.look.clone(), position: position.clone(),
      look: look.clone(), time: 0, seconds, then };
  }

  function orbitFrom(look) {
    /** Hand the camera to the orbit controls around a look target. */
    orbit.target.copy(look);
    orbit.enabled = true;
  }

  function setMode(mode) {
    /** Switch camera mode, flying between views where it helps. */
    if (rig.walk.isLocked) rig.walk.unlock();
    rig.tour = null;
    rig.mode = mode;
    rig.shopIndex = null;
    hooks.onModeChange(mode);
    if (mode === "overview") flyTo(OVERVIEW.position, OVERVIEW.target, () => orbitFrom(OVERVIEW.target));
    if (mode === "walk") flyTo(WALK_START.position, WALK_START.look, () => camera.lookAt(WALK_START.look));
    if (mode === "tour") startTour(true);
  }

  function goPreset(name) {
    /** Fly to one of the street-level views of the block, then let the user orbit from there. */
    const preset = PRESETS[name];
    if (!preset) return;
    if (rig.walk.isLocked) rig.walk.unlock();
    rig.tour = null;
    rig.mode = "overview";
    rig.shopIndex = null;
    hooks.onModeChange("overview", null, name);
    const look = new THREE.Vector3(...preset.look);
    flyTo(new THREE.Vector3(...preset.position), look, () => orbitFrom(look), PRESET_SECONDS);
  }

  function enterShop(index) {
    /** Fly inside a shop, where its chalkboard shows today's decision. */
    if (rig.walk.isLocked) rig.walk.unlock();
    rig.tour = null;
    rig.mode = "shop";
    rig.shopIndex = index;
    hooks.onModeChange("shop", index);
    flyTo(shops[index].anchors.inside, shops[index].anchors.look);
  }

  function leaveShop() {
    /** Fly back out of a shop to the overview. */
    setMode("overview");
  }

  function startTour(fromHere) {
    /** Start a tour loop: in through the main gate to the leading shop, then out and round the block. */
    orbit.enabled = false;
    const leader = hooks.leaderIndex();
    const shop = shops[leader];
    const inside = shop.anchors.inside.toArray();
    const look = shop.anchors.look.toArray();
    const approach = curves(APPROACH_KEYS.concat([[45, [shop.x0 + 3.2, 2.3, 2.2], [shop.x0, 1.9, -3]], [50, inside, look]]));
    const circuit = curves([[0, inside, look], ...CIRCUIT_KEYS.map(([time, position, target]) =>
      [time, position || [shop.x0, 2.6, 2.4], target])]);
    rig.tour = { time: 0, phase: "approach", leader, approach, circuit };
    if (fromHere) flyTo(approach.positions.getPoint(0), approach.looks.getPoint(0), null, TOUR_RETURN);
  }

  function updateTour(delta) {
    /** Move the camera along the current tour leg, hold in the leader's shop, and loop round the block. */
    const tour = rig.tour;
    tour.time += delta;
    if (tour.phase === "hold") {
      if (tour.time > TOUR_HOLD) Object.assign(tour, { phase: "circuit", time: 0 });
      return;
    }
    const leg = tour[tour.phase];
    const u = legParameter(leg, tour.time);
    camera.position.copy(leg.positions.getPoint(u));
    rig.look.copy(leg.looks.getPoint(u));
    camera.lookAt(rig.look);
    if (tour.time >= leg.duration) {
      if (tour.phase === "approach") Object.assign(tour, { phase: "hold", time: 0 });
      else startTour(false);
    }
  }

  function updateFlight(delta) {
    /** Advance a camera flight and finish it at the destination. */
    const flight = rig.flight;
    flight.time += delta / flight.seconds;
    const t = easeFlight(flight.time);
    camera.position.lerpVectors(flight.fromPosition, flight.position, t);
    rig.look.lerpVectors(flight.fromLook, flight.look, t);
    camera.lookAt(rig.look);
    if (flight.time >= 1) {
      rig.flight = null;
      if (flight.then) flight.then();
    }
  }

  function updateWalk(delta) {
    /** Move the walker with WASD; walls, fences, buildings and stalls block, open gates let you through. */
    if (!rig.walk.isLocked) return;
    const speed = WALK_SPEED * (rig.keys.has("ShiftLeft") || rig.keys.has("ShiftRight") ? RUN_FACTOR : 1) * delta;
    const forward = (rig.keys.has("KeyW") || rig.keys.has("ArrowUp") ? 1 : 0) - (rig.keys.has("KeyS") || rig.keys.has("ArrowDown") ? 1 : 0);
    const right = (rig.keys.has("KeyD") || rig.keys.has("ArrowRight") ? 1 : 0) - (rig.keys.has("KeyA") || rig.keys.has("ArrowLeft") ? 1 : 0);
    rig.walk.moveForward(forward * speed);
    rig.walk.moveRight(right * speed);
    const position = camera.position;
    const bounds = LAYOUT.walk;
    position.x = THREE.MathUtils.clamp(position.x, bounds.xMin, bounds.xMax);
    position.z = THREE.MathUtils.clamp(position.z, bounds.zMin, bounds.zMax);
    pushOutOfColliders(position, WALK_RADIUS);
    position.y = groundUnder(position) + EYE_HEIGHT;
    rig.look.copy(position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(8));
  }

  function pick(event) {
    /** Return the index of the shop under the pointer, or null. */
    const rect = dom.getBoundingClientRect();
    rig.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    rig.raycaster.setFromCamera(rig.pointer, camera);
    const hit = rig.raycaster.intersectObjects(hooks.hitBoxes, false)[0];
    return hit ? hit.object.userData.shopIndex : null;
  }

  let downAt = null;
  dom.addEventListener("pointerdown", (event) => { downAt = [event.clientX, event.clientY]; });
  dom.addEventListener("click", (event) => {
    const dragged = downAt && Math.hypot(event.clientX - downAt[0], event.clientY - downAt[1]) > 5;
    if (rig.mode === "walk") {
      if (!rig.walk.isLocked && !rig.flight) rig.walk.lock();
      return;
    }
    if (!dragged && (rig.mode === "overview" || rig.mode === "tour")) {
      const index = pick(event);
      if (index !== null) enterShop(index);
    }
  });
  walk.addEventListener("lock", () => hooks.onWalkLock(true));
  walk.addEventListener("unlock", () => hooks.onWalkLock(false));
  window.addEventListener("keydown", (event) => rig.keys.add(event.code));
  window.addEventListener("keyup", (event) => rig.keys.delete(event.code));
  window.addEventListener("blur", () => rig.keys.clear());

  function update(delta) {
    /** Advance the active camera mode by one frame, keeping the orbiting camera above the ground. */
    if (rig.flight) updateFlight(delta);
    else if (rig.mode === "tour" && rig.tour) updateTour(delta);
    else if (rig.mode === "walk") updateWalk(delta);
    else if (rig.mode === "overview") {
      orbit.update();
      camera.position.y = Math.max(camera.position.y, MIN_CAMERA_HEIGHT);
      rig.look.copy(orbit.target);
    }
  }

  return { rig, update, setMode, goPreset, enterShop, leaveShop };
}
