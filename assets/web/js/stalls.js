import * as THREE from "three";
import { mergeGeometries } from "three/addons/BufferGeometryUtils.js";
import { addCollider, seeded } from "./layout.js";
import { addSway } from "./world.js";
import { counterPrintTexture, kitengeTexture, signTexture, wovenTexture } from "./textures.js";

const BASIN_COLORS = [0xd62828, 0x1f6fb5, 0x2a9d4a, 0xf2c230, 0xe8742c, 0x7a4b9a, 0x1aa3a3, 0xf06292];
const CLOTH_COLORS = [0xf3f1ec, 0x2b3550, 0x3d5a80, 0xc8352e, 0xf2c14e, 0x3f9b4a, 0x9cc3e4, 0xe58fb0, 0x6b6b3a, 0x8e8e8e,
  0x1c1c1c, 0xe8742c, 0x7a4b9a, 0xa38d6a];
const BAG_COLORS = [0x1c1c1c, 0x2a3f6b, 0xc8352e, 0x7a4b9a, 0xe58fb0, 0x2a9d8f, 0x3d5a80, 0x6b6b3a, 0xf2a51e, 0x5b3f8c, 0x8e2a3a];
const SHOE_COLORS = [0x1c1c1c, 0x5a3a22, 0xf3f1ec, 0x8e2a3a, 0x2a3f6b, 0xc9935e];
const NEIGHBOUR_NAMES = {
  plastics: ["Mukamana Plastics", "Basins & Buckets"], oil: ["Uwase Oil & Jerrycans", "Cooking Oil Depot"],
  bags: ["Jean Paul Bags", "School Bags Corner"], clothes: ["Second Hand Wear", "Caguwa Clothes"],
  kitenge: ["Uwera Kitenge & Tailoring", "Imyenda Fabrics"], shoes: ["Shoe Palace", "Inkweto Shoes"],
  produce: ["Fresh Vegetables", "Imboga Nziza"], grains: ["Beans & Maize", "Ibishyimbo"], household: ["Mats & Brooms", "Home Things"],
  fruit: ["Imbuto Fruits", "Pineapple Corner"],
};

const matrix = new THREE.Matrix4();
const euler = new THREE.Euler(0, 0, 0, "YXZ");
const color = new THREE.Color();

export class Props {
  /** Collect many copies of small goods per kind and draw each kind as one instanced mesh. */

  constructor(world) {
    /** Start an empty registry for a world. */
    this.world = world;
    this.kinds = new Map();
  }

  define(name, geometry, material, options = {}) {
    /** Declare a kind of prop with its geometry, material and options (shadow casting, detail level). */
    this.kinds.set(name, { geometry, material, options, matrices: [], colors: [] });
  }

  add(name, worldMatrix, hex = null) {
    /** Place one copy of a kind with an optional colour. */
    const kind = this.kinds.get(name);
    kind.matrices.push(worldMatrix.clone());
    kind.colors.push(hex);
  }

  build() {
    /** Create one instanced mesh per kind that has copies, and return them by name. */
    const meshes = {};
    for (const [name, kind] of this.kinds) {
      if (!kind.matrices.length) continue;
      const mesh = new THREE.InstancedMesh(kind.geometry, kind.material, kind.matrices.length);
      kind.matrices.forEach((m, index) => {
        mesh.setMatrixAt(index, m);
        if (kind.colors.some((hex) => hex !== null)) mesh.setColorAt(index, color.setHex(kind.colors[index] ?? 0xffffff));
      });
      mesh.castShadow = kind.options.cast === true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      mesh.userData.detail = Boolean(kind.options.detail);
      this.world.scene.add(mesh);
      meshes[name] = mesh;
    }
    return meshes;
  }
}

export class StallFrame {
  /** A stall's local frame: x along its front, z inward from the front edge, facing +z or -z in the world. */

  constructor(x, front, facing) {
    /** Place a frame at a front edge, facing +1 (front looks to +z) or -1 (front looks to -z). */
    this.x = x;
    this.front = front;
    this.facing = facing;
  }

  m(lx, ly, lz, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    /** Return the world matrix of a local position, rotation and scale. */
    euler.set(rx, ry + (this.facing > 0 ? 0 : Math.PI), rz);
    matrix.makeRotationFromEuler(euler);
    matrix.scale(new THREE.Vector3(sx, sy, sz));
    matrix.setPosition(this.x + lx * this.facing, ly, this.front - lz * this.facing);
    return matrix.clone();
  }

  point(lx, ly, lz) {
    /** Return the world position of a local point. */
    return new THREE.Vector3(this.x + lx * this.facing, ly, this.front - lz * this.facing);
  }

  yawOut() {
    /** Return the yaw of someone in the stall looking out over the counter. */
    return this.facing > 0 ? 0 : Math.PI;
  }
}

function heapGeometry(count, radius, height, size, colors, seed, stretch = 1) {
  /** Merge many small irregular pieces of produce into one heap, coloured per piece. */
  const pieces = [];
  const base = new THREE.IcosahedronGeometry(size, 0);
  for (let i = 0; i < count; i += 1) {
    const a = seeded(i, seed) * Math.PI * 2;
    const r = Math.sqrt(seeded(i, seed + 1)) * radius;
    const y = (1 - r / radius) * height + size * 0.6;
    const g = base.clone();
    g.scale(stretch * (0.8 + seeded(i, seed + 2) * 0.4), 0.8 + seeded(i, seed + 3) * 0.3, 0.85 + seeded(i, seed + 4) * 0.3);
    g.rotateY(seeded(i, seed + 5) * 6.28);
    g.translate(Math.cos(a) * r, y, Math.sin(a) * r);
    const hex = colors[Math.floor(seeded(i, seed + 6) * colors.length)];
    pieces.push(paint(g, hex, 0.12, i + seed));
  }
  return mergeGeometries(pieces);
}

function paint(geometry, hex, jitter = 0, salt = 0) {
  /** Give a geometry a vertex colour, slightly varied so piles do not look flat. */
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  color.setHex(hex);
  const shade = 1 - jitter / 2 + seeded(salt, 9) * jitter;
  const array = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < array.length; i += 3) array.set([color.r * shade, color.g * shade, color.b * shade], i);
  g.setAttribute("color", new THREE.BufferAttribute(array, 3));
  return g;
}

function hanging(geometry, drop) {
  /** Move a geometry so its top edge is the pivot it swings from. */
  return geometry.translate(0, -drop / 2, 0);
}

export function defineProps(props, world) {
  /** Declare every kind of goods and fitting used by the stalls and the hall. */
  const m = world.materials;
  const vertex = m.vertex;
  const plain = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const sway = addSway(new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), world, 0.09);
  const swayBags = addSway(new THREE.MeshLambertMaterial({ color: 0xffffff }), world, 0.05);
  const woven = new THREE.MeshLambertMaterial({ map: wovenTexture(), side: THREE.DoubleSide });
  props.define("basin", mergeGeometries([new THREE.CylinderGeometry(0.32, 0.21, 0.15, 14, 1, true).translate(0, 0.075, 0),
    new THREE.CircleGeometry(0.21, 14).rotateX(-Math.PI / 2).translate(0, 0.005, 0)]), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), { cast: true });
  props.define("bucket", mergeGeometries([new THREE.CylinderGeometry(0.15, 0.12, 0.3, 10).translate(0, 0.15, 0),
    new THREE.TorusGeometry(0.15, 0.008, 3, 10, Math.PI).translate(0, 0.3, 0)]), plain);
  props.define("jerrycan", mergeGeometries([new THREE.BoxGeometry(0.24, 0.34, 0.15).translate(0, 0.17, 0),
    new THREE.BoxGeometry(0.12, 0.05, 0.04).translate(-0.02, 0.37, 0), new THREE.CylinderGeometry(0.03, 0.03, 0.05, 6).translate(0.08, 0.37, 0)]), plain, { cast: true });
  props.define("bottle", mergeGeometries([new THREE.CylinderGeometry(0.045, 0.045, 0.22, 7).translate(0, 0.11, 0),
    new THREE.CylinderGeometry(0.015, 0.04, 0.07, 6).translate(0, 0.255, 0)]), plain, { cast: false, detail: true });
  props.define("backpack", hanging(mergeGeometries([new THREE.BoxGeometry(0.3, 0.38, 0.14), new THREE.BoxGeometry(0.22, 0.16, 0.05).translate(0, -0.08, 0.09)]), 0.38), swayBags);
  props.define("shirt", hanging(new THREE.PlaneGeometry(0.5, 0.68), 0.68), sway, { cast: false });
  props.define("trousers", hanging(new THREE.PlaneGeometry(0.42, 0.95), 0.95), sway, { cast: false });
  props.define("fold", new THREE.BoxGeometry(0.36, 0.055, 0.28).translate(0, 0.0275, 0), plain, { cast: false });
  props.define("shoe", new THREE.BoxGeometry(0.1, 0.07, 0.25).translate(0, 0.035, 0), plain, { cast: false, detail: true });
  for (let v = 0; v < 6; v += 1) {
    props.define(`fabric${v}`, hanging(new THREE.PlaneGeometry(0.85, 1.9), 1.9), addSway(new THREE.MeshLambertMaterial({ map: kitengeTexture(v),
      side: THREE.DoubleSide }), world, 0.05), { cast: false });
    props.define(`roll${v}`, new THREE.CylinderGeometry(0.11, 0.11, 1.0, 9).rotateZ(Math.PI / 2),
      new THREE.MeshLambertMaterial({ map: kitengeTexture(v) }), { cast: false, detail: true });
  }
  props.define("potatoes", heapGeometry(100, 0.95, 0.55, 0.088, [0xc98a4b, 0xb9783e, 0xd49a5a, 0xa86a35], 1), vertex);
  props.define("tomatoes", heapGeometry(70, 0.42, 0.3, 0.06, [0xd62828, 0xc81d1d, 0xe63b2e, 0xe8742c], 2), vertex);
  props.define("onions", heapGeometry(60, 0.4, 0.28, 0.06, [0x9b2c4a, 0xb33a5a, 0x8a2440, 0xc28a5a], 3), vertex);
  props.define("sweetPotatoes", heapGeometry(55, 0.5, 0.3, 0.08, [0xa8463a, 0x9a3e36, 0xb8584a], 4, 1.8), vertex);
  props.define("carrots", heapGeometry(50, 0.36, 0.2, 0.05, [0xe8742c, 0xf08a32], 5, 2.6), vertex);
  props.define("avocados", heapGeometry(40, 0.38, 0.26, 0.07, [0x2f4a22, 0x3a5a28, 0x243a1a], 6, 1.2), vertex);
  props.define("oranges", heapGeometry(45, 0.38, 0.28, 0.065, [0xf28c28, 0xe8a030, 0x9ac040], 7), vertex);
  props.define("peppers", heapGeometry(45, 0.36, 0.22, 0.055, [0x3a9a3a, 0x2f8a2f, 0xd62828], 8), vertex);
  props.define("beets", heapGeometry(45, 0.36, 0.25, 0.065, [0x7a1f3a, 0x8a2a4a, 0x6a1a30], 9), vertex);
  props.define("cassava", heapGeometry(26, 0.5, 0.25, 0.07, [0x7a4a2a, 0x8a5a36, 0x6a3e22], 10, 4), vertex);
  props.define("watermelon", new THREE.SphereGeometry(0.2, 10, 7).scale(1.25, 0.95, 0.95).translate(0, 0.18, 0), plain);
  props.define("pineapple", mergeGeometries([paint(new THREE.SphereGeometry(0.1, 8, 6).scale(1, 1.5, 1).translate(0, 0.15, 0), 0xc98a2a),
    paint(new THREE.ConeGeometry(0.08, 0.2, 6).translate(0, 0.38, 0), 0x3a7a2a)]), vertex);
  props.define("bananas", mergeGeometries(Array.from({ length: 14 }, (_, i) => paint(new THREE.CylinderGeometry(0.03, 0.025, 0.24, 5)
    .rotateZ(0.9).rotateY((i / 14) * Math.PI * 2).translate(Math.cos(i) * 0.1, 0.12 + (i % 3) * 0.08, Math.sin(i) * 0.1), 0x4f8a2a, 0.2, i))
    .concat([paint(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 5).translate(0, 0.2, 0), 0x6a5a2a)])), vertex);
  props.define("sackBody", new THREE.CylinderGeometry(0.24, 0.27, 0.55, 10).translate(0, 0.275, 0), new THREE.MeshLambertMaterial({ color: 0xe6dcc4 }), { cast: true });
  props.define("grainTop", new THREE.SphereGeometry(0.23, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.35, 1).translate(0, 0.55, 0), plain, { cast: false });
  props.define("tub", mergeGeometries([paint(new THREE.CylinderGeometry(0.2, 0.17, 0.32, 12, 1, true).translate(0, 0.16, 0), 0xf3f3f0),
    paint(new THREE.CircleGeometry(0.195, 12).rotateX(-Math.PI / 2).translate(0, 0.27, 0), 0x9a2a2a)]),
  new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  props.define("basket", new THREE.CylinderGeometry(0.42, 0.3, 0.32, 12, 1, true).translate(0, 0.16, 0), woven);
  props.define("tray", new THREE.CylinderGeometry(0.42, 0.38, 0.06, 14, 1, true).translate(0, 0.03, 0), woven, { cast: false });
  props.define("crate", new THREE.BoxGeometry(0.5, 0.28, 0.36).translate(0, 0.14, 0), m.planksDark, { cast: true });
  props.define("mat", new THREE.CylinderGeometry(0.1, 0.1, 1.2, 8).translate(0, 0.6, 0), woven, { detail: true });
  props.define("broom", mergeGeometries([new THREE.CylinderGeometry(0.015, 0.015, 1.1, 5).translate(0, 0.75, 0),
    new THREE.ConeGeometry(0.12, 0.35, 7).rotateX(Math.PI).translate(0, 0.17, 0)]), new THREE.MeshLambertMaterial({ color: 0xc9a46a }), { detail: true });
  props.define("stool", mergeGeometries([new THREE.CylinderGeometry(0.18, 0.18, 0.05, 10).translate(0, 0.43, 0),
    ...[0, 1, 2].map((i) => new THREE.CylinderGeometry(0.02, 0.025, 0.42, 5).translate(Math.cos(i * 2.1) * 0.12, 0.21, Math.sin(i * 2.1) * 0.12))]),
  m.planksDark);
  props.define("machine", mergeGeometries([paint(new THREE.BoxGeometry(0.9, 0.05, 0.5).translate(0, 0.78, 0), 0x6a4a30),
    paint(new THREE.BoxGeometry(0.06, 0.78, 0.45).translate(-0.4, 0.39, 0), 0x2a2a2a), paint(new THREE.BoxGeometry(0.06, 0.78, 0.45).translate(0.4, 0.39, 0), 0x2a2a2a),
    paint(new THREE.BoxGeometry(0.42, 0.24, 0.16).translate(0, 0.93, -0.05), 0x1c1c1c), paint(new THREE.BoxGeometry(0.1, 0.14, 0.14).translate(-0.17, 1.12, -0.05), 0x1c1c1c),
    paint(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 10).rotateZ(Math.PI / 2).translate(0.24, 0.98, -0.05), 0x8a8f94)]), vertex);
  props.define("bulb", new THREE.SphereGeometry(0.06, 6, 5), m.bulb, { cast: false });
  props.define("cord", new THREE.CylinderGeometry(0.008, 0.008, 1, 3).translate(0, -0.5, 0), m.black, { cast: false });
  props.define("pole", new THREE.CylinderGeometry(0.035, 0.035, 1, 6).translate(0, 0.5, 0), m.steel);
}

function stallBox(batch, frame, lx, ly, lz, sx, sy, sz, material, rx = 0) {
  /** Queue a box placed in a stall's local frame. */
  batch.addMatrix(new THREE.BoxGeometry(sx, sy, sz), frame.m(lx, ly, lz, rx), material);
}

export function buildStall(world, batch, props, frame, options) {
  /** Build one lock-up stall: slab, corrugated walls, lean-to roof with timber rafters, posts, counter and a bulb. */
  const m = world.materials;
  const { width: w, depth: d, front: hFront = 3.6, back: hBack = 4.3, overhang = 1.1, wall = "corrTeal", roof = "corrRoof",
    counter = true, fascia = "fasciaRust", sign = null, signColor = "#f4ead5", signInk = "#2b1d14", roofed = true, post = "planksDark" } = options;
  const wallMaterial = typeof wall === "string" ? m[wall] : wall;
  const fasciaMaterial = typeof fascia === "string" ? m[fascia] : fascia;
  const postMaterial = typeof post === "string" ? m[post] : post;
  stallBox(batch, frame, 0, 0.06, d / 2, w, 0.12, d, m.concrete);
  stallBox(batch, frame, 0, hBack / 2, d - 0.03, w, hBack, 0.06, wallMaterial);
  for (const side of [-1, 1]) stallBox(batch, frame, side * (w / 2 - 0.03), hBack / 2, d / 2, 0.06, hBack, d, wallMaterial);
  if (roofed) {
    const run = d + overhang;
    const rise = hBack - hFront;
    const slope = Math.atan2(rise, run);
    const length = Math.hypot(run, rise) + 0.25;
    batch.addMatrix(new THREE.BoxGeometry(w + 0.12, 0.04, length), frame.m(0, (hFront + hBack) / 2 + 0.08, (d - overhang) / 2, slope), m[roof]);
    for (let x = -w / 2 + 0.2; x <= w / 2 - 0.1; x += 1.25) {
      batch.addMatrix(new THREE.BoxGeometry(0.08, 0.12, length), frame.m(x, (hFront + hBack) / 2 - 0.02, (d - overhang) / 2, slope), m.planksDark);
    }
    stallBox(batch, frame, 0, hFront - 0.12, -overhang + 0.05, w + 0.12, 0.28, 0.06, fasciaMaterial);
    stallBox(batch, frame, 0, hFront + 0.02, -overhang - 0.06, w + 0.12, 0.09, 0.12, m.steel);
    stallBox(batch, frame, w / 2 - 0.04, hFront / 2, -overhang - 0.08, 0.07, hFront, 0.07, m.steel);
    for (const side of [-1, 1]) stallBox(batch, frame, side * (w / 2 - 0.08), hFront / 2, -overhang + 0.12, 0.12, hFront, 0.12, postMaterial);
    stallBox(batch, frame, 0, hFront - 0.32, -overhang + 0.12, w, 0.1, 0.1, m.planksDark);
    batch.addMatrix(new THREE.CylinderGeometry(0.13, 0.13, w - 0.3, 10), frame.m(0, hFront - 0.15, 0.08, 0, 0, Math.PI / 2), m.corrGrey);
    props.add("cord", frame.m(0.4, hFront - 0.25, 0.4, 0, 0, 0, 1, 0.5, 1));
    props.add("bulb", frame.m(0.4, hFront - 0.78, 0.4));
  }
  if (counter) {
    stallBox(batch, frame, 0, 0.45, 0.35, w - 0.5, 0.9, 0.6, m.planks);
    stallBox(batch, frame, 0, 0.92, 0.35, w - 0.4, 0.05, 0.72, m.planksDark);
  }
  if (sign) {
    const board = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.3, 0.55), new THREE.MeshLambertMaterial({
      map: signTexture(sign, { background: signColor, color: signInk, width: 768, height: 140, font: "800 84px Georgia, serif" }) }));
    board.matrixAutoUpdate = false;
    board.matrix.copy(frame.m(0, hFront + 0.33, -overhang + 0.02));
    batch.addMatrix(board.geometry, board.matrix, board.material);
  }
  const a = frame.point(-w / 2, 0, -0.15);
  const b = frame.point(w / 2, 0, d);
  addCollider(a.x, a.z, b.x, b.z);
  return { frame, width: w, depth: d, hFront, glow: frame.point(0.4, hFront - 0.78, 0.4) };
}

function rand(seed) {
  /** Return a seeded random number generator for laying out one stall's goods. */
  let index = 0;
  return () => seeded(index++, seed);
}

export function fillStall(props, stall, type, seed, world) {
  /** Stock a neighbour stall with goods of its trade and return where its vendor sits or stands. */
  const r = rand(seed);
  const { frame, width: w, depth: d } = stall;
  const vendor = { position: frame.point(0, 0.12, 1.15), yaw: frame.yawOut(), mode: "sit" };
  if (type === "plastics") {
    for (let s = 0; s < Math.floor(w / 0.75); s += 1) {
      const hex = BASIN_COLORS[Math.floor(r() * BASIN_COLORS.length)];
      const height = 4 + Math.floor(r() * 9);
      for (let k = 0; k < height; k += 1) props.add("basin", frame.m(-w / 2 + 0.45 + s * 0.75, 0.0 + k * 0.055, -0.55), hex);
    }
    for (let i = 0; i < 10; i += 1) props.add("bucket", frame.m(-w / 2 + 0.3 + (i % 5) * 0.4, 0.95 + Math.floor(i / 5) * 0.32, 0.25), BASIN_COLORS[i % 8]);
    for (let row = 0; row < 3; row += 1) for (let i = 0; i < 4; i += 1) {
      props.add("basin", frame.m(-w / 2 + 0.6 + i * 0.85, 1.3 + row * 0.7, d - 0.12, Math.PI / 2), BASIN_COLORS[(i + row * 3) % 8]);
    }
  } else if (type === "oil") {
    for (let row = 0; row < 2; row += 1) for (let i = 0; i < Math.floor(w / 0.28); i += 1) {
      props.add("jerrycan", frame.m(-w / 2 + 0.2 + i * 0.28, 0.0, -0.75 + row * 0.2), r() < 0.8 ? 0xf2c230 : 0xe8742c);
    }
    for (let shelf = 0; shelf < 3; shelf += 1) {
      stallBox(props.batch, frame, 0, 0.9 + shelf * 0.55, d - 0.3, w - 0.4, 0.04, 0.45, world.materials.planksDark);
      for (let i = 0; i < Math.floor((w - 0.5) / 0.11); i += 1) {
        props.add("bottle", frame.m(-w / 2 + 0.3 + i * 0.11, 0.92 + shelf * 0.55, d - 0.3 + (i % 2) * 0.1), [0xd62828, 0xf2b51e, 0xe8742c][(i + shelf) % 3]);
      }
    }
    for (let i = 0; i < 8; i += 1) props.add("bottle", frame.m(-1 + i * 0.2, 0.95, 0.3), i % 2 ? 0xd62828 : 0xf2b51e);
  } else if (type === "bags") {
    for (let row = 0; row < 4; row += 1) for (let i = 0; i < Math.floor(w / 0.38); i += 1) {
      props.add("backpack", frame.m(-w / 2 + 0.25 + i * 0.38, stall.hFront - 0.45 - row * 0.45, -0.35 - (row % 2) * 0.05), BAG_COLORS[Math.floor(r() * BAG_COLORS.length)]);
    }
    for (let side = -1; side <= 1; side += 2) for (let row = 0; row < 5; row += 1) {
      props.add("backpack", frame.m(side * (w / 2 - 0.2), 2.6 - row * 0.45, 0.4, 0, Math.PI / 2), BAG_COLORS[Math.floor(r() * BAG_COLORS.length)]);
    }
    for (let i = 0; i < 6; i += 1) props.add("backpack", frame.m(-1.2 + i * 0.48, 1.32, 0.35), BAG_COLORS[Math.floor(r() * BAG_COLORS.length)]);
    vendor.mode = "talk";
    vendor.position = frame.point(0.8, 0.04, -0.45);
  } else if (type === "clothes") {
    for (let pile = 0; pile < Math.floor((w - 0.6) / 0.42); pile += 1) {
      const height = 5 + Math.floor(r() * 9);
      for (let k = 0; k < height; k += 1) {
        props.add("fold", frame.m(-w / 2 + 0.5 + pile * 0.42, 0.95 + k * 0.055, 0.3 + (r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.3), CLOTH_COLORS[Math.floor(r() * CLOTH_COLORS.length)]);
      }
    }
    for (let i = 0; i < Math.floor(w / 0.42); i += 1) {
      props.add(r() < 0.5 ? "shirt" : "trousers", frame.m(-w / 2 + 0.25 + i * 0.42, stall.hFront - 0.4, -0.45, 0, (r() - 0.5) * 0.4), CLOTH_COLORS[Math.floor(r() * CLOTH_COLORS.length)]);
    }
    for (let i = 0; i < Math.floor(w / 0.5); i += 1) {
      props.add("shirt", frame.m(-w / 2 + 0.35 + i * 0.5, 2.5, d - 0.1), CLOTH_COLORS[Math.floor(r() * CLOTH_COLORS.length)]);
    }
    vendor.mode = r() < 0.5 ? "talk" : "arrange";
    vendor.position = frame.point(-0.6, 0.12, 0.95);
  } else if (type === "kitenge") {
    for (let i = 0; i < Math.floor(w / 0.88); i += 1) props.add(`fabric${Math.floor(r() * 6)}`, frame.m(-w / 2 + 0.45 + i * 0.88, 2.55, d - 0.15));
    for (let i = 0; i < 4; i += 1) props.add(`fabric${Math.floor(r() * 6)}`, frame.m(-w / 2 + 0.5 + i * 0.95, stall.hFront - 0.3, -0.4));
    for (let k = 0; k < 8; k += 1) props.add(`roll${k % 6}`, frame.m(-0.4 + (k % 2) * 0.05, 0.98 + k * 0.1, 0.3));
    props.add("machine", frame.m(1.0, 0.12, -0.9, 0, Math.PI));
    props.add("stool", frame.m(1.0, 0.12, -1.45));
    vendor.mode = "sew";
    vendor.position = frame.point(1.0, 0.12, -1.45);
    vendor.yaw = frame.yawOut() + Math.PI;
    vendor.seat = 0.55;
  } else if (type === "shoes") {
    for (let shelf = 0; shelf < 4; shelf += 1) {
      stallBox(props.batch, frame, 0, 0.45 + shelf * 0.42, d - 0.35 - shelf * 0.12, w - 0.4, 0.04, 0.4, world.materials.planksDark, -0.25);
      for (let i = 0; i < Math.floor((w - 0.5) / 0.26); i += 1) {
        props.add("shoe", frame.m(-w / 2 + 0.35 + i * 0.26, 0.48 + shelf * 0.42, d - 0.35 - shelf * 0.12, -0.25), SHOE_COLORS[Math.floor(r() * SHOE_COLORS.length)]);
      }
    }
    for (let i = 0; i < 14; i += 1) props.add("shoe", frame.m(-1.4 + i * 0.2, 0.95, 0.3, 0, (r() - 0.5) * 0.5), SHOE_COLORS[i % SHOE_COLORS.length]);
  } else if (type === "produce") {
    const heaps = ["tomatoes", "onions", "peppers", "carrots", "beets", "avocados"];
    for (let i = 0; i < Math.floor((w - 0.5) / 0.9); i += 1) props.add(heaps[Math.floor(r() * heaps.length)], frame.m(-w / 2 + 0.7 + i * 0.9, 0.95, 0.35));
    for (let i = 0; i < 3; i += 1) props.add("basket", frame.m(-w / 2 + 0.6 + i * 0.9, 0.0, -0.55));
    props.add("tomatoes", frame.m(-w / 2 + 0.6, 0.02, -0.55, 0, 0, 0, 0.8, 0.8, 0.8));
    props.add("onions", frame.m(-w / 2 + 1.5, 0.02, -0.55, 0, 0, 0, 0.8, 0.8, 0.8));
    for (let i = 0; i < 3; i += 1) {
      props.add("sackBody", frame.m(-w / 2 + 0.5 + i * 0.6, 0.12, d - 0.4));
      props.add("grainTop", frame.m(-w / 2 + 0.5 + i * 0.6, 0.12, d - 0.4), [0xc98a4b, 0x9b2c4a, 0xd62828][i]);
    }
  } else if (type === "grains") {
    const grains = [0x9a2a2a, 0xe8c23a, 0x8a5a3a, 0xc9a46a, 0x5a2a20, 0xf1e6c8];
    for (let row = 0; row < 2; row += 1) for (let i = 0; i < Math.floor((w - 0.4) / 0.55); i += 1) {
      const p = frame.m(-w / 2 + 0.45 + i * 0.55, 0.0, -0.6 + row * 0.55);
      props.add("sackBody", p);
      props.add("grainTop", p, grains[Math.floor(r() * grains.length)]);
    }
    for (let i = 0; i < 6; i += 1) props.add("tub", frame.m(-1.3 + i * 0.5, 0.95, 0.3));
  } else if (type === "household") {
    for (let i = 0; i < Math.floor(w / 0.25); i += 1) props.add("mat", frame.m(-w / 2 + 0.2 + i * 0.25, 0.12, d - 0.25, -0.12));
    for (let i = 0; i < 9; i += 1) props.add("broom", frame.m(-w / 2 + 0.3 + i * 0.22, 0.0, -0.6, 0.1));
    for (let i = 0; i < 4; i += 1) props.add("basket", frame.m(0.5 + (i % 2) * 0.85, 0.95 + Math.floor(i / 2) * 0.3, 0.3));
    for (let i = 0; i < 4; i += 1) props.add("tray", frame.m(-1.4 + i * 0.1, 0.95 + i * 0.07, 0.3));
  } else if (type === "fruit") {
    for (let i = 0; i < Math.floor((w - 0.6) / 0.55); i += 1) {
      props.add("crate", frame.m(-w / 2 + 0.55 + i * 0.55, 0.95, 0.35));
      for (let k = 0; k < 4; k += 1) props.add("pineapple", frame.m(-w / 2 + 0.45 + i * 0.55 + (k % 2) * 0.2, 1.2, 0.27 + Math.floor(k / 2) * 0.16));
    }
    for (let i = 0; i < 10; i += 1) props.add("watermelon", frame.m(-w / 2 + 0.4 + (i % 5) * 0.42, 0.0 + Math.floor(i / 5) * 0.32, -0.6, 0, r() * 3), 0x2f6a2a);
    props.add("bananas", frame.m(w / 2 - 0.5, 0.12, -0.5));
    props.add("oranges", frame.m(w / 2 - 0.9, 0.95, 0.35, 0, 0, 0, 0.8, 0.8, 0.8));
  }
  return vendor;
}

export function neighbourSign(type, seed) {
  /** Return a plain painted name for a neighbour stall of a trade. */
  const names = NEIGHBOUR_NAMES[type];
  return names[seed % names.length];
}

export function counterFront(world, frame, w, colorHex) {
  /** Return a printed counter front panel for a stall, in its own accent. */
  const material = new THREE.MeshLambertMaterial({ map: counterPrintTexture(colorHex) });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.55, 0.8), material);
  mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(frame.m(0, 0.48, 0.04));
  return mesh;
}

