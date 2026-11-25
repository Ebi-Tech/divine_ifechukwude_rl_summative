import * as THREE from "three";
import { mergeGeometries } from "three/addons/BufferGeometryUtils.js";
import { LAYOUT, addCollider, seeded } from "./layout.js";
import { StaticBatch, placement } from "./world.js";
import { carGroup, motoGroup, umbrellaGeometry } from "./market.js";
import { atlasPlane, bannerTexture, ribbedTexture, signAtlas, signTexture, tileTexture } from "./textures.js";

const B = LAYOUT.block;
const R = LAYOUT.roads;
const WALL_HEIGHT = 4.6;
const FENCE_WALL = 0.8;
const FENCE_TOP = 2.8;
const BAR_STEP = 0.16;
const ROAD_HALF = R.width / 2;
const SIGNS = [
  ["Phone Repair", "#f4ead5", "#1d3b5a"], ["Electronics", "#1f4e9a", "#fffaf0"], ["Mobile Money", "#f2c230", "#1f4e9a"],
  ["Cold Drinks", "#c8352e", "#fffaf0"], ["Hardware", "#2a8a4a", "#fffaf0"], ["Barber Shop", "#fffaf0", "#8a2a1a"],
  ["Photocopy & Print", "#f4ead5", "#2b1d14"], ["Shoes & Bags", "#7a4b9a", "#fffaf0"], ["Tailor", "#f4ead5", "#2a6fb5"],
  ["Cosmetics", "#e58fb0", "#2b1d14"], ["Bakery", "#f2a541", "#2b1d14"], ["Pharmacy", "#2a8a4a", "#fffaf0"],
  ["Phone Accessories", "#fffaf0", "#c8352e"], ["Market Gate 2", "#1f4e9a", "#f2c230"], ["Fresh Juice", "#3f9b4a", "#fffaf0"],
  ["Electronics Repair", "#f4ead5", "#1f4e9a"], ["Bus Park", "#2a6a4a", "#f4ead5"], ["Tickets", "#f4ead5", "#2a6a4a"],
  ["Airtime", "#f2c230", "#c8352e"], ["Snacks", "#c8352e", "#fffaf0"], ["Shoe Repair", "#2b1d14", "#f2c230"],
];
const SIGN_ROWS = Object.fromEntries(SIGNS.map(([text], row) => [text, row]));
const SHOP_SIGNS = ["Phone Repair", "Electronics", "Cold Drinks", "Hardware", "Barber Shop", "Photocopy & Print", "Shoes & Bags",
  "Tailor", "Cosmetics", "Bakery", "Pharmacy", "Phone Accessories", "Fresh Juice", "Electronics Repair", "Mobile Money"];
const BUILDING_COLORS = ["plasterCream", "plasterYellow", "plasterBlue", "plasterPink", "plasterWhite", "plasterGreen"];
const VEHICLE_COLORS = [0xc9ccd0, 0x22262b, 0x8a1a1a, 0xf3f1ea, 0x2f4a6a, 0x6a6a6a];
const MOTO_COLORS = [0xc1121f, 0x1d1d1d, 0x1d3557, 0x2a2a2a, 0x8a1a1a, 0x2f6a3a];
const STATIC_PARKING = [-29.5, -20.4, -6.6, 22.8, 34.5, 58.2];
export const CYCLING_PARKING = [-0.8, 4.6, 9.8, 15.2];

function materials(world) {
  /** Create the painted steel, rust, tile, tank, glass and sign materials used around the block, once. */
  const tiles = tileTexture();
  const tile = new THREE.MeshLambertMaterial({ map: tiles });
  tile.userData.tile = 0.8;
  const atlas = signAtlas(SIGNS);
  return {
    blue: new THREE.MeshLambertMaterial({ color: 0x2f5fbf }),
    fadedGreen: new THREE.MeshLambertMaterial({ color: 0x6f8a78 }),
    rust: new THREE.MeshLambertMaterial({ color: 0x7a4a2e }),
    tile,
    tank: new THREE.MeshLambertMaterial({ map: ribbedTexture() }),
    glass: new THREE.MeshLambertMaterial({ color: 0x3b6fb8, emissive: 0x0a1830 }),
    dark: new THREE.MeshLambertMaterial({ color: 0x221a14 }),
    pole: new THREE.MeshLambertMaterial({ color: 0x9a958c }),
    wood: new THREE.MeshLambertMaterial({ color: 0x5a4030 }),
    atlas,
    signs: new THREE.MeshLambertMaterial({ map: atlas.texture }),
    dirt: new THREE.MeshLambertMaterial({ color: 0xb08a62 }),
    rut: new THREE.MeshLambertMaterial({ color: 0x7d5a3a }),
    world,
  };
}

function box(batch, size, position, material, rotation = null) {
  /** Queue a box and return nothing; a shorthand for the many plain boxes of walls and fittings. */
  batch.add(new THREE.BoxGeometry(...size), position, material, rotation);
}

function solid(batch, size, position, material) {
  /** Queue an axis-aligned box that also blocks the walk camera. */
  box(batch, size, position, material);
  addCollider(position[0] - size[0] / 2, position[2] - size[2] / 2, position[0] + size[0] / 2, position[2] + size[2] / 2);
}

function sign(batch, mats, text, width, height, position, turn) {
  /** Queue one painted sign from the shared sign atlas. */
  batch.add(atlasPlane(mats.atlas, SIGN_ROWS[text], width, height), position, mats.signs, [0, turn, 0]);
}

function bar(bars, base, x, y, height) {
  /** Record one vertical steel bar of a fence or gate, placed in a local frame. */
  bars.push(base.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, 0)).multiply(new THREE.Matrix4().makeScale(1, height, 1)));
}

function gateLeaf(batch, bars, mats, hinge, angle, width, height, sheet, paint = mats.blue) {
  /** Build one open gate leaf: a steel frame, a solid lower sheet and bars above, swung about its hinge. */
  const base = new THREE.Matrix4().makeRotationY(angle).setPosition(hinge.x, 0, hinge.z);
  const part = (size, x, y) => batch.addMatrix(new THREE.BoxGeometry(...size), base.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, 0)), paint);
  part([width, 0.08, 0.08], width / 2, height - 0.04);
  part([width, 0.08, 0.08], width / 2, 0.1);
  part([0.09, height, 0.09], 0.045, height / 2);
  part([0.09, height, 0.09], width - 0.045, height / 2);
  part([width, sheet, 0.04], width / 2, sheet / 2 + 0.08);
  part([width, 0.07, 0.07], width / 2, sheet + 0.08);
  for (let x = 0.15; x < width - 0.08; x += 0.15) bar(bars, base, x, sheet + 0.1, height - sheet - 0.14);
  const end = new THREE.Vector3(width, 0, 0).applyMatrix4(base);
  addCollider(Math.min(hinge.x, end.x) - 0.1, Math.min(hinge.z, end.z) - 0.1, Math.max(hinge.x, end.x) + 0.1, Math.max(hinge.z, end.z) + 0.1);
}

function buildEastFence(batch, bars, mats) {
  /** Build the east short side: blue steel bars on a low yellow wall the full length, with no gate. */
  const m = mats.world.materials;
  const x = B.east;
  const base = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(x, 0, 0);
  const z0 = B.north - 0.3;
  const z1 = B.south + 0.3;
  const length = z1 - z0;
  const middle = (z0 + z1) / 2;
  solid(batch, [0.3, FENCE_WALL, length], [x, FENCE_WALL / 2, middle], m.plasterYellow);
  box(batch, [0.36, 0.06, length], [x, FENCE_WALL + 0.03, middle], m.concrete);
  for (const y of [1.9, FENCE_TOP]) box(batch, [0.07, 0.07, length], [x, y, middle], mats.blue);
  for (let z = z0 + 0.1; z < z1; z += BAR_STEP) bar(bars, base, -z, FENCE_WALL, FENCE_TOP - FENCE_WALL);
  for (let z = z0 + 1.5; z < z1; z += 3) box(batch, [0.12, FENCE_TOP - FENCE_WALL + 0.1, 0.12], [x, (FENCE_TOP + FENCE_WALL) / 2, z], mats.blue);
}

function kiosk(batch, mats, vendors, x, z, text, wall) {
  /** Stand a small roadside kiosk against the east fence, its hatch and counter facing the road, with a customer at it. */
  const m = mats.world.materials;
  solid(batch, [1.4, 2.3, 1.9], [x, 1.15, z], m[wall]);
  box(batch, [1.9, 0.08, 2.3], [x + 0.2, 2.36, z], m.corrRust);
  batch.add(new THREE.PlaneGeometry(1.1, 0.8), [x + 0.71, 1.4, z], mats.dark, [0, Math.PI / 2, 0]);
  box(batch, [0.45, 0.06, 1.7], [x + 0.92, 0.98, z], m.planks);
  sign(batch, mats, text, 1.7, 0.42, [x + 0.72, 2.05, z], Math.PI / 2);
  vendors.push({ position: new THREE.Vector3(x + 1.55, 0.02, z + 0.25), yaw: -Math.PI / 2, mode: "talk" });
}

function buildEastSide(batch, mats, vendors) {
  /** Dress the outside of the east fence: a few kiosks and cars parked along it. */
  [[-13, "Airtime", "plasterBlue"], [0.75, "Snacks", "plasterPink"], [20, "Shoe Repair", "plasterGreen"], [25.5, "Airtime", "plasterCream"]]
    .forEach(([z, text, wall]) => kiosk(batch, mats, vendors, B.east + 1.0, z, text, wall));
  [-9.5, 23, 28].forEach((z, index) => {
    const car = carGroup(mats.world, VEHICLE_COLORS[(index + 2) % VEHICLE_COLORS.length], index === 1 ? "pickup" : "hatch");
    car.position.set(69.9, 0, z);
    car.rotation.y = Math.PI / 2 + (index % 2 ? 0.03 : -0.03);
    batch.addObject(car);
    addCollider(69.0, z - 2.1, 70.8, z + 2.1);
  });
}

function buildSouthGateMotos(batch, vendors, riders) {
  /** Line the dirt road edge by the south gate with moto taxis waiting for passengers, and people at the gate. */
  const { x: gx, width } = LAYOUT.southGate;
  const edge = B.south + 1.0;
  const spots = [];
  for (let i = 0; i < 6; i += 1) spots.push([gx - width / 2 - 2.0 - i * 1.6, edge]);
  for (let i = 0; i < 6; i += 1) spots.push([gx + width / 2 + 2.0 + i * 1.6, edge]);
  buildMotoRow(batch, spots, 0, riders, 0.6);
  const angled = [[gx - width / 2 - 0.6, edge + 0.5], [gx + width / 2 + 0.6, edge + 0.5]];
  buildMotoRow(batch, angled, -Math.PI / 2 + 0.5, riders, 1);
  addCollider(gx - width / 2 - 11.8, B.south + 0.4, gx - width / 2 - 1.2, B.south + 1.5);
  addCollider(gx + width / 2 + 1.2, B.south + 0.4, gx + width / 2 + 11.8, B.south + 1.5);
  crowd(vendors, [[gx - 1.6, B.south - 1.4, 0.5], [gx + 1.4, B.south - 1.9, -2.4], [gx - 2.0, B.south - 3.0, 1.4], [gx + 2.1, B.south - 3.4, -0.9],
    [gx - width / 2 - 1.2, B.south + 1.4, 0.3], [gx + width / 2 + 1.3, B.south + 1.4, -0.4], [gx - 4.4, B.south - 1.2, 2.6], [gx + 4.6, B.south - 1.5, -2.8]]);
}

function buildSouthWall(batch, bars, mats, props) {
  /** Build the plain south long wall: yellow with blue trim, nothing built against its outside, and one gate that opens inward. */
  const m = mats.world.materials;
  const z = B.south + 0.15;
  const { x: gx, width } = LAYOUT.southGate;
  const low = gx - width / 2;
  const high = gx + width / 2;
  for (const [a, b] of [[B.west - 0.3, low - 0.35], [high + 0.35, B.east + 0.15]]) {
    const run = b - a;
    const middle = (a + b) / 2;
    solid(batch, [run, WALL_HEIGHT, 0.3], [middle, WALL_HEIGHT / 2, z], m.plasterYellow);
    box(batch, [run, 0.35, 0.08], [middle, WALL_HEIGHT - 0.12, z + 0.19], mats.blue);
    box(batch, [run, 0.05, 1.1], [middle, WALL_HEIGHT + 0.1, z + 0.3], m.corrBlue, [0.22, 0, 0]);
    box(batch, [run, 0.32, 0.05], [middle, 0.16, z + 0.17], mats.blue);
  }
  for (const x of [low - 0.35, high + 0.35]) {
    solid(batch, [0.7, 5.0, 0.7], [x, 2.5, z], m.plasterYellow);
    box(batch, [0.82, 0.16, 0.82], [x, 5.08, z], mats.blue);
  }
  box(batch, [width + 0.4, 0.16, 0.16], [gx, 4.5, z], mats.blue);
  sign(batch, mats, "Market Gate 2", 2.8, 0.62, [gx, 3.95, z + 0.12], 0);
  sign(batch, mats, "Market Gate 2", 2.8, 0.62, [gx, 3.95, z - 0.12], Math.PI);
  gateLeaf(batch, bars, mats, { x: low, z: z - 0.2 }, Math.atan2(0.98, -0.22), width / 2 - 0.05, 3.0, 1.2);
  gateLeaf(batch, bars, mats, { x: high, z: z - 0.2 }, Math.atan2(0.98, 0.22), width / 2 - 0.05, 3.0, 1.2);
  props.add("cord", placement([gx, 4.45, z], null, [1, 0.3, 1]));
  props.add("bulb", placement([gx, 4.15, z - 0.4]));
}

const TROUGH_LENGTH = 5.6;
const WALKWAY = 1.8;
const GADGETS = [0x1c1c1c, 0xf3f3f0, 0x2a2a2a, 0xc8352e, 0x1f6fb5, 0xf2c230, 0xe58fb0, 0x3f9b4a];
const WEST = {
  corner: B.north - 0.3,
  far: B.south + 0.3,
  point: (u, d) => [B.west - d, u],
  out: [-1, 0],
  along: [0, 1],
  hand: -1,
};
const FACE_OUT = Math.atan2(WEST.out[0], WEST.out[1]);

function wbox(batch, [sU, h, sD], [u, y, d], material, tilt = 0) {
  /** Queue a box on the main gate side: sizes and positions along the wall (u), up (y) and outward (d). */
  const [x, z] = WEST.point(u, d);
  batch.add(new THREE.BoxGeometry(sD, h, sU), [x, y, z], material, tilt ? [0, 0, tilt] : null);
}

function wsolid(batch, size, position, material) {
  /** Queue a box on the main gate side that also blocks the walk camera. */
  wbox(batch, size, position, material);
  const [x, z] = WEST.point(position[0], position[2]);
  addCollider(x - size[2] / 2, z - size[0] / 2, x + size[2] / 2, z + size[0] / 2);
}

function wvec(u, y, d) {
  /** Return the world position of a point on the main gate side. */
  const [x, z] = WEST.point(u, d);
  return new THREE.Vector3(x, y, z);
}

function wcrowd(vendors, spots, look = null) {
  /** Add standing, chatting people at [u, d, turn] spots on the main gate side, turned relative to facing the road. */
  spots.forEach(([u, d, turn], index) => vendors.push({ position: wvec(u, 0.02, d), yaw: FACE_OUT + WEST.hand * turn, mode: index % 3 === 0 ? "idle" : "talk", look }));
}

function buildGateWall(batch, bars, mats) {
  /** Build the main gate end: yellow walls with a blue roof edge and trim, and the big open blue gate into the clothes lane. */
  const m = mats.world.materials;
  const gateU = LAYOUT.mainGate.z;
  const half = LAYOUT.mainGate.width / 2;
  const low = gateU - half;
  const high = gateU + half;
  for (const [u0, u1] of [[WEST.corner, low - 0.35], [high + 0.35, WEST.far]]) {
    const length = u1 - u0;
    const middle = (u0 + u1) / 2;
    wsolid(batch, [length, WALL_HEIGHT, 0.3], [middle, WALL_HEIGHT / 2, 0.15], m.plasterYellow);
    wbox(batch, [length, 0.35, 0.08], [middle, WALL_HEIGHT - 0.12, 0.34], mats.blue);
    wbox(batch, [length, 0.05, 1.1], [middle, WALL_HEIGHT + 0.1, 0.45], m.corrBlue, 0.22);
    wbox(batch, [length, 0.32, 0.05], [middle, 0.16, 0.32], mats.blue);
  }
  for (const u of [low - 0.35, high + 0.35]) {
    wsolid(batch, [0.7, 5.0, 0.7], [u, 2.5, 0.15], m.plasterYellow);
    wbox(batch, [0.82, 0.16, 0.82], [u, 5.08, 0.15], mats.blue);
  }
  const [ox, oz] = WEST.out;
  const [ax, az] = WEST.along;
  const leaf = (u, splay) => {
    const dx = ox * 0.98 + ax * splay;
    const dz = oz * 0.98 + az * splay;
    const [hx, hz] = WEST.point(u, 0.35);
    gateLeaf(batch, bars, mats, { x: hx, z: hz }, Math.atan2(-dz, dx), half - 0.1, 3.4, 1.4);
  };
  leaf(low, -0.2);
  leaf(high, 0.2);
  wbox(batch, [LAYOUT.mainGate.width + 1, 0.04, 9.5], [gateU, 0.02, 4.6], m.earthLane);
}

function buildTrough(batch, mats, scene, u, near) {
  /** Build the tiled wash trough with its long axis pointing at the road and its near end a walkway away from the wall. */
  const m = mats.world.materials;
  const L = TROUGH_LENGTH;
  const back = -0.5;
  const [sx, sz] = WEST.point(u, near);
  const base = new THREE.Matrix4().makeRotationY(Math.atan2(-WEST.out[1], WEST.out[0])).setPosition(sx, 0, sz);
  const part = (size, position, material = mats.tile, tilt = 0) => {
    const local = new THREE.Matrix4().makeRotationX(tilt).setPosition(...position);
    batch.addMatrix(new THREE.BoxGeometry(...size), base.clone().multiply(local), material);
  };
  for (const px of [0.15, 1.95, 3.65, L - 0.15]) part([0.3, 0.62, 1.0], [px, 0.31, 0]);
  part([L - 0.3, 0.62, 0.1], [L / 2, 0.31, back + 0.05]);
  part([L, 0.12, 1.1], [L / 2, 0.68, 0]);
  part([L, 0.3, 0.22], [L / 2, 0.89, back + 0.11]);
  part([L - 0.3, 0.08, 0.26], [L / 2, 0.78, back + 0.35]);
  part([L - 0.3, 0.04, 0.5], [L / 2, 0.76, 0.15], mats.tile, -0.1);
  part([L - 0.3, 0.16, 0.12], [L / 2 - 0.15, 0.8, 0.49]);
  part([0.28, 0.1, 0.12], [L - 0.16, 0.76, 0.49], m.concreteDark);
  for (const end of [0.075, L - 0.075]) part([0.15, 0.24, 1.1], [end, 0.86, 0]);
  for (let tap = 0; tap < 6; tap += 1) {
    part([0.03, 0.1, 0.03], [0.5 + tap * 0.92, 1.08, back + 0.12], m.steel);
    part([0.03, 0.03, 0.12], [0.5 + tap * 0.92, 1.12, back + 0.2], m.steel);
  }
  const a = wvec(u - 0.6, 0, near - 0.05);
  const b = wvec(u + 0.6, 0, near + L + 0.05);
  addCollider(a.x, a.z, b.x, b.z);
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.27, 10),
    new THREE.MeshLambertMaterial({ color: 0xdfeaf2, transparent: true, opacity: 0.72 }));
  bottle.position.copy(new THREE.Vector3(1.3, 1.17, back + 0.12).applyMatrix4(base));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 6), mats.blue);
  cap.position.copy(bottle.position).setY(1.32);
  scene.add(bottle, cap);
  return { u, near };
}

function buildTank(batch, mats, trough, u) {
  /** Build the black ribbed tank on its rusty braced stand against the wall, with a ladder and an overhead pipe to the trough. */
  const centre = wvec(u, 0, 1.35);
  const cx = centre.x;
  const cz = centre.z;
  const half = 0.95;
  const height = 3.4;
  for (const dx of [-half, half]) for (const dz of [-half, half]) box(batch, [0.08, height, 0.08], [cx + dx, height / 2, cz + dz], mats.rust);
  const brace = Math.hypot(half * 2, 1.5);
  const tilt = Math.atan2(half * 2, 1.5);
  for (const y of [0.95, 2.45]) {
    for (const side of [-half, half]) {
      for (const sign2 of [1, -1]) {
        box(batch, [0.05, brace, 0.05], [cx, y, cz + side], mats.rust, [0, 0, sign2 * tilt]);
        box(batch, [0.05, brace, 0.05], [cx + side, y, cz], mats.rust, [sign2 * tilt, 0, 0]);
      }
    }
  }
  box(batch, [2.1, 0.1, 2.1], [cx, height + 0.05, cz], mats.rust);
  batch.add(new THREE.CylinderGeometry(0.95, 0.95, 1.7, 22), [cx, height + 0.95, cz], mats.tank);
  batch.add(new THREE.CylinderGeometry(0.3, 0.32, 0.12, 12), [cx, height + 1.86, cz], mats.tank);
  const ladder = wvec(u + half + 0.12, 0, 1.35);
  for (const dd of [-0.2, 0.2]) {
    const rail = wvec(u + half + 0.12, 0, 1.35 + dd);
    box(batch, [0.03, height + 0.4, 0.03], [rail.x, (height + 0.4) / 2, rail.z], mats.rust);
  }
  for (let y = 0.3; y < height + 0.3; y += 0.3) box(batch, [0.42, 0.025, 0.03], [ladder.x, y, ladder.z], mats.rust);
  const steel = mats.world.materials.steelDark;
  const pipeY = 2.6;
  const start = wvec(u - half - 0.05, 0, 1.35);
  const corner = wvec(trough.u, 0, 1.35);
  const end = wvec(trough.u, 0, trough.near + 0.4);
  batch.add(new THREE.CylinderGeometry(0.03, 0.03, height - pipeY, 6), [start.x, (height + pipeY) / 2, start.z], steel);
  const runZ = Math.abs(corner.z - start.z);
  batch.add(new THREE.CylinderGeometry(0.03, 0.03, runZ, 6), [start.x, pipeY, (start.z + corner.z) / 2], steel, [Math.PI / 2, 0, 0]);
  const runX = Math.abs(end.x - corner.x);
  batch.add(new THREE.CylinderGeometry(0.03, 0.03, runX, 6), [(corner.x + end.x) / 2, pipeY, corner.z], steel, [0, 0, Math.PI / 2]);
  batch.add(new THREE.CylinderGeometry(0.03, 0.03, pipeY - 1.1, 6), [end.x, (pipeY + 1.1) / 2, end.z], steel);
  const a = wvec(u - half - 0.1, 0, 0.3);
  const b = wvec(u + half + 0.25, 0, 1.35 + half + 0.1);
  addCollider(a.x, a.z, b.x, b.z);
}

function buildMotoRow(batch, spots, yaw, riders, riderShare) {
  /** Park a row of moto taxis, baked into the static batch, with riders waiting on some of them. */
  spots.forEach(([x, z], index) => {
    const moto = motoGroup(batch.world, MOTO_COLORS[index % MOTO_COLORS.length]);
    moto.position.set(x, 0, z);
    moto.rotation.y = yaw + ((index % 3) - 1) * 0.1;
    batch.addObject(moto);
    if (seeded(index, x) < riderShare) riders.push({ position: new THREE.Vector3(x - Math.cos(moto.rotation.y) * 0.15, 0, z + Math.sin(moto.rotation.y) * 0.15), yaw: moto.rotation.y + Math.PI / 2 });
  });
}

function umbrellaStall(batch, props, vendors, umbrellas, position, colors, yaw, look = null) {
  /** Put up a market umbrella over a small table with a seated vendor. */
  const [x, z] = position;
  umbrellas.push(umbrellaGeometry(colors).translate(x, 0, z));
  box(batch, [0.9, 0.05, 0.6], [x + 0.45, 0.75, z], batch.world.materials.planks);
  box(batch, [0.8, 0.7, 0.5], [x + 0.45, 0.36, z], batch.world.materials.planksDark);
  props.add("stool", placement([x - 0.3, 0, z]));
  vendors.push({ position: new THREE.Vector3(x - 0.3, 0.02, z), yaw, mode: "sitTalk", seat: 0.43, look });
  addCollider(x + 0.0, z - 0.35, x + 0.9, z + 0.35);
}

function crowd(vendors, spots, look = null) {
  /** Add standing, chatting people at a list of [x, z, yaw] world spots. */
  spots.forEach(([x, z, yaw], index) => vendors.push({ position: new THREE.Vector3(x, 0.02, z), yaw, mode: index % 3 === 0 ? "idle" : "talk", look }));
}

function agentStall(batch, mats, props, vendors, umbrellas, u, d) {
  /** Set up a mobile money stand: a big plain yellow umbrella, a small table with a generic sign, two seated agents and a customer. */
  const m = mats.world.materials;
  const centre = wvec(u, 0, d);
  umbrellas.push(umbrellaGeometry([0xf2c230, 0xf6d04a]).translate(centre.x, 0, centre.z));
  wbox(batch, [1.1, 0.05, 0.6], [u, 0.75, d], m.planks);
  wbox(batch, [1.0, 0.7, 0.5], [u, 0.36, d], m.planksDark);
  const signPoint = wvec(u, 0.5, d + 0.26);
  sign(batch, mats, "Mobile Money", 0.9, 0.26, [signPoint.x, 0.5, signPoint.z], FACE_OUT);
  for (const du of [-0.32, 0.32]) {
    const seat = wvec(u + du, 0, d - 0.6);
    props.add("stool", placement([seat.x, 0, seat.z]));
    vendors.push({ position: seat.setY(0.02), yaw: FACE_OUT, mode: "sitTalk", seat: 0.43, look: "agent" });
  }
  vendors.push({ position: wvec(u + 0.2, 0.02, d + 0.75), yaw: FACE_OUT + Math.PI, mode: "talk" });
  const a = wvec(u - 0.6, 0, d - 0.35);
  const b = wvec(u + 0.6, 0, d + 0.35);
  addCollider(a.x, a.z, b.x, b.z);
}

function buildKiosk(batch, mats, vendors, scene) {
  /** Build the gadget kiosk on the short wall: a wooden stand with a glass case of watches, earphones, chargers and phone cases. */
  const m = mats.world.materials;
  const u = WEST.corner + 2.1;
  const d = 1.0;
  const gadgets = GADGETS.map((color) => new THREE.MeshLambertMaterial({ color }));
  wbox(batch, [1.8, 0.8, 0.6], [u, 0.4, d], m.planksDark);
  for (let i = 0; i < 14; i += 1) {
    const size = i % 3 === 0 ? [0.08, 0.02, 0.08] : i % 3 === 1 ? [0.1, 0.03, 0.06] : [0.13, 0.015, 0.07];
    wbox(batch, size, [u - 0.75 + (i % 7) * 0.25, 0.82, d - 0.12 + Math.floor(i / 7) * 0.22], gadgets[i % gadgets.length]);
  }
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.32, 1.8), new THREE.MeshLambertMaterial({ color: 0xdfeef6, transparent: true, opacity: 0.3 }));
  glass.position.copy(wvec(u, 0.96, d));
  scene.add(glass);
  for (const du of [-0.85, 0.85]) wbox(batch, [0.04, 1.3, 0.04], [u + du, 1.45, d - 0.25], m.steelDark);
  const board = wvec(u, 2.0, d - 0.22);
  sign(batch, mats, "Phone Accessories", 1.8, 0.4, [board.x, 2.0, board.z], FACE_OUT);
  const a = wvec(u - 0.95, 0, 0.3);
  const b = wvec(u + 0.95, 0, d + 0.35);
  addCollider(a.x, a.z, b.x, b.z);
  vendors.push({ position: wvec(u + 0.2, 0.02, 0.6), yaw: FACE_OUT, mode: "talk" });
  vendors.push({ position: wvec(u - 0.4, 0.02, d + 0.75), yaw: FACE_OUT + Math.PI, mode: "idle" });
  vendors.push({ position: wvec(u + 0.55, 0.02, d + 0.8), yaw: FACE_OUT + Math.PI - 0.4, mode: "talk" });
}

function buildApron(batch, mats, props, vendors, riders, umbrellas, scene) {
  /** Furnish the main gate end: short wall kiosk, mobile money agents, porters, the gate crowd, trough, tank, moto stage and billboard. */
  const gateU = LAYOUT.mainGate.z;
  const high = gateU + LAYOUT.mainGate.width / 2;
  buildKiosk(batch, mats, vendors, scene);
  agentStall(batch, mats, props, vendors, umbrellas, gateU - 7.2, 4.2);
  agentStall(batch, mats, props, vendors, umbrellas, gateU - 3.9, 6.3);
  const troughU = high + 4.0;
  const trough = buildTrough(batch, mats, scene, troughU, 0.3 + WALKWAY);
  buildTank(batch, mats, trough, troughU + 3.5);
  const stage = [];
  for (let row = 0; row < 2; row += 1) for (let i = 0; i < 7; i += 1) stage.push(WEST.point(troughU + 5.6 + i * 1.05, 1.4 + row * 3.0));
  buildMotoRow(batch, stage, Math.atan2(WEST.out[1], -WEST.out[0]), riders, 0.6);
  const sa = wvec(troughU + 5.0, 0, 0.3);
  const sb = wvec(troughU + 12.5, 0, 5.0);
  addCollider(sa.x, sa.z, sb.x, sb.z);
  wcrowd(vendors, [[troughU + 13.3, 2.4, -1.8], [troughU + 14.0, 3.2, 2.6], [troughU + 13.1, 4.0, 0.9], [troughU + 14.4, 1.9, -2.2]], "rider");
  vendors.push({ position: wvec(high - 0.8, 0.02, 1.6), yaw: FACE_OUT, mode: "present" });
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.75), new THREE.MeshLambertMaterial({ color: 0xa8e0c8, side: THREE.DoubleSide }));
  cloth.position.copy(wvec(high - 0.8, 1.08, 2.02));
  cloth.rotation.y = FACE_OUT;
  scene.add(cloth);
  wcrowd(vendors, [[high + 1.1, 4.0, -1.2], [high + 1.9, 4.6, 2.9], [high + 1.4, 5.6, 0.4], [high + 2.2, 3.4, -2.6],
    [high + 1.0, 6.6, 1.4], [high + 2.3, 6.2, -1.9], [high + 1.6, 7.6, 3.0]], "porter");
  wcrowd(vendors, [[gateU - 4.6, 7.4, 0.4], [gateU - 3.9, 7.9, 2.8], [gateU - 2.6, 4.0, -0.6], [gateU - 1.6, 3.4, 2.4],
    [gateU + 1.8, 4.4, -2.2], [gateU + 2.4, 5.0, 1.2], [gateU - 6.0, 2.0, 0.2], [gateU - 6.6, 2.8, 2.9],
    [troughU - 0.9, 4.6, 1.6], [troughU + 0.9, 5.3, -1.4], [troughU - 1.0, 6.6, 1.5], [gateU - 1.7, 6.6, 0.9],
    [gateU + 1.9, 6.9, -2.4], [gateU - 9.5, 9.5, 1.0], [gateU - 10.4, 10.2, -2.0], [gateU + 4.5, 10.5, 2.2]]);
  const billboard = wvec(troughU + 17, 0, 16.6);
  batch.cylinder(0.12, 0.14, 7.2, [billboard.x, 3.6, billboard.z], mats.pole, 8);
  addCollider(billboard.x - 0.2, billboard.z - 0.2, billboard.x + 0.2, billboard.z + 0.2);
  const face = FACE_OUT + WEST.hand * 0.7;
  box(batch, [2.5, 3.3, 0.2], [billboard.x, 6.0, billboard.z], mats.world.materials.steelDark, [0, face, 0]);
  const art = new THREE.MeshLambertMaterial({ map: signTexture("City Home Fair", { background: "#c8352e", color: "#fff3c4",
    border: "#f2c230", width: 600, height: 780, font: "900 110px Georgia, serif", subtitle: "Open every weekend" }) });
  const nx = Math.sin(face) * 0.11;
  const nz = Math.cos(face) * 0.11;
  batch.add(new THREE.PlaneGeometry(2.3, 3.1), [billboard.x + nx, 6.0, billboard.z + nz], art, [0, face, 0]);
  batch.add(new THREE.PlaneGeometry(2.3, 3.1), [billboard.x - nx, 6.0, billboard.z - nz], art, [0, face + Math.PI, 0]);
}

function buildFacade(batch, mats, props, vendors, riders, umbrellas) {
  /** Build the north long side: the yellow gabled market building with its grille front, yellow awning on grey pillars, sign and banner. */
  const m = mats.world.materials;
  const z = B.north;
  const o = -1;
  const out = (k) => z + o * k;
  const u0 = B.west - 0.3;
  const u1 = B.east + 0.15;
  const length = u1 - u0;
  const middle = (u0 + u1) / 2;
  const { x: gx, opening } = LAYOUT.facadeGate;
  for (const [a, b] of [[u0, gx - opening / 2], [gx + opening / 2, u1]]) {
    const run = b - a;
    solid(batch, [run, 0.35, 0.3], [(a + b) / 2, 0.18, out(0.15)], m.plasterYellow);
    box(batch, [run, 0.1, 0.1], [(a + b) / 2, 2.85, out(0.15)], m.steelDark);
    for (let x = a + 0.1; x < b; x += 0.16) box(batch, [0.03, 2.5, 0.03], [x, 1.6, out(0.15)], m.steelDark);
  }
  box(batch, [length, 3.0, 0.25], [middle, 4.5, out(0.1)], m.corrYellow);
  box(batch, [length + 0.3, 0.05, 3.9], [middle, 3.15, out(1.9)], m.corrYellow, [o * Math.atan2(0.5, 3.6), 0, 0]);
  box(batch, [length + 0.3, 0.25, 0.08], [middle, 2.86, out(3.75)], m.corrYellow);
  for (let x = u0 + 0.2; x <= u1; x += 4.4) solid(batch, [0.22, 2.9, 0.22], [x, 1.45, out(3.55)], m.steel);
  box(batch, [length, 0.08, 3.6], [middle, 0.04, out(1.9)], m.concrete);
  box(batch, [length, 0.22, 0.5], [middle, 0.11, out(3.95)], m.concreteDark);
  box(batch, [length, 0.06, 0.6], [middle, 0.03, out(4.5)], m.steelDark);
  const gables = 13;
  const step = length / gables;
  const roofSlope = Math.atan2(2.4, step / 2);
  const roofLength = Math.hypot(2.4, step / 2) + 0.15;
  for (let i = 0; i < gables; i += 1) {
    const a = u0 + i * step;
    const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(step, 0), new THREE.Vector2(step / 2, 2.4)]);
    batch.add(new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false }), [a, 6.0, z - 0.2], m.corrYellow);
    for (const side of [-1, 1]) {
      batch.add(new THREE.BoxGeometry(roofLength, 0.05, 3.4), [a + step / 2 + side * step / 4, 7.2, out(-1.5)], m.corrYellow, [0, 0, -side * roofSlope]);
    }
    box(batch, [0.4, 6, 0.4], [a, 3, out(0.05)], m.corrYellow);
  }
  const signMaterial = new THREE.MeshLambertMaterial({ map: signTexture("KIMIRONKO MARKET", { background: "#1d5b3a", color: "#fff3c4",
    border: "#f2c14e", width: 1024, height: 170, font: "900 120px Georgia, serif" }) });
  batch.add(new THREE.PlaneGeometry(6.4, 1.06), [gx, 4.6, out(0.25)], signMaterial, [0, Math.PI, 0]);
  batch.add(new THREE.PlaneGeometry(6.4, 1.06), [gx, 4.6, out(-0.05)], signMaterial);
  const banner = new THREE.MeshLambertMaterial({ map: bannerTexture("Murakaza neza") });
  batch.add(new THREE.PlaneGeometry(4.2, 0.8), [gx, 2.35, out(3.73)], banner, [0, Math.PI, 0]);
  batch.add(new THREE.PlaneGeometry(4.2, 0.8), [gx, 2.35, out(3.71)], banner);
  const rank = [];
  for (let i = 0; i < 9; i += 1) rank.push([8 + i * 1.05, out(7.4)]);
  for (let i = 0; i < 6; i += 1) rank.push([-24 + i * 1.05, out(7.4)]);
  buildMotoRow(batch, rank, Math.PI / 2, riders, 0.5);
  addCollider(7.4, out(8.1), 17.6, out(6.7));
  addCollider(-24.6, out(8.1), -18.2, out(6.7));
  umbrellaStall(batch, props, vendors, umbrellas, [27, out(6.6)], [0xf6f3ec, 0xf2c230], Math.PI);
  umbrellaStall(batch, props, vendors, umbrellas, [42, out(6.6)], [0xd62828, 0xd62828, 0xf6f3ec], Math.PI);
  const flip = (yaw) => Math.PI - yaw;
  crowd(vendors, [[gx - 3.6, out(2.2), flip(0.4)], [gx - 2.8, out(2.6), flip(2.6)], [gx + 3.0, out(1.6), flip(-1.2)], [gx + 3.8, out(2.4), flip(2.0)],
    [gx - 5.6, out(5.4), flip(1.0)], [gx + 5.2, out(5.6), flip(-2.0)], [gx - 1.8, out(5.9), flip(0.3)], [gx + 2.2, out(6.2), flip(2.8)],
    [6, out(2.0), flip(0.6)], [6.8, out(2.5), flip(-2.4)], [33, out(2.2), flip(1.4)], [33.7, out(1.6), flip(-1.6)]]);
}

function buildBusPark(batch, mats, props, vendors) {
  /** Build the dated bus park across the south dirt road: a plain wall facing the market, old fences, its entrance on the east road, coaches, a shelter and booths. */
  const m = mats.world.materials;
  const { x0, x1, z0, z1, gateZ, gateWidth } = LAYOUT.busPark;
  const faded = [];
  const low = gateZ - gateWidth / 2;
  const high = gateZ + gateWidth / 2;
  box(batch, [x1 - x0, 0.06, z1 - z0], [(x0 + x1) / 2, 0.03, (z0 + z1) / 2], m.concreteDark);
  box(batch, [R.east - ROAD_HALF - x1, 0.05, gateWidth + 2], [(x1 + R.east - ROAD_HALF) / 2, 0.025, gateZ], m.asphalt);
  const run = (ax, az, bx, bz) => {
    const length = Math.hypot(bx - ax, bz - az);
    const angle = Math.atan2(-(bz - az), bx - ax);
    const base = new THREE.Matrix4().makeRotationY(angle).setPosition(ax, 0, az);
    batch.addMatrix(new THREE.BoxGeometry(length, 0.6, 0.25).translate(length / 2, 0.3, 0), base, m.concreteDark);
    batch.addMatrix(new THREE.BoxGeometry(length, 0.07, 0.07).translate(length / 2, 2.4, 0), base, mats.fadedGreen);
    for (let t = 0.1; t < length; t += 0.18) bar(faded, base, t, 0.6, 1.8);
    for (let t = 0; t <= length; t += 3) batch.addMatrix(new THREE.BoxGeometry(0.12, 2.5, 0.12).translate(t, 1.25, 0), base, mats.rust);
    addCollider(Math.min(ax, bx) - 0.15, Math.min(az, bz) - 0.15, Math.max(ax, bx) + 0.15, Math.max(az, bz) + 0.15);
  };
  const west = R.west + ROAD_HALF + 0.6;
  solid(batch, [x1 - west, 2.6, 0.3], [(west + x1) / 2, 1.3, z0], m.plasterCream);
  box(batch, [x1 - west + 0.1, 0.12, 0.42], [(west + x1) / 2, 2.66, z0], mats.fadedGreen);
  for (let x = west + 4; x < x1; x += 8) box(batch, [0.42, 2.72, 0.42], [x, 1.36, z0], m.plasterCream);
  run(x1, z0, x1, low - 0.4);
  run(x1, high + 0.4, x1, gateZ + 6.3);
  run(x1, gateZ + 7.9, x1, z1);
  run(x0, z1, x1, z1);
  run(x0, z0, x0, z1);
  for (const z of [low - 0.4, high + 0.4]) {
    solid(batch, [0.7, 5.2, 0.7], [x1, 2.6, z], m.concrete);
    box(batch, [0.8, 0.2, 0.8], [x1, 5.3, z], mats.fadedGreen);
  }
  box(batch, [0.5, 0.9, gateWidth + 1.4], [x1, 5.0, gateZ], mats.fadedGreen);
  sign(batch, mats, "Bus Park", 5.2, 0.8, [x1 + 0.27, 5.0, gateZ], Math.PI / 2);
  sign(batch, mats, "Bus Park", 5.2, 0.8, [x1 - 0.27, 5.0, gateZ], -Math.PI / 2);
  gateLeaf(batch, faded, mats, { x: x1 - 0.2, z: low - 0.1 }, Math.atan2(0.25, -0.97), gateWidth / 2 - 0.2, 2.4, 0.9, mats.fadedGreen);
  gateLeaf(batch, faded, mats, { x: x1 - 0.2, z: high + 0.1 }, Math.atan2(-0.25, -0.97), gateWidth / 2 - 0.2, 2.4, 0.9, mats.fadedGreen);
  const shelterZ = z1 - 4.5;
  for (let x = 40; x <= 58; x += 4.3) for (const dz of [-2.6, 2.6]) {
    box(batch, [0.12, 3.2, 0.12], [x, 1.6, shelterZ + dz], m.steel);
    addCollider(x - 0.1, shelterZ + dz - 0.1, x + 0.1, shelterZ + dz + 0.1);
  }
  box(batch, [20.5, 0.05, 6.4], [49.1, 3.25, shelterZ], m.corrGrey, [-0.06, 0, 0]);
  for (let x = 41.5; x < 57; x += 4.3) {
    box(batch, [3.0, 0.08, 0.5], [x + 0.6, 0.48, shelterZ + 1.6], m.planks);
    box(batch, [3.0, 0.42, 0.08], [x + 0.6, 0.24, shelterZ + 1.6], m.planksDark);
    vendors.push({ position: new THREE.Vector3(x, 0.02, shelterZ + 1.6), yaw: Math.PI, mode: "sit", seat: 0.48 });
    vendors.push({ position: new THREE.Vector3(x + 1.3, 0.02, shelterZ - 0.4), yaw: 0.3 * (Math.round(x) % 2 ? 1 : -1), mode: Math.round(x) % 3 ? "talk" : "idle" });
  }
  for (const bx of [52, 60]) {
    const bz = z0 + 3.2;
    solid(batch, [2.2, 2.6, 2.0], [bx, 1.3, bz], m.plasterCream);
    box(batch, [2.4, 0.12, 2.2], [bx, 2.66, bz], m.corrRust);
    sign(batch, mats, "Tickets", 1.8, 0.45, [bx, 2.1, bz + 1.01], 0);
    vendors.push({ position: new THREE.Vector3(bx + 0.3, 0.02, bz + 1.7), yaw: Math.PI, mode: "talk" });
  }
  [[24, gateZ + 8.5, 0x2a6a4a], [36, gateZ + 8.5, 0x1f4e9a], [48, gateZ + 8.5, 0xc8352e], [24, gateZ + 13.5, 0xe8742c], [36, gateZ + 13.5, 0xf3f1ea]].forEach(([cx, cz, hex]) => {
    const coach = carGroup(mats.world, hex, "coach");
    coach.position.set(cx, 0, cz);
    batch.addObject(coach);
    addCollider(cx - 5.6, cz - 1.3, cx + 5.6, cz + 1.3);
  });
  for (let i = 0; i < 8; i += 1) {
    vendors.push({ position: new THREE.Vector3(62 + (i % 2) * 1.0, 0.02, gateZ + 11 + Math.floor(i / 2) * 1.4), yaw: -Math.PI / 2 + (i % 3) * 0.4, mode: i % 2 ? "talk" : "idle" });
  }
  props.add("bulb", placement([x1, 4.4, gateZ]));
  return faded;
}

function roadsideUnit(batch, mats, cx, width, index, vendors) {
  /** Dress one joined roadside shop: crow-step gable, open doorway, signboard and a notice board, facing the market across the north road. */
  const m = mats.world.materials;
  const front = B.roadsideFront;
  if (index % 4 !== 3) {
    [[0.74, 3.95], [0.48, 4.45], [0.22, 4.95]].forEach(([share, y]) => box(batch, [width * share, 0.5, 0.3], [cx, y, front - 0.15], m.plasterYellow));
  } else {
    box(batch, [width, 0.4, 0.3], [cx, 3.9, front - 0.15], m.plasterYellow);
  }
  batch.add(new THREE.PlaneGeometry(1.5, 2.45), [cx - 0.5, 1.25, front + 0.01], mats.dark);
  for (const dx of [-1.3, 0.3]) box(batch, [0.08, 2.5, 0.08], [cx + dx, 1.25, front + 0.04], m.steelDark);
  box(batch, [1.68, 0.1, 0.1], [cx - 0.5, 2.5, front + 0.04], m.steelDark);
  sign(batch, mats, SHOP_SIGNS[index % SHOP_SIGNS.length], width - 0.7, 0.62, [cx, 3.1, front + 0.03], 0);
  if (index % 2 === 0) sign(batch, mats, SHOP_SIGNS[(index + 5) % SHOP_SIGNS.length], 1.1, 0.42, [cx + 1.25, 2.0, front + 0.03], 0);
  if (index % 3 !== 1) vendors.push({ position: new THREE.Vector3(cx - 0.5, 0.02, front + 0.35), yaw: index % 2 ? -0.4 : 0.3, mode: index % 2 ? "idle" : "talk" });
}

function buildRoadside(batch, mats, vendors) {
  /** Build the roadside shops across the north road: a long row of joined yellow shops facing the market and a big painted mobile money wall. */
  const m = mats.world.materials;
  const front = B.roadsideFront;
  const back = B.roadsideBack;
  const units = [];
  for (let i = 0; i < 14; i += 1) units.push([-34 + 2.3 + i * 4.6, 4.6]);
  const wallStart = -34 + 14 * 4.6;
  const wallEnd = 52;
  for (let i = 0; i < 3; i += 1) units.push([wallEnd + 2.4 + i * 4.8, 4.8]);
  const east = wallEnd + 14.4;
  solid(batch, [east + 34, 3.7, front - back], [(east - 34) / 2, 1.85, (front + back) / 2], m.plasterYellow);
  box(batch, [east + 34.4, 0.05, front - back + 0.6], [(east - 34) / 2, 3.8, (front + back) / 2], m.corrGrey, [0.06, 0, 0]);
  units.forEach(([cx, width], index) => roadsideUnit(batch, mats, cx, width, index, vendors));
  box(batch, [east + 34.4, 0.1, 0.14], [(east - 34) / 2, 3.62, front + 0.22], m.steel);
  for (let x = -33.6; x < east; x += 9.2) box(batch, [0.08, 3.6, 0.08], [x, 1.8, front + 0.24], m.steel);
  const wallLength = wallEnd - wallStart;
  box(batch, [wallLength, 5.4, 0.3], [(wallStart + wallEnd) / 2, 2.7, front - 0.15], m.plasterYellow);
  const middle = (wallStart + wallEnd) / 2;
  const painted = (text, options, size, y) => batch.add(new THREE.PlaneGeometry(...size), [middle, y, front + 0.02], new THREE.MeshLambertMaterial({
    map: signTexture(text, { weathered: true, ...options }) }));
  painted("Murakaza neza!", { background: "#e6b12c", color: "#2b2b2b", border: "#e6b12c", width: 1024, height: 160, font: "800 96px system-ui, sans-serif" }, [6.5, 1.0], 4.55);
  painted("Mobile Money", { background: "#1f4e9a", color: "#fffaf0", border: "#fffaf0", width: 1024, height: 200, font: "900 120px system-ui, sans-serif" }, [11, 2.1], 3.1);
  painted("Send, pay and save here", { background: "#e6b12c", color: "#1f4e9a", border: "#e6b12c", width: 1024, height: 120, font: "800 80px system-ui, sans-serif" }, [8.5, 0.8], 1.6);
}

function buildRoadsideKerb(batch, props, riders, mats) {
  /** Line the shop side of the north road with cars parked nose-in, motos, bicycles and street lights. */
  const m = mats.world.materials;
  const front = B.roadsideFront;
  STATIC_PARKING.forEach((x, index) => {
    const car = carGroup(mats.world, VEHICLE_COLORS[index % VEHICLE_COLORS.length], index % 3 === 1 ? "sedan" : "hatch");
    car.position.set(x, 0, front + 2.6);
    car.rotation.y = Math.PI / 2 - (index % 2 ? 0.05 : -0.04);
    batch.addObject(car);
    addCollider(x - 1.0, front + 0.7, x + 1.0, front + 4.6);
  });
  const motos = [];
  for (const x of [-25, -24, -14.5, -13.5, -12.5, 20.3, 28.5, 40, 41.2, 46, 47.1, 63]) motos.push([x, front + 1.95]);
  buildMotoRow(batch, motos, Math.PI / 2 - 0.15, riders, 0.15);
  for (const x of [-16.5, -3.8, 18.8, 43.6, 49.5]) {
    const bike = bicycle(m);
    bike.position.set(x, 0, front + 1.9);
    bike.rotation.y = Math.PI / 2 - 0.2;
    batch.addObject(bike);
  }
  for (let x = -40; x <= 72; x += 20) {
    const z = R.north - ROAD_HALF - 0.6;
    batch.cylinder(0.07, 0.09, 6.5, [x, 3.25, z], m.steelDark, 6);
    box(batch, [0.08, 0.08, 1.5], [x, 6.45, z + 0.7], m.steelDark);
    props.add("bulb", placement([x, 6.3, z + 1.4], null, [1.6, 1, 1.6]));
  }
}

function bicycle(m) {
  /** Return a simple bicycle: two wheels, a frame, a seat and handlebars. */
  const group = new THREE.Group();
  const add = (geometry, material, position, rotation = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    group.add(mesh);
  };
  for (const x of [-0.5, 0.5]) add(new THREE.TorusGeometry(0.33, 0.025, 4, 14), m.tyre, [x, 0.34, 0]);
  add(new THREE.BoxGeometry(0.9, 0.04, 0.04), m.red, [0, 0.6, 0], [0, 0, 0.15]);
  add(new THREE.BoxGeometry(0.04, 0.5, 0.04), m.red, [-0.15, 0.55, 0], [0, 0, -0.3]);
  add(new THREE.BoxGeometry(0.22, 0.05, 0.1), m.black, [-0.25, 0.85, 0]);
  add(new THREE.BoxGeometry(0.04, 0.04, 0.5), m.steel, [0.45, 0.95, 0]);
  return group;
}

function poleLine(batch, mats, points, wires) {
  /** Stand wooden utility poles at points and sag three power lines between each pair. */
  points.forEach(([x, z]) => {
    batch.cylinder(0.11, 0.14, 8.2, [x, 4.1, z], mats.wood, 7);
    box(batch, [1.4, 0.1, 0.1], [x, 7.6, z], mats.wood);
    addCollider(x - 0.18, z - 0.18, x + 0.18, z + 0.18);
  });
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x0, z0] = points[i];
    const [x1, z1] = points[i + 1];
    for (const [offset, y] of [[-0.6, 7.65], [0, 7.65], [0.6, 7.65]]) {
      const along = new THREE.Vector2(x1 - x0, z1 - z0).normalize();
      const ox = -along.y * offset;
      const oz = along.x * offset;
      for (let s = 0; s < 12; s += 1) {
        for (const t of [s / 12, (s + 1) / 12]) wires.push(x0 + (x1 - x0) * t + ox, y - Math.sin(Math.PI * t) * 0.8, z0 + (z1 - z0) * t + oz);
      }
    }
  }
}

function buildPoles(batch, mats, scene) {
  /** Run utility poles and sagging power lines along the tarred roads (none along the dirt road). */
  const wires = [];
  const line = (from, to, step, fixed, alongX) => {
    const points = [];
    for (let v = from; v <= to; v += step) points.push(alongX ? [v, fixed] : [fixed, v]);
    poleLine(batch, mats, points, wires);
  };
  line(-44, 70, 23, R.north + ROAD_HALF + 0.4, true);
  line(-26, 42, 17, R.east - ROAD_HALF - 0.5, false);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(wires, 3));
  const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x1c1c1c }));
  scene.add(lines);
  return lines;
}

function dirtRoad(batch, mats, z, span) {
  /** Lay the south road as rough packed earth: no tar or markings, just wheel ruts and potholes. */
  box(batch, [span, 0.04, R.width + 0.8], [0, 0.02, z], mats.dirt);
  for (const dz of [-1.7, 1.7]) box(batch, [span, 0.045, 0.55], [0, 0.0225, z + dz], mats.rut);
  for (let i = 0; i < 40; i += 1) {
    const x = -110 + seeded(i, 61) * 220;
    if (Math.abs(x - R.west) < 5 || Math.abs(x - R.east) < 5) continue;
    box(batch, [0.8 + seeded(i, 62) * 1.6, 0.047, 0.6 + seeded(i, 63) * 1.1], [x, 0.0235, z + (seeded(i, 64) - 0.5) * 4.6], mats.rut);
  }
}

function buildRoads(batch, mats) {
  /** Lay an asphalt road on all four sides of the block, with centre dashes and zebra crossings at the gates. */
  const m = mats.world.materials;
  const span = 300;
  const crossings = [R.west, R.east];
  const rows = [R.north, R.south];
  for (const z of rows) {
    if (z === R.south) {
      dirtRoad(batch, mats, z, span);
      continue;
    }
    box(batch, [span, 0.05, R.width], [0, 0.025, z], m.asphalt);
    for (let x = -148; x < 150; x += 6) if (crossings.every((c) => Math.abs(x - c) > 5)) box(batch, [2.6, 0.06, 0.15], [x, 0.04, z], m.cream);
  }
  for (const x of crossings) {
    box(batch, [R.width, 0.05, span], [x, 0.025, 0], m.asphalt);
    for (let z = -148; z < 150; z += 6) if (rows.every((r) => Math.abs(z - r) > 5)) box(batch, [0.15, 0.06, 2.6], [x, 0.04, z], m.cream);
  }
  const zebra = (x, z, alongX) => {
    for (let i = -3; i <= 3; i += 1) {
      if (alongX) box(batch, [0.5, 0.061, R.width - 0.6], [x + i * 0.9, 0.045, z], m.cream);
      else box(batch, [R.width - 0.6, 0.061, 0.5], [x, 0.045, z + i * 0.9], m.cream);
    }
  };
  zebra(LAYOUT.facadeGate.x, R.north, true);
  zebra(R.west, LAYOUT.mainGate.z, false);
  zebra(10, R.north, true);
  const z0 = R.north + ROAD_HALF;
  const z1 = R.south - ROAD_HALF;
  box(batch, [0.6, 0.24, z1 - z0], [R.west + ROAD_HALF + 0.3, 0.12, (z0 + z1) / 2], m.concreteDark);
  box(batch, [0.6, 0.24, z1 - z0], [R.west - ROAD_HALF - 0.3, 0.12, (z0 + z1) / 2], m.concreteDark);
  box(batch, [5.5, 0.18, z1 - z0], [R.west - ROAD_HALF - 3.35, 0.09, (z0 + z1) / 2], m.concrete);
}

function building(batch, mats, frontX, frontZ, width, depth, floors, facing, alongX, index) {
  /** Queue one plain commercial building facing a road, with an open ground floor, a sign and windows. */
  const m = mats.world.materials;
  const height = floors * 3.4 + 0.5;
  const wall = m[BUILDING_COLORS[index % BUILDING_COLORS.length]];
  const cx = alongX ? frontX : frontX + facing * depth / 2;
  const cz = alongX ? frontZ + facing * depth / 2 : frontZ;
  const size = alongX ? [width - 0.3, height, depth] : [depth, height, width - 0.3];
  batch.add(new THREE.BoxGeometry(...size), [cx, height / 2, cz], wall);
  addCollider(cx - size[0] / 2, cz - size[2] / 2, cx + size[0] / 2, cz + size[2] / 2);
  const turn = alongX ? (facing > 0 ? Math.PI : 0) : (facing > 0 ? -Math.PI / 2 : Math.PI / 2);
  const out = -facing * 0.03;
  const at = (along, y) => (alongX ? [frontX + along, y, frontZ + out] : [frontX + out, y, frontZ + along]);
  batch.add(new THREE.PlaneGeometry(width - 1.4, 2.6), at(0, 1.35), mats.dark, [0, turn, 0]);
  sign(batch, mats, SHOP_SIGNS[(index * 7) % SHOP_SIGNS.length], Math.min(width - 1.6, 5.5), 0.7, at(0, 3.0), turn);
  for (let floor = 1; floor < floors; floor += 1) {
    for (let w = -width / 2 + 1.4; w < width / 2 - 1; w += 2.3) batch.add(new THREE.PlaneGeometry(1.2, 1.4), at(w, floor * 3.4 + 1.6), m.glass, [0, turn, 0]);
  }
}

function buildRow(batch, mats, { alongX, line, from, to, facing, skip, seed }) {
  /** Line one far side of a road with buildings of varied width and height, leaving gaps at crossing roads. */
  let at = from;
  let index = seed;
  while (at < to) {
    const width = 8 + seeded(index, 1) * 6;
    const blocked = skip.some(([a, b]) => at + width > a && at < b);
    if (blocked) {
      const hit = skip.find(([a, b]) => at + width > a && at < b);
      at = hit[1] + 0.5;
      continue;
    }
    const floors = 1 + Math.floor(seeded(index, 2) * 3);
    building(batch, mats, alongX ? at + width / 2 : line, alongX ? line : at + width / 2, width, 9, floors, facing, alongX, index);
    at += width;
    index += 1;
  }
}

function buildFarSide(world, mats) {
  /** Build everything across the roads into its own batch, so Low quality can drop it as far-side detail. */
  const batch = new StaticBatch(world);
  buildRow(batch, mats, { alongX: true, line: R.north - ROAD_HALF - 3, from: -70, to: 110, facing: -1, seed: 3,
    skip: [[R.west - 6, R.west + 6], [-37, 69], [R.east - 6, R.east + 6]] });
  buildRow(batch, mats, { alongX: true, line: R.south + ROAD_HALF + 2.5, from: -70, to: 110, facing: 1, seed: 17,
    skip: [[R.west - 6, R.east + 6]] });
  buildRow(batch, mats, { alongX: false, line: R.east + ROAD_HALF + 3, from: -70, to: 95, facing: 1, seed: 29,
    skip: [[R.north - 6, R.north + 6], [R.south - 6, R.south + 6]] });
  const meshes = batch.build(world.scene, { cast: false });
  for (const mesh of meshes) mesh.userData.detail = true;
  return meshes;
}

function barMesh(world, matrices, material) {
  /** Draw a set of fence or gate bars as one instanced mesh. */
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 1, 0.035).translate(0, 0.5, 0), material, matrices.length);
  matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.castShadow = true;
  world.scene.add(mesh);
  return mesh;
}

export function buildPerimeter(world, batch, props, vendors, riders) {
  /** Close the market block with gates, walls and fences, roadside shops, roads, poles and the buildings across the roads. */
  const mats = materials(world);
  const bars = [];
  const umbrellas = [];
  buildRoads(batch, mats);
  buildGateWall(batch, bars, mats);
  buildFacade(batch, mats, props, vendors, riders, umbrellas);
  buildSouthWall(batch, bars, mats, props);
  buildSouthGateMotos(batch, vendors, riders);
  buildEastFence(batch, bars, mats);
  buildEastSide(batch, mats, vendors);
  buildApron(batch, mats, props, vendors, riders, umbrellas, world.scene);
  buildRoadside(batch, mats, vendors);
  buildRoadsideKerb(batch, props, riders, mats);
  for (const [x, z, colors] of [[69.4, -4.6, [0xd62828, 0xf2c230]], [69.0, 7.2, [0xf2c230, 0xf2c230, 0xfff1a8]]]) {
    umbrellaStall(batch, props, vendors, umbrellas, [x, z], colors, Math.PI / 2);
  }
  buildMotoRow(batch, [[69.2, 4.0], [69.4, 5.0], [69.1, 9.4], [69.3, 10.4], [69.4, 11.4], [69.2, 12.4]], 0.3, riders, 0.6);
  crowd(vendors, [[67.6, -3.4, 1.4], [68.3, -4.2, -2.0], [67.5, -5.0, 0.6], [68.9, -3.0, 2.6], [67.4, 4.0, 1.9], [68.1, 4.6, -1.2]]);

  const faded = buildBusPark(batch, mats, props, vendors);
  const bars3 = barMesh(world, bars, mats.blue);
  barMesh(world, faded, mats.fadedGreen);
  const umbrellaMesh = new THREE.Mesh(mergeGeometries(umbrellas),
    new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  umbrellaMesh.castShadow = true;
  world.scene.add(umbrellaMesh);
  const wires = buildPoles(batch, mats, world.scene);
  const far = buildFarSide(world, mats);
  return { wires, far, bars: bars3 };
}
