import * as THREE from "three";
import { LAYOUT, makeRoute, routePoint, seeded } from "./layout.js";
import { addPerson, policeLook, randomLook, riderLook } from "./people.js";
import { bakeGroup, carGroup, motoGroup } from "./market.js";
import { CYCLING_PARKING } from "./perimeter.js";

const R = LAYOUT.roads;
const LANE = 1.8;
const ROAD_SIDE = 3.2;
const CORNER = 7;
const FAR_SOUTH = 160;
const CAPS = {
  high: { loop: 18, parking: 4, buses: 2, dirt: 3, gate: { main: 3, side: 2, south: 6 } },
  low: { loop: 6, parking: 2, buses: 1, dirt: 1, gate: { main: 1, side: 1, south: 2 } },
};
const LOOK_AHEAD = 9;
const SAFE_GAP = 2.2;
const SIDE_MARGIN = 0.35;
const ACCEL = 2.0;
const BRAKE = 6;
const STUCK_SECONDS = 5;
const CREEP_SECONDS = 2;
const LOOP_KINDS = ["car", "moto", "pickup", "sedan", "bus", "moto", "car", "pickup", "moto", "sedan", "bus", "moto", "car", "pickup",
  "moto", "car", "bus", "moto"];
const PAINTS = [0xc9ccd0, 0x22262b, 0x8a1a1a, 0xf3f1ea, 0x2f4a6a, 0x6a6a6a, 0xb8bcc0, 0x3d5a3a, 0xd9d2c2];
const MOTO_PAINTS = [0xc1121f, 0x1d1d1d, 0x1d3557, 0x2a2a2a, 0x8a1a1a];
const HALF_LENGTH = { moto: 0.7, car: 1.9, sedan: 2.2, pickup: 2.45, bus: 2.7, coach: 5.5, truck: 3.25 };
const HALF_WIDTH = { moto: 0.35, car: 0.88, sedan: 0.88, pickup: 0.9, bus: 0.9, coach: 1.25, truck: 1.1 };
const SPEEDS = { moto: 7, car: 5.5, sedan: 5.5, pickup: 5, bus: 4.5, coach: 4, truck: 3.2 };
const DIRT_KINDS = ["truck", "car", "truck", "pickup", "sedan"];
const TRUCK_PAINTS = [0x2f5fbf, 0xc8352e, 0xf2c230];
const JUNCTION_PHASE = 13;
const STOP_BEFORE = 6;
const COACH_PAINTS = [0x2a6a4a, 0xc8352e];
const BUS = LAYOUT.busPark;
const BUS_IN = BUS.gateZ - 2.2;
const BUS_OUT = BUS.gateZ + 2.2;
const BUS_ROUTES = {
  arrive: [[R.east - LANE, -150], [R.east - LANE, BUS.gateZ - 9], [R.east - ROAD_SIDE, BUS_IN - 0.6], [BUS.x1 - 3, BUS_IN], [30, BUS_IN]],
  depart: [[30, BUS_IN], [16, BUS_IN], [12.5, BUS.gateZ], [16, BUS_OUT], [BUS.x1 - 3, BUS_OUT], [R.east - ROAD_SIDE, BUS_OUT],
    [R.east + LANE, BUS.gateZ - 5], [R.east + LANE, 30], [R.east + LANE, -150]],
};
const SHOP_LANE = R.north - LANE;
const FACADE_X = LAYOUT.facadeGate.x;
const SOUTH_X = LAYOUT.southGate.x;
const PARKED_Z = LAYOUT.block.roadsideFront + 2.6;
const LOW_PARKING = [[-4, -25, 0], [21, -25, 0], [31.5, -25, 0], [36.5, -25, Math.PI], [60, -25, Math.PI], [70.3, -15, -Math.PI / 2],
  [70.3, 17.5, Math.PI / 2], [-45.5, -24.5, 0]];
const GATES = {
  main: { door: [LAYOUT.block.west - 0.6, LAYOUT.mainGate.z], into: [[R.west + LANE, 75], [R.west + LANE, 8.25], [-45.5, 3.85], [-39.0, 1.45]],
    away: [[-39.0, 1.45], [-44.5, -2.55], [R.west + LANE, -8.75], [R.west + LANE, -95]] },
  side: { door: [FACADE_X, LAYOUT.block.north - 0.6], into: [[-40, R.north + LANE], [FACADE_X - 10.5, R.north + LANE], [FACADE_X - 4.5, -27.5], [FACADE_X - 0.5, -26.3]],
    away: [[FACADE_X - 0.5, -26.3], [FACADE_X + 4, -27.9], [FACADE_X + 10.5, R.north + LANE], [140, R.north + LANE]] },
  south: { door: [SOUTH_X, LAYOUT.block.south + 0.6], into: [[110, R.south - LANE], [SOUTH_X + 9, R.south - LANE], [SOUTH_X + 3, 33.0], [SOUTH_X + 0.5, 32.7]],
    away: [[SOUTH_X + 0.5, 32.7], [SOUTH_X - 3, 33.2], [SOUTH_X - 9, R.south - LANE], [-90, R.south - LANE]] },
};

const point = new THREE.Vector3();
const tangent = new THREE.Vector3();

function loopRoute() {
  /** Return the closed route of the through traffic: along the north road, and down the east and west roads well past the dirt road. */
  const { west, east, north } = R;
  const south = FAR_SOUTH;
  const corners = [[east - CORNER, north + CORNER, -Math.PI / 2], [east - CORNER, south - CORNER, 0], [west + CORNER, south - CORNER, Math.PI / 2],
    [west + CORNER, north + CORNER, Math.PI]];
  const points = [];
  for (const [cx, cz, start] of corners) {
    for (let step = 0; step <= 6; step += 1) {
      const angle = start + (step / 6) * (Math.PI / 2);
      points.push([cx + Math.cos(angle) * CORNER, cz + Math.sin(angle) * CORNER]);
    }
  }
  points.push(points[0]);
  return makeRoute(points);
}

function makeVehicle(world, kind, color) {
  /** Bake one plain vehicle into a single mesh and return its driving state. */
  const group = kind === "moto" ? motoGroup(world, color) : carGroup(world, color, kind === "car" ? "hatch" : kind);
  const mesh = bakeGroup(group);
  world.scene.add(mesh);
  return { mesh, kind, half: HALF_LENGTH[kind], width: HALF_WIDTH[kind], maxSpeed: SPEEDS[kind], speed: 0, s: 0, pause: 0,
    blocked: 0, creepUntil: 0, pos: new THREE.Vector3(), motion: new THREE.Vector3(1, 0, 0), nose: new THREE.Vector3(1, 0, 0),
    people: [], visible: true };
}

function mountRiders(crowd, vehicle, seed, withPassenger) {
  /** Put a rider in a reflective vest on a moto and sometimes a passenger behind. */
  let k = 0;
  const rider = addPerson(crowd, riderLook(() => seeded(seed * 7 + k++, 55)));
  Object.assign(rider, { mode: "ride", seat: 0.78, active: false });
  vehicle.people.push([rider, -0.2]);
  if (withPassenger) {
    const passenger = addPerson(crowd, randomLook(() => seeded(seed * 11 + k++, 66)));
    if (!["baby", "backpack"].includes(passenger.look.carry)) passenger.look.carry = "none";
    Object.assign(passenger, { mode: "ride", seat: 0.84, active: false });
    vehicle.passenger = passenger;
  }
  vehicle.carrying = withPassenger;
}

function buildLoop(world, crowd, traffic) {
  /** Create the two-way road traffic around the block: cars, pickups, minibuses and motos. */
  const counts = { 1: 0, "-1": 0 };
  LOOP_KINDS.forEach((kind, i) => {
    const vehicle = makeVehicle(world, kind, kind === "moto" ? MOTO_PAINTS[i % MOTO_PAINTS.length] : PAINTS[i % PAINTS.length]);
    vehicle.direction = i % 2 ? -1 : 1;
    const rank = counts[vehicle.direction]++;
    vehicle.s = (rank / Math.ceil(LOOP_KINDS.length / 2)) * traffic.loop.total + seeded(i, 4) * 8;
    vehicle.nextStop = 10 + seeded(i, 5) * 30;
    if (kind === "moto") mountRiders(crowd, vehicle, i + 40, seeded(i, 9) < 0.55);
    traffic.loopVehicles.push(vehicle);
  });
}

function buildParking(world, crowd, traffic) {
  /** Create the cars and pickups that pull in nose-first in front of the roadside shops, unload, reverse out and leave. */
  CYCLING_PARKING.forEach((x, i) => {
    const kind = i % 2 ? "pickup" : "car";
    const vehicle = makeVehicle(world, kind, PAINTS[(i * 3 + 1) % PAINTS.length]);
    vehicle.maxSpeed = 4.5;
    vehicle.spot = x;
    vehicle.routes = {
      arrive: makeRoute([[150, SHOP_LANE], [x + 8, SHOP_LANE], [x + 2.6, SHOP_LANE - 0.6], [x + 0.6, PARKED_Z + 2.2], [x, PARKED_Z]]),
      reverse: makeRoute([[x, PARKED_Z], [x, PARKED_Z + 2.0], [x + 2.4, SHOP_LANE]]),
      depart: makeRoute([[x + 2.4, SHOP_LANE], [x - 4, SHOP_LANE], [-90, SHOP_LANE]]),
    };
    vehicle.state = i % 2 ? "away" : "parked";
    vehicle.timer = 6 + i * 11;
    vehicle.unloader = addPerson(crowd, randomLook(() => seeded(i * 13 + 2, 77), "man"));
    vehicle.unloader.active = false;
    traffic.parking.push(vehicle);
  });
}

function buildGateMotos(world, crowd, traffic) {
  /** Create the moto taxis that keep arriving at each gate, drop off or pick up a passenger, and ride away. */
  let seed = 0;
  for (const [name, gate] of Object.entries(GATES)) {
    for (let i = 0; i < CAPS.high.gate[name]; i += 1) {
      seed += 1;
      const vehicle = makeVehicle(world, "moto", MOTO_PAINTS[seed % MOTO_PAINTS.length]);
      mountRiders(crowd, vehicle, seed + 90, true);
      vehicle.gate = name;
      vehicle.door = new THREE.Vector3(gate.door[0], 0.02, gate.door[1]);
      vehicle.routes = { into: makeRoute(gate.into), away: makeRoute(gate.away) };
      vehicle.state = "away";
      vehicle.timer = i * 6 + seeded(seed, 3) * 4;
      vehicle.carrying = seeded(seed, 8) < 0.5;
      traffic.gateMotos.push(vehicle);
    }
  }
}

function buildDirtRoad(world, crowd, traffic) {
  /** Create the few lorries and cars that now and then bump slowly along the south dirt road, in either direction. */
  DIRT_KINDS.forEach((kind, i) => {
    const vehicle = makeVehicle(world, kind, kind === "truck" ? TRUCK_PAINTS[i % TRUCK_PAINTS.length] : PAINTS[(i * 5 + 2) % PAINTS.length]);
    vehicle.maxSpeed = kind === "truck" ? 2.8 : 3.8;
    const westward = i % 2 === 0;
    const z = westward ? R.south - 1.4 : R.south + 1.9;
    vehicle.routes = { run: makeRoute(westward ? [[140, z], [-140, z]] : [[-140, z], [140, z]]) };
    vehicle.state = "away";
    vehicle.timer = 3 + i * 9;
    traffic.dirt.push(vehicle);
  });
}

function buildCoaches(world, traffic) {
  /** Create the long coaches that pull into the bus park, wait at the bay, and leave for the road. */
  COACH_PAINTS.forEach((hex, i) => {
    const vehicle = makeVehicle(world, "coach", hex);
    vehicle.routes = { arrive: makeRoute(BUS_ROUTES.arrive), depart: makeRoute(BUS_ROUTES.depart) };
    vehicle.state = "away";
    vehicle.timer = 3 + i * 25;
    traffic.coaches.push(vehicle);
  });
}

function buildJunctions(crowd, traffic) {
  /** Post a traffic officer at the two busy junctions on the north road, each with stop lines for one direction at a time. */
  const loop = traffic.loop;
  const corners = [[R.east, R.north], null, null, [R.west, R.north]];
  corners.forEach((corner, k) => {
    if (!corner) return;
    const [x, z] = corner;
    const start = loop.lengths[k * 7];
    const end = loop.lengths[k * 7 + 6];
    const stops = { 1: stopLine(loop, start - STOP_BEFORE, 1), "-1": stopLine(loop, end + STOP_BEFORE, -1) };
    const outward = [Math.sign(x - 10), Math.sign(z - 5)];
    let i = 0;
    const officer = addPerson(crowd, policeLook(() => seeded(k * 19 + i++, 88)));
    Object.assign(officer, { x: x + outward[0] * 1.6, z: z + outward[1] * 1.6, y: 0.05, mode: "direct" });
    traffic.junctions.push({ stops, officer, offset: k * 5 });
  });
}

function stopLine(loop, distance, direction) {
  /** Return the lane point where traffic of one direction waits before a junction. */
  const wrapped = ((distance % loop.total) + loop.total) % loop.total;
  routePoint(loop, wrapped, point, tangent);
  tangent.multiplyScalar(direction);
  return new THREE.Vector3(point.x - tangent.z * LANE, 0, point.z + tangent.x * LANE);
}

export function buildTraffic(world, crowd) {
  /** Build all decorative traffic: busy two-way roads, roadside parking, gate motos, bus park coaches and junction officers. */
  const traffic = { loop: loopRoute(), loopVehicles: [], parking: [], gateMotos: [], coaches: [], dirt: [], junctions: [], obstacles: [], world };
  buildLoop(world, crowd, traffic);
  buildParking(world, crowd, traffic);
  buildGateMotos(world, crowd, traffic);
  buildCoaches(world, traffic);
  buildDirtRoad(world, crowd, traffic);
  buildJunctions(crowd, traffic);
  return traffic;
}

function clearance(vehicle, obstacles, hardOnly) {
  /** Return the free distance ahead of a vehicle's front to the nearest vehicle, person or stop line in its path. */
  let best = Infinity;
  const { x: mx, z: mz } = vehicle.motion;
  for (const other of obstacles) {
    if (other.owner === vehicle || (hardOnly && !other.hard)) continue;
    const rx = other.pos.x - vehicle.pos.x;
    const rz = other.pos.z - vehicle.pos.z;
    const ahead = rx * mx + rz * mz;
    if (ahead <= 0 || ahead > LOOK_AHEAD + vehicle.half + other.half) continue;
    const lateral = Math.abs(rx * mz - rz * mx);
    if (lateral > vehicle.width + other.width + SIDE_MARGIN) continue;
    best = Math.min(best, ahead - vehicle.half - other.half);
  }
  return best;
}

export const trafficEvents = [];

function hornCheck(vehicle, waiting, time, delta) {
  /** Let a driver held up for a while lean on the horn now and then, so jams can be heard. */
  vehicle.waiting = waiting ? (vehicle.waiting || 0) + delta : 0;
  if (!waiting || time < (vehicle.nextHorn || 0)) return;
  if (vehicle.waiting > 1.5) {
    vehicle.nextHorn = time + 3 + Math.random() * 7;
    if (Math.random() < 0.65 && trafficEvents.length < 32) trafficEvents.push({ type: "horn", kind: vehicle.kind, pos: vehicle.pos.clone() });
  }
}

function drive(vehicle, total, stopAtEnd, delta, time, obstacles) {
  /** Advance a vehicle along its path: brake for anything ahead, stop at police stop lines, and creep past jams that last too long. */
  let target = vehicle.maxSpeed;
  if (stopAtEnd) target = Math.min(target, Math.sqrt(5 * Math.max(total - vehicle.s, 0)) + 0.15);
  if (vehicle.pause > 0) {
    vehicle.pause -= delta;
    target = 0;
  }
  const creeping = time < vehicle.creepUntil;
  const hardGap = clearance(vehicle, obstacles, true);
  const gap = creeping ? hardGap : clearance(vehicle, obstacles, false);
  if (gap < LOOK_AHEAD) target = Math.min(target, Math.max(0, (gap - SAFE_GAP) * 1.3));
  vehicle.blocked = gap < LOOK_AHEAD && gap < hardGap && target < 0.1 ? vehicle.blocked + delta : 0;
  if (vehicle.blocked > STUCK_SECONDS) {
    vehicle.creepUntil = time + CREEP_SECONDS;
    vehicle.blocked = 0;
  }
  const before = vehicle.speed;
  vehicle.speed += THREE.MathUtils.clamp(target - vehicle.speed, -BRAKE * delta, ACCEL * delta);
  vehicle.speed = Math.max(vehicle.speed, 0);
  vehicle.s += vehicle.speed * delta;
  hornCheck(vehicle, gap < LOOK_AHEAD && vehicle.speed < 0.3 && !stopAtEnd, time, delta);
  if (vehicle.kind === "coach") {
    if (vehicle.speed > 1.8) vehicle.rolling = true;
    if (vehicle.rolling && vehicle.speed < 0.3 && before >= vehicle.speed) {
      vehicle.rolling = false;
      if (trafficEvents.length < 32) trafficEvents.push({ type: "airbrake", kind: vehicle.kind, pos: vehicle.pos.clone() });
    }
  }
}

function place(vehicle, route, distance, reverse = false, laneOffset = 0, direction = 1) {
  /** Put a vehicle at a distance along a route, facing its direction of travel (or backing up), and seat its riders. */
  routePoint(route, distance, point, tangent);
  tangent.multiplyScalar(direction);
  vehicle.pos.set(point.x - tangent.z * laneOffset, 0, point.z + tangent.x * laneOffset);
  vehicle.motion.copy(tangent);
  vehicle.nose.copy(tangent).multiplyScalar(reverse ? -1 : 1);
  vehicle.mesh.position.copy(vehicle.pos);
  vehicle.mesh.rotation.y = Math.atan2(-vehicle.nose.z, vehicle.nose.x);
  seat(vehicle);
}

function seat(vehicle) {
  /** Keep a moto's rider, and a passenger when carried, on the seat. */
  const yaw = vehicle.mesh.rotation.y + Math.PI / 2;
  for (const [person, along] of vehicle.people) {
    Object.assign(person, { active: vehicle.visible, x: vehicle.pos.x + vehicle.nose.x * along, z: vehicle.pos.z + vehicle.nose.z * along,
      y: 0, yaw, mode: "ride" });
  }
  if (vehicle.passenger && vehicle.carrying) {
    Object.assign(vehicle.passenger, { active: vehicle.visible, x: vehicle.pos.x - vehicle.nose.x * 0.62,
      z: vehicle.pos.z - vehicle.nose.z * 0.62, y: 0, yaw, mode: "ride" });
  }
}

function show(vehicle, visible) {
  /** Show or hide a vehicle and everyone riding it. */
  vehicle.visible = visible;
  vehicle.mesh.visible = visible;
  if (!visible) {
    for (const [person] of vehicle.people) person.active = false;
    if (vehicle.passenger && vehicle.carrying) vehicle.passenger.active = false;
  }
}

function walkBetween(person, from, to, t) {
  /** Place a person walking from one ground point to another, t from 0 to 1. */
  person.x = THREE.MathUtils.lerp(from.x, to.x, t);
  person.z = THREE.MathUtils.lerp(from.z, to.z, t);
  person.y = 0.02;
  person.yaw = Math.atan2(to.x - from.x, to.z - from.z);
  person.mode = "idle";
  person.active = true;
}

function updateLoop(traffic, delta, time, cap) {
  /** Drive the road traffic round the block; on Low, extra cars wait parked on the shoulders and extra motos stay away. */
  let parked = 0;
  traffic.loopVehicles.forEach((vehicle, index) => {
    if (index >= cap) {
      const spot = vehicle.kind !== "moto" ? LOW_PARKING[parked] : null;
      if (spot) parked += 1;
      show(vehicle, Boolean(spot));
      if (spot) {
        vehicle.mesh.position.set(spot[0], 0, spot[1]);
        vehicle.mesh.rotation.y = spot[2];
        vehicle.pos.set(spot[0], 0, spot[1]);
      }
      return;
    }
    show(vehicle, true);
    if (time > vehicle.nextStop) {
      vehicle.pause = 1 + seeded(index, Math.floor(time)) * 2.5;
      vehicle.nextStop = time + 18 + seeded(index, Math.floor(time) + 1) * 30;
    }
    drive(vehicle, Infinity, false, delta, time, traffic.obstacles);
    vehicle.s %= traffic.loop.total;
    const distance = vehicle.direction > 0 ? vehicle.s : traffic.loop.total - vehicle.s;
    place(vehicle, traffic.loop, distance, false, LANE, vehicle.direction);
  });
}

function laneClear(traffic, vehicle) {
  /** Return whether the shop-side lane is free for a parked car to back out into. */
  return !traffic.obstacles.some((other) => other.owner !== vehicle && other.moving && Math.abs(other.pos.z - SHOP_LANE) < 1.8
    && other.pos.x > vehicle.spot - 5 && other.pos.x < vehicle.spot + 16);
}

function unload(vehicle, elapsed) {
  /** Walk a helper from the parked car to the shop door with a sack, and back empty-handed. */
  const person = vehicle.unloader;
  const car = new THREE.Vector3(vehicle.spot - 1.2, 0, PARKED_Z + 0.6);
  const door = new THREE.Vector3(vehicle.spot - 0.4, 0, LAYOUT.block.roadsideFront + 0.3);
  if (elapsed < 0.5 || elapsed > 9) {
    person.active = false;
  } else if (elapsed < 4) {
    person.look.carry = "sack";
    walkBetween(person, car, door, (elapsed - 0.5) / 3.5);
  } else if (elapsed < 5) {
    person.active = true;
  } else {
    person.look.carry = "none";
    walkBetween(person, door, car, (elapsed - 5) / 4);
  }
}

function updateParking(traffic, delta, time, cap) {
  /** Cycle the roadside parking: pull in, sit and unload, back out when the lane is clear, drive off, come back later. */
  traffic.parking.forEach((vehicle, index) => {
    const routes = vehicle.routes;
    if (index >= cap && vehicle.state !== "parked") Object.assign(vehicle, { state: "parked", timer: 1e9, s: 0 });
    if (index >= cap) {
      show(vehicle, true);
      place(vehicle, routes.arrive, routes.arrive.total);
      vehicle.unloader.active = false;
      return;
    }
    if (vehicle.state === "away") {
      vehicle.timer -= delta;
      show(vehicle, false);
      if (vehicle.timer <= 0) Object.assign(vehicle, { state: "arrive", s: 0, speed: vehicle.maxSpeed });
      return;
    }
    show(vehicle, true);
    if (vehicle.state === "arrive") {
      drive(vehicle, routes.arrive.total, true, delta, time, traffic.obstacles);
      place(vehicle, routes.arrive, vehicle.s);
      if (vehicle.s >= routes.arrive.total - 0.05) Object.assign(vehicle, { state: "parked", timer: 18 + seeded(index, Math.floor(time)) * 22, parkedAt: time, speed: 0 });
    } else if (vehicle.state === "parked") {
      vehicle.timer -= delta;
      place(vehicle, routes.arrive, routes.arrive.total);
      unload(vehicle, time - (vehicle.parkedAt ?? time));
      if (vehicle.timer <= 0 && laneClear(traffic, vehicle)) Object.assign(vehicle, { state: "reverse", s: 0, speed: 0 });
    } else if (vehicle.state === "reverse") {
      vehicle.unloader.active = false;
      vehicle.speed = Math.min(vehicle.speed + delta * 1.5, 1.6);
      vehicle.s += vehicle.speed * delta;
      place(vehicle, routes.reverse, vehicle.s, true);
      if (vehicle.s >= routes.reverse.total) Object.assign(vehicle, { state: "depart", s: 0, speed: 0 });
    } else if (vehicle.state === "depart") {
      drive(vehicle, Infinity, false, delta, time, traffic.obstacles);
      place(vehicle, routes.depart, vehicle.s);
      if (vehicle.s >= routes.depart.total) Object.assign(vehicle, { state: "away", timer: 3 + seeded(index, Math.floor(time)) * 9 });
    }
  });
}

function updateGateMotos(traffic, delta, time, caps) {
  /** Run the gate motos: ride in from the road, stop at the gate while a passenger gets off or on, then ride away. */
  const counts = {};
  traffic.gateMotos.forEach((vehicle, index) => {
    counts[vehicle.gate] = (counts[vehicle.gate] || 0) + 1;
    const enabled = counts[vehicle.gate] <= caps[vehicle.gate];
    if (!enabled) {
      show(vehicle, false);
      vehicle.passenger.active = false;
      vehicle.state = "away";
      return;
    }
    const { into, away } = vehicle.routes;
    if (vehicle.state === "away") {
      show(vehicle, false);
      vehicle.passenger.active = false;
      vehicle.timer -= delta;
      if (vehicle.timer <= 0) Object.assign(vehicle, { state: "into", s: 0, speed: vehicle.maxSpeed });
      return;
    }
    show(vehicle, true);
    if (vehicle.state === "into") {
      drive(vehicle, into.total, true, delta, time, traffic.obstacles);
      place(vehicle, into, vehicle.s);
      if (vehicle.s >= into.total - 0.05) Object.assign(vehicle, { state: "stop", stoppedAt: time, speed: 0 });
    } else if (vehicle.state === "stop") {
      place(vehicle, into, into.total);
      const elapsed = time - vehicle.stoppedAt;
      const seatPoint = new THREE.Vector3(vehicle.pos.x - vehicle.nose.x * 0.9, 0, vehicle.pos.z - vehicle.nose.z * 0.9);
      if (vehicle.carrying && elapsed > 0.8) {
        vehicle.carrying = false;
        vehicle.dropping = true;
      }
      if (vehicle.dropping) {
        if (elapsed < 4) walkBetween(vehicle.passenger, seatPoint, vehicle.door, (elapsed - 0.8) / 3.2);
        else vehicle.passenger.active = false;
      } else if (!vehicle.carrying && elapsed > 0.8) {
        if (elapsed < 4) walkBetween(vehicle.passenger, vehicle.door, seatPoint, (elapsed - 0.8) / 3.2);
        else vehicle.carrying = true;
      }
      if (elapsed > 5) Object.assign(vehicle, { state: "away-ride", s: 0, speed: 0, dropping: false });
    } else if (vehicle.state === "away-ride") {
      drive(vehicle, Infinity, false, delta, time, traffic.obstacles);
      place(vehicle, away, vehicle.s);
      if (vehicle.s >= away.total) Object.assign(vehicle, { state: "away", timer: 2 + seeded(index, Math.floor(time)) * 7 });
    }
  });
}

function updateCoaches(traffic, delta, time, cap) {
  /** Run the coaches: arrive along the east road, wait at the bay while passengers board, and leave. */
  traffic.coaches.forEach((vehicle, index) => {
    const { arrive, depart } = vehicle.routes;
    if (index >= cap || vehicle.state === "away") {
      show(vehicle, false);
      vehicle.timer -= delta;
      if (index < cap && vehicle.timer <= 0) Object.assign(vehicle, { state: "arrive", s: 0, speed: vehicle.maxSpeed });
      return;
    }
    show(vehicle, true);
    if (vehicle.state === "arrive") {
      drive(vehicle, arrive.total, true, delta, time, traffic.obstacles);
      place(vehicle, arrive, vehicle.s);
      if (vehicle.s >= arrive.total - 0.05) Object.assign(vehicle, { state: "board", timer: 16, speed: 0 });
    } else if (vehicle.state === "board") {
      vehicle.timer -= delta;
      place(vehicle, arrive, arrive.total);
      if (vehicle.timer <= 0) Object.assign(vehicle, { state: "depart", s: 0 });
    } else {
      drive(vehicle, Infinity, false, delta, time, traffic.obstacles);
      place(vehicle, depart, vehicle.s);
      if (vehicle.s >= depart.total) Object.assign(vehicle, { state: "away", timer: 12 + seeded(index, Math.floor(time)) * 20 });
    }
  });
}

function updateDirtRoad(traffic, delta, time, cap) {
  /** Send a lorry or car along the dirt road every so often, slowing for people crossing, then rest it out of sight. */
  traffic.dirt.forEach((vehicle, index) => {
    if (index >= cap || vehicle.state === "away") {
      show(vehicle, false);
      vehicle.timer -= delta;
      if (index < cap && vehicle.timer <= 0) Object.assign(vehicle, { state: "run", s: 0, speed: vehicle.maxSpeed });
      return;
    }
    show(vehicle, true);
    drive(vehicle, Infinity, false, delta, time, traffic.obstacles);
    place(vehicle, vehicle.routes.run, vehicle.s);
    if (vehicle.s >= vehicle.routes.run.total) Object.assign(vehicle, { state: "away", timer: 8 + seeded(index, Math.floor(time)) * 22 });
  });
}

function updateJunctions(traffic, time) {
  /** Switch each junction between holding one direction and the other, with its officer waving the moving side through. */
  for (const junction of traffic.junctions) {
    const held = Math.floor((time + junction.offset) / JUNCTION_PHASE) % 2 ? 1 : -1;
    if (junction.held !== undefined && junction.held !== held) trafficEvents.push({ type: "whistle", long: true, pos: new THREE.Vector3(junction.officer.x, 1.6, junction.officer.z) });
    else if (time > (junction.nextWhistle || 0)) {
      if (junction.nextWhistle) trafficEvents.push({ type: "whistle", long: false, pos: new THREE.Vector3(junction.officer.x, 1.6, junction.officer.z) });
      junction.nextWhistle = time + 9 + Math.random() * 14;
    }
    junction.held = held;
    traffic.obstacles.push({ owner: null, pos: junction.stops[held], half: 0.2, width: 0.6, hard: true, moving: false });
    const flowing = junction.stops[-held];
    const officer = junction.officer;
    officer.yaw = Math.atan2(flowing.x - officer.x, flowing.z - officer.z);
    officer.mode = "direct";
  }
}

function collectObstacles(traffic, crowd) {
  /** Gather every visible vehicle and every person on foot, so vehicles can brake for them. */
  const obstacles = traffic.obstacles;
  obstacles.length = 0;
  for (const group of [traffic.loopVehicles, traffic.parking, traffic.gateMotos, traffic.coaches, traffic.dirt]) {
    for (const vehicle of group) {
      if (vehicle.visible) obstacles.push({ owner: vehicle, pos: vehicle.pos, half: vehicle.half, width: vehicle.width, moving: vehicle.speed > 0.2 || vehicle.state !== "parked" });
    }
  }
  for (const person of crowd.people) {
    if (person.active && person.mode !== "ride") obstacles.push({ owner: null, pos: person, half: 0.3, width: 0.3, moving: false });
  }
}

export function animateTraffic(traffic, crowd, delta, time, quality) {
  /** Advance all decorative traffic for one frame at the vehicle caps of the current quality. */
  const caps = CAPS[quality] || CAPS.high;
  collectObstacles(traffic, crowd);
  updateJunctions(traffic, time);
  updateLoop(traffic, delta, time, caps.loop);
  updateParking(traffic, delta, time, caps.parking);
  updateGateMotos(traffic, delta, time, caps.gate);
  updateCoaches(traffic, delta, time, caps.buses);
  updateDirtRoad(traffic, delta, time, caps.dirt);
}
