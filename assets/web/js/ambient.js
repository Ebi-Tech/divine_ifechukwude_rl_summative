import * as THREE from "three";
import { LAYOUT, seeded } from "./layout.js";
import { addPerson, agentLook, porterLook, randomLook, riderLook } from "./people.js";

export const MAX_WALKERS = { high: 200, low: 75 };
const WALKERS_PER_CUSTOMER = 1.1;
const MIN_WALKERS = 40;
const BIRDS = 16;
const L = LAYOUT;

const MAIN_GATE_ROUTE = { spread: 0.85, points: [[-46.5, 0.75], [-30.5, 0.9], [-24, 1.7], [10, 1.7]] };
const FACADE_ROUTE = { spread: 0.8, points: [[50, -30], [50, -18.2], [50, -14.3], [48.5, -14.3], [48.5, 0.75], [40, 0.75], [21, 1.7], [10, 1.7]] };

const ROUTES = [
  { spread: 0.85, points: [[-29, 14.0], [-12.4, 14.0], [-12.4, 1.7], [21, 1.7], [40, 0.75], [48.5, 0.75], [48.5, -6.6], [24, -6.6]] },
  { spread: 0.8, points: [[-46, 0.75], [-31, 0.9], [-12.4, 1.6], [-12.4, 14.0], [5.95, 13.9], [5.95, 1.7], [-29, 1.7]] },
  { spread: 0.65, points: [[-44, -2], [-31, 0.9], [-12.4, 1.6], [-12.4, 13.9], [21, 13.9], [40, 14.5], [35.5, 14.5], [35.5, -14.3], [61, -14.3]] },
  { spread: 0.5, points: [[-12.4, 13.9], [-12.4, 1.8], [18, 1.8], [35.5, 1.2], [35.5, 8.1], [61, 8.1]] },
  { spread: 0.8, points: [[-46.8, -26], [-46.8, 38]] },
  { spread: 0.6, points: [[-60, 9.25], [-47, 9.25], [-41, 10.25]] },
  { spread: 0.9, points: [[-59.5, -26.5], [-59.5, 39.5]] },
  { spread: 0.4, points: [[23, -14.3], [61.3, -14.3], [61.3, -6.6], [23, -6.6]] },
  { spread: 0.75, points: [[-29, 1.7], [-12.4, 1.7], [-12.4, 13.9], [-29, 13.9]] },
  { spread: 0.9, points: [[22, 0.75], [61, 0.75], [48.5, 0.75], [48.5, 14.5], [24, 14.5]] },
  MAIN_GATE_ROUTE,
  MAIN_GATE_ROUTE,
  MAIN_GATE_ROUTE,
  FACADE_ROUTE,
  { spread: 0.7, points: [[-28, -20.4], [64, -20.4]] },
  { spread: 0.12, points: [[-34, 3.25], [-31.3, 5.95], [-31.3, 9.25], [-35, 9.25], [-45, 9.25]] },
  { spread: 0.3, look: "porter", points: [[-33.2, 3.75], [-40.5, 3.75], [-44, -4.75]] },
  { spread: 0.5, points: [[-28, 38.6], [64, 38.6]] },
  { spread: 0.2, points: [[-33, -39.25], [66, -39.25]] },
  { spread: 0.6, points: [[28, 38.6], [28, 31], [28, 27], [35.5, 22.6], [35.5, 0.75], [40, 0.75]] },
  { spread: 0.4, points: [[44, 67.5], [58, 67.5], [64, 63.5], [58, 57.5], [44, 57.5]] },
  MAIN_GATE_ROUTE,
  { spread: 0.3, look: "porter", points: [[-34.2, 4.85], [-41, 5.25], [-46.5, 11.25]] },
  { spread: 0.3, points: [[-31.5, -7.75], [-39.4, -7.75], [-39.4, 5.75], [-34.6, 4.75]] },
  { spread: 0.4, points: [[-16, -20.4], [-2, -20.4], [-2, -24.4], [-14, -24.4]] },
  { spread: 0.3, points: [[67.6, -7], [70.6, -2.6], [70.6, 3.6], [67.6, 7.6]] },
  { spread: 0.35, points: [[58, 65.5], [64, 58.1], [70.8, 58.1], [70.8, 39], [66, 34.8], [31, 34.2], [28, 31], [28, 27], [35.5, 22.6], [35.5, 8.1], [24, 8.1]] },
  { spread: 0.35, points: [[35.5, 14.5], [35.5, 22.6], [28, 27], [28, 31], [31, 34.2], [66, 34.8], [70.8, 39], [70.8, 58.1], [64, 58.1], [60, 66.5]] },
  FACADE_ROUTE,
];

function makeRoute(definition) {
  /** Turn a list of ground points into a route with cumulative lengths for walking along it. */
  const points = definition.points.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) lengths.push(lengths[i - 1] + points[i].distanceTo(points[i - 1]));
  return { points, lengths, total: lengths[lengths.length - 1], spread: definition.spread, look: definition.look };
}

function routePoint(route, distance, out, direction) {
  /** Write the point at a distance along a route into out, and the walking direction into direction. */
  const d = THREE.MathUtils.clamp(distance, 0, route.total);
  let i = 1;
  while (i < route.lengths.length - 1 && route.lengths[i] < d) i += 1;
  const a = route.points[i - 1];
  const b = route.points[i];
  const t = (d - route.lengths[i - 1]) / Math.max(route.lengths[i] - route.lengths[i - 1], 1e-6);
  out.lerpVectors(a, b, t);
  direction.subVectors(b, a).normalize();
}

function groundHeight(x, z) {
  /** Return the walking surface height: the raised hall floor, the curb and the lanes. */
  if (x > L.hall.xMin && x < L.hall.xMax && z > L.hall.zMin && z < L.hall.zMax) return 0.1;
  if (z < L.block.north - 0.3 && z > L.block.north - 3.7 && x > L.block.west && x < L.block.east) return 0.08;
  if (x < -56.5 && x > -62.5 && z > L.roads.north + 3.5 && z < L.roads.south - 3.5) return 0.18;
  return 0.04;
}

function buildWalkers(crowd, ambient) {
  /** Create the walking shoppers, each on a route with its own pace, side of the lane and habits. */
  const routes = ROUTES.map(makeRoute);
  for (let i = 0; i < MAX_WALKERS.high; i += 1) {
    let k = 0;
    const rand = () => seeded(i * 53 + k++, 21);
    const kind = rand() < 0.06 ? "child" : undefined;
    const route = routes[i % routes.length];
    const person = addPerson(crowd, route.look === "porter" ? porterLook(rand) : randomLook(rand, kind));
    if (!route.look && i % 7 === 3) person.look.carry = "basket";
    if (!route.look && i % 11 === 5) Object.assign(person.look, { carry: "jerrycan", carryColor: 0x6a4428 });
    ambient.walkers.push({ person, route, distance: rand() * route.total, direction: rand() < 0.5 ? 1 : -1,
      offset: (rand() * 2 - 1) * route.spread, pace: (kind ? 0.9 : 1.05) + rand() * 0.45, pause: 0, browse: 0.025 + rand() * 0.04,
      chat: rand() < 0.3 });
  }
}

function buildVendors(crowd, market, ambient) {
  /** Put a vendor in every neighbour stall and hall table, sitting, sewing, talking or arranging goods. */
  market.vendors.forEach((spot, i) => {
    let k = 0;
    const rand = () => seeded(i * 71 + k++, 33);
    const look = randomLook(rand, rand() < 0.62 ? "woman" : "man");
    if (["basket", "sack", "bag", "jerrycan"].includes(look.carry)) look.carry = "none";
    const looks = { rider: riderLook, porter: porterLook, agent: agentLook };
    const person = addPerson(crowd, looks[spot.look] ? looks[spot.look](rand) : look);
    const sitting = ["sit", "sew", "sitTalk", "groundSit"].includes(spot.mode);
    Object.assign(person, { x: spot.position.x, y: spot.position.y, z: spot.position.z, yaw: spot.yaw, mode: spot.mode,
      seat: spot.seat || 0.43 });
    if (!sitting) person.y = Math.max(spot.position.y, 0.04);
    ambient.vendors.push({ person, base: spot.position.clone(), baseYaw: spot.yaw, mode: spot.mode });
  });
  market.riders.forEach((spot, i) => {
    let k = 0;
    const person = addPerson(crowd, riderLook(() => seeded(i * 17 + k++, 44)));
    Object.assign(person, { x: spot.position.x, y: 0, z: spot.position.z, yaw: spot.yaw, mode: i % 2 ? "ride" : "sitTalk", seat: 0.78 });
    ambient.vendors.push({ person, base: spot.position.clone(), baseYaw: spot.yaw, mode: person.mode });
  });
}

function buildBirds(world, ambient) {
  /** Create pied crows and kites that circle and flap high over the market. */
  const body = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.22, 0).scale(0.7, 0.6, 2.0), new THREE.MeshLambertMaterial(), BIRDS);
  const wingShape = new THREE.BufferGeometry();
  wingShape.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.18, 0.95, 0, -0.05, 0, 0, -0.22], 3));
  wingShape.computeVertexNormals();
  const wings = new THREE.InstancedMesh(wingShape, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), BIRDS * 2);
  const tint = new THREE.Color();
  for (let i = 0; i < BIRDS; i += 1) {
    const kite = i % 3 === 0;
    body.setColorAt(i, tint.setHex(kite ? 0x6a4a30 : 0x1a1a1a));
    wings.setColorAt(i * 2, tint.setHex(kite ? 0x5a3e28 : 0x161616));
    wings.setColorAt(i * 2 + 1, tint);
    ambient.birds.push({ kite, center: new THREE.Vector3(-20 + seeded(i, 1) * 70, 16 + seeded(i, 2) * 18, -25 + seeded(i, 3) * 50),
      radius: 8 + seeded(i, 4) * 22, speed: (kite ? 0.18 : 0.32) * (seeded(i, 5) < 0.5 ? 1 : -1), phase: seeded(i, 6) * 6.28 });
  }
  for (const mesh of [body, wings]) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    world.scene.add(mesh);
  }
  ambient.birdMeshes = { body, wings };
}

export function buildAmbient(world, market, crowd) {
  /** Build the decoration-only life of the market: walkers, vendors, riders, traffic and birds. */
  const ambient = { walkers: [], vendors: [], birds: [], activeWalkers: 60, crowd };
  buildVendors(crowd, market, ambient);
  buildWalkers(crowd, ambient);
  buildBirds(world, ambient);
  return ambient;
}

export function setCrowdFromCustomers(ambient, totalCustomers, quality) {
  /** Scale the number of people walking the lanes with the day's real total customers; low quality caps it lower. */
  const wanted = Math.round(totalCustomers * WALKERS_PER_CUSTOMER);
  ambient.activeWalkers = THREE.MathUtils.clamp(wanted, MIN_WALKERS, MAX_WALKERS[quality] || MAX_WALKERS.high);
}

const point = new THREE.Vector3();
const heading = new THREE.Vector3();

function animateWalkers(ambient, delta, time) {
  /** Walk each active shopper along their route, pausing now and then to browse a stall or greet someone. */
  ambient.walkers.forEach((walker, index) => {
    const person = walker.person;
    person.active = index < ambient.activeWalkers;
    if (!person.active) return;
    if (walker.pause > 0) {
      walker.pause -= delta;
      person.mode = walker.chat ? "talk" : "idle";
      return;
    }
    walker.distance += walker.direction * walker.pace * delta;
    if (walker.distance <= 0 || walker.distance >= walker.route.total) {
      walker.direction *= -1;
      walker.distance = THREE.MathUtils.clamp(walker.distance, 0, walker.route.total);
      walker.pause = 1 + seeded(index, time | 0) * 2;
    } else if (Math.random() < walker.browse * delta) {
      walker.pause = 2 + Math.random() * 5;
      person.yaw += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
      return;
    }
    routePoint(walker.route, walker.distance, point, heading);
    heading.multiplyScalar(walker.direction);
    person.x = point.x - heading.z * walker.offset * walker.direction;
    person.z = point.z + heading.x * walker.offset * walker.direction;
    person.y = groundHeight(person.x, person.z);
    person.yaw = Math.atan2(heading.x, heading.z);
    person.mode = "idle";
  });
}

function animateVendors(ambient, time) {
  /** Keep vendors busy: standing ones shift about and turn to passers-by, seated ones sew or chat. */
  ambient.vendors.forEach((vendor, index) => {
    const person = vendor.person;
    if (["talk", "arrange"].includes(vendor.mode)) {
      const cycle = (time * 0.07 + index * 0.37) % 1;
      person.mode = cycle < 0.45 ? vendor.mode : cycle < 0.7 ? "idle" : "talk";
      person.yaw = vendor.baseYaw + Math.sin(time * 0.25 + index) * 0.6;
      person.x = vendor.base.x + Math.sin(time * 0.15 + index) * 0.25;
    } else if (vendor.mode === "sitTalk" || vendor.mode === "ride") {
      person.mode = (time * 0.05 + index * 0.31) % 1 < 0.5 ? "sitTalk" : "ride";
    }
  });
}

const birdHolder = new THREE.Object3D();
const wingHolder = new THREE.Object3D();

function animateBirds(ambient, time) {
  /** Circle the birds overhead, crows flapping quickly and kites gliding with slow beats. */
  const { body, wings } = ambient.birdMeshes;
  ambient.birds.forEach((bird, i) => {
    const angle = bird.phase + time * bird.speed;
    birdHolder.position.set(bird.center.x + Math.cos(angle) * bird.radius, bird.center.y + Math.sin(time * 0.3 + i) * 1.5,
      bird.center.z + Math.sin(angle) * bird.radius);
    birdHolder.rotation.set(0, -angle + (bird.speed > 0 ? Math.PI : 0), (bird.speed > 0 ? -1 : 1) * 0.25);
    birdHolder.scale.setScalar(bird.kite ? 1.5 : 1);
    birdHolder.updateMatrix();
    body.setMatrixAt(i, birdHolder.matrix);
    const flap = bird.kite ? Math.sin(time * 2.5 + i) * 0.25 : Math.sin(time * 9 + i) * 0.7;
    for (const side of [0, 1]) {
      wingHolder.position.set(0, 0, 0);
      wingHolder.rotation.set(0, side ? Math.PI : 0, side ? -flap : flap);
      wingHolder.scale.set(1, 1, side ? -1 : 1);
      wingHolder.updateMatrix();
      wingHolder.matrix.premultiply(birdHolder.matrix);
      wings.setMatrixAt(i * 2 + side, wingHolder.matrix);
    }
  });
  body.instanceMatrix.needsUpdate = true;
  wings.instanceMatrix.needsUpdate = true;
}

export function animateAmbient(ambient, delta, time) {
  /** Advance all decorative motion for this frame. */
  animateWalkers(ambient, delta, time);
  animateVendors(ambient, time);
  animateBirds(ambient, time);
}
