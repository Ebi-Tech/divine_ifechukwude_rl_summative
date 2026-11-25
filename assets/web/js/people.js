import * as THREE from "three";
import { mergeGeometries } from "three/addons/BufferGeometryUtils.js";
import { blobTexture, printMaskTexture } from "./textures.js";

const HIP_Y = 0.93;
const THIGH = 0.42;
const UPPER_ARM = 0.28;
const TORSO = 0.52;
const STRIDE = 1.35;
const SHOULDER = [0.2, 0.47];
const HIP_X = 0.09;
const MAX_DISTANCE = { high: 95, low: 55 };
const DOUBLE_PARTS = new Set(["thigh", "shin", "upperArm", "forearm"]);

export const SKIN_TONES = [0x4a2a1a, 0x5a3420, 0x6b3f22, 0x3d2416, 0x7a4a2c, 0x553019, 0x6a3a24];
const HAIR = [0x16110d, 0x1f1712, 0x0f0c0a];
const WOMEN_TOPS = [0x3f9b4a, 0xf2c14e, 0xe8742c, 0xe58fb0, 0x2f6fb5, 0x7a4b9a, 0xf2efe8, 0xc8352e, 0x2a9d8f, 0x1f4e79, 0xd9a441];
const MEN_TOPS = [0xf3f1ec, 0x9cc3e4, 0xe7a6a0, 0xf2d21b, 0x2346a8, 0xb3262e, 0x8e8e8e, 0x2a2a2a, 0x6b6b3a, 0xf07b22, 0x3f7f5f, 0x5b3f8c];
const TROUSERS = [0x232323, 0x2b3550, 0x3d5a80, 0xa38d6a, 0x5d5d5d, 0x3b3b46, 0x6e5a44];
const SKIRTS = [0x9a7a8c, 0x2a2a2a, 0x1f2f55, 0x7a2e3a, 0x4a6b3a, 0xb06a2a];
const PRINT_SECOND = [0x1d1d2b, 0xf2c14e, 0xf7f3e8, 0xc8352e, 0x1f6fb5, 0x2a7a3a, 0xe8742c];
const WRAPS = [0xe56b2a, 0xf2b631, 0x2a6fb5, 0xc8352e, 0x3f9b4a, 0x7a4b9a, 0xf3efe6];
const CAPS = [0xf4f4f0, 0xc0392b, 0x1f1f1f, 0x2346a8, 0x2a7a3a];
const BAG_COLORS = [0x1c1c1c, 0x2f6fb5, 0xe58fb0, 0xf3f1ea, 0x8c2a2a, 0x2a2a2a];

const tmp = { local: new THREE.Matrix4(), euler: new THREE.Euler(), scale: new THREE.Vector3(), sphere: new THREE.Sphere(),
  frustum: new THREE.Frustum(), projection: new THREE.Matrix4() };
const M = Object.fromEntries(["root", "pelvis", "torso", "head", "shL", "elL", "shR", "elR", "hipL", "knL", "hipR", "knR", "out", "flat"]
  .map((name) => [name, new THREE.Matrix4()]));
const pose = { hipY: HIP_Y, bob: 0, lean: 0, sway: 0, twist: 0, headYaw: 0, headPitch: 0,
  hipL: 0, knL: 0, hipR: 0, knR: 0, shL: 0, outL: 0.08, elL: 0.15, shR: 0, outR: 0.08, elR: 0.15, spread: 0 };

function painted(geometry, hex) {
  /** Give a geometry one vertex colour, keeping UVs, so parts with different fixed colours can merge. */
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const color = new THREE.Color(hex);
  const array = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < array.length; i += 3) array.set([color.r, color.g, color.b], i);
  g.setAttribute("color", new THREE.BufferAttribute(array, 3));
  return g;
}

function piece(geometry, hex, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0) {
  /** Return a painted, placed copy of a geometry for merging into a body part. */
  const g = geometry.clone();
  g.scale(sx, sy, sz);
  if (rx) g.rotateX(rx);
  g.translate(x, y, z);
  return painted(g, hex);
}

function buildGeometries() {
  /** Build the low-poly body parts and carried goods, each with its pivot at its joint. */
  const white = 0xffffff;
  const capsule = (radius, length) => new THREE.CapsuleGeometry(radius, length, 1, 6);
  return {
    torso: mergeGeometries([
      piece(new THREE.CylinderGeometry(0.17, 0.14, TORSO * 0.82, 9), white, 0, TORSO * 0.41, 0, 1, 1, 0.66),
      piece(new THREE.SphereGeometry(0.17, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), white, 0, TORSO * 0.8, 0, 1, 0.55, 0.66),
    ]),
    pelvis: piece(new THREE.CylinderGeometry(0.145, 0.155, 0.17, 9), white, 0, -0.06, 0, 1, 1, 0.7),
    skirt: piece(new THREE.CylinderGeometry(0.155, 0.27, 0.66, 11), white, 0, -0.32, 0, 1, 1, 0.78),
    thigh: piece(capsule(0.066, THIGH - 0.1), white, 0, -THIGH / 2, 0),
    shin: mergeGeometries([
      piece(capsule(0.05, 0.34), white, 0, -0.21, 0),
      piece(new THREE.BoxGeometry(0.095, 0.065, 0.23), 0x2a211b, 0, -0.455, 0.045),
    ]),
    upperArm: piece(capsule(0.046, UPPER_ARM - 0.08), white, 0, -UPPER_ARM / 2 + 0.01, 0),
    forearm: mergeGeometries([
      piece(capsule(0.04, 0.2), white, 0, -0.13, 0),
      piece(new THREE.SphereGeometry(0.046, 6, 5), white, 0, -0.29, 0.01, 0.8, 1.15, 0.9),
    ]),
    head: mergeGeometries([
      piece(new THREE.SphereGeometry(0.105, 9, 7), white, 0, 0.175, 0.005, 0.95, 1.13, 1),
      piece(new THREE.CylinderGeometry(0.046, 0.05, 0.11, 7), white, 0, 0.04, 0),
      piece(new THREE.SphereGeometry(0.022, 5, 4), white, 0, 0.165, 0.105, 1, 0.9, 0.8),
    ]),
    hair: piece(new THREE.SphereGeometry(0.112, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.52), white, 0, 0.19, -0.008, 0.97, 1.08, 1.03),
    wrap: mergeGeometries([
      piece(new THREE.SphereGeometry(0.128, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.58), white, 0, 0.2, -0.01, 1, 1.2, 1.06),
      piece(new THREE.SphereGeometry(0.1, 8, 5), white, 0, 0.31, -0.03, 1.35, 0.7, 1.05),
      piece(new THREE.TorusGeometry(0.11, 0.025, 4, 12), white, 0, 0.22, 0, 1, 1, 1, Math.PI / 2 - 0.25),
    ]),
    cap: mergeGeometries([
      piece(new THREE.SphereGeometry(0.116, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), white, 0, 0.2, 0, 1, 0.85, 1.02),
      piece(new THREE.BoxGeometry(0.17, 0.014, 0.12), white, 0, 0.215, 0.13),
    ]),
    helmet: mergeGeometries([
      piece(new THREE.SphereGeometry(0.15, 11, 7, 0, Math.PI * 2, 0, Math.PI * 0.6), white, 0, 0.17, -0.01, 1, 1.05, 1.08),
      piece(new THREE.BoxGeometry(0.2, 0.07, 0.03), 0x1a1a1a, 0, 0.16, 0.14),
    ]),
    bag: mergeGeometries([
      piece(new THREE.BoxGeometry(0.24, 0.26, 0.1), white, 0, -0.2, 0),
      piece(new THREE.TorusGeometry(0.06, 0.012, 4, 10, Math.PI), white, 0, -0.07, 0),
    ]),
    basket: mergeGeometries([
      piece(new THREE.CylinderGeometry(0.27, 0.19, 0.17, 12, 1, true), 0xc99a5b, 0, 0.36, 0),
      piece(new THREE.CylinderGeometry(0.19, 0.19, 0.02, 12), 0xa5733b, 0, 0.28, 0),
      piece(new THREE.SphereGeometry(0.075, 6, 5), 0xe8742c, -0.1, 0.45, 0.04),
      piece(new THREE.SphereGeometry(0.075, 6, 5), 0xd62828, 0.08, 0.45, -0.06),
      piece(new THREE.SphereGeometry(0.075, 6, 5), 0x6a994e, 0.05, 0.46, 0.1),
      piece(new THREE.SphereGeometry(0.075, 6, 5), 0xf2c14e, -0.04, 0.5, -0.02),
      piece(new THREE.TorusGeometry(0.08, 0.03, 4, 10), 0xf3efe6, 0, 0.27, 0, 1, 1, 1, Math.PI / 2),
    ]),
    sack: mergeGeometries([
      piece(new THREE.SphereGeometry(0.2, 9, 6), white, 0, 0.4, 0, 1.35, 0.6, 1.0),
      piece(new THREE.TorusGeometry(0.08, 0.03, 4, 10), 0xf3efe6, 0, 0.27, 0, 1, 1, 1, Math.PI / 2),
    ]),
    backpack: mergeGeometries([
      piece(new THREE.BoxGeometry(0.29, 0.36, 0.15), white, 0, 0.3, -0.17),
      piece(new THREE.BoxGeometry(0.22, 0.14, 0.05), white, 0, 0.22, -0.26),
    ]),
    jerrycan: mergeGeometries([
      piece(new THREE.BoxGeometry(0.2, 0.3, 0.13), white, 0, -0.2, 0),
      piece(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 6), 0xc8352e, 0.06, -0.03, 0),
    ]),
    baby: mergeGeometries([
      piece(new THREE.SphereGeometry(0.17, 9, 6), white, 0, 0.3, -0.16, 1.15, 1.25, 0.8),
      piece(new THREE.SphereGeometry(0.075, 8, 6), 0x7a4a33, 0.02, 0.5, -0.19),
    ]),
  };
}

function clothMaterial(world) {
  /** Return the one shared material for every body part: instance colour plus an optional two-colour print. */
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mask = printMaskTexture();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPrint = { value: mask };
    shader.vertexShader = `attribute vec4 aPrint;\nvarying vec4 vPrint;\nvarying vec2 vPUv;\nvarying vec3 vVert;\n${shader.vertexShader}`
      .replace("#include <color_vertex>", "#include <color_vertex>\nvPrint = aPrint;\nvPUv = uv;\nvVert = color.rgb;");
    shader.fragmentShader = `uniform sampler2D uPrint;\nvarying vec4 vPrint;\nvarying vec2 vPUv;\nvarying vec3 vVert;\n${shader.fragmentShader}`
      .replace("#include <color_fragment>", `
        vec3 cloth = vColor;
        if (vPrint.w > 0.5) {
          float cell = vPrint.w - 1.0;
          vec2 origin = vec2(mod(cell, 2.0), floor(cell / 2.0)) * 0.5;
          vec2 tiled = origin + fract(vPUv * vec2(4.0, 3.0)) * 0.5;
          float ink = texture2D(uPrint, tiled).r;
          cloth = mix(vColor, vVert * vPrint.rgb, ink);
        }
        diffuseColor.rgb *= cloth;`);
  };
  material.customProgramCacheKey = () => "market-cloth";
  return material;
}

function partMesh(world, geometry, material, capacity) {
  /** Return an instanced body part with instance colours and print attributes, drawing nothing yet. */
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, new THREE.Color(0xffffff));
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  const print = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
  print.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("aPrint", print);
  mesh.count = 0;
  mesh.frustumCulled = false;
  world.scene.add(mesh);
  return mesh;
}

export function createCrowd(world, capacity) {
  /** Create the shared crowd: every person in the market, drawn with one instanced mesh per body part. */
  const geometries = buildGeometries();
  const material = clothMaterial(world);
  const parts = {};
  for (const [name, geometry] of Object.entries(geometries)) {
    parts[name] = partMesh(world, geometry, material, DOUBLE_PARTS.has(name) ? capacity * 2 : capacity);
  }
  const blob = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, color: 0x000000, opacity: 0.5 }), capacity);
  const ring = new THREE.InstancedMesh(new THREE.RingGeometry(0.34, 0.47, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false }), capacity);
  for (const mesh of [blob, ring]) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.renderOrder = 1;
    world.scene.add(mesh);
  }
  ring.setColorAt(0, new THREE.Color(0xffffff));
  return { world, parts, blob, ring, people: [], capacity, counts: {}, visible: 0 };
}

function pick(rand, list) {
  /** Pick one entry of a list with a random number generator. */
  return list[Math.floor(rand() * list.length) % list.length];
}

function printOf(rand, chance) {
  /** Return a random two-colour print [r, g, b, pattern] with some chance, or a plain cloth. */
  if (rand() > chance) return [0, 0, 0, 0];
  const color = new THREE.Color(pick(rand, PRINT_SECOND));
  return [color.r, color.g, color.b, 1 + Math.floor(rand() * 4)];
}

export function randomLook(rand, kind = rand() < 0.55 ? "woman" : "man") {
  /** Return a person's outfit as seen in the photos: wrappers, headwraps, jerseys, caps, bags and babies on backs. */
  const look = { kind, skin: pick(rand, SKIN_TONES), hair: pick(rand, HAIR), scale: 0.93 + rand() * 0.12, build: 0.92 + rand() * 0.2,
    carry: "none", carryColor: pick(rand, BAG_COLORS), carryPrint: [0, 0, 0, 0], head: "hair", headColor: 0, headPrint: [0, 0, 0, 0] };
  if (kind === "woman") {
    look.top = pick(rand, WOMEN_TOPS);
    look.topPrint = printOf(rand, 0.45);
    look.lower = rand() < 0.7 ? "skirt" : "trousers";
    look.bottom = look.lower === "skirt" ? (rand() < 0.5 ? pick(rand, WOMEN_TOPS) : pick(rand, SKIRTS)) : pick(rand, TROUSERS);
    look.bottomPrint = look.lower === "skirt" ? printOf(rand, 0.6) : [0, 0, 0, 0];
    look.scale *= 0.96;
    if (rand() < 0.55) {
      look.head = "wrap";
      look.headColor = pick(rand, WRAPS);
      look.headPrint = printOf(rand, 0.5);
    }
    const carry = rand();
    if (carry < 0.14) look.carry = "basket";
    else if (carry < 0.22) look.carry = "baby";
    else if (carry < 0.42) look.carry = "bag";
    else if (carry < 0.5) look.carry = "backpack";
    if (look.carry === "baby") look.carryColor = pick(rand, WRAPS), look.carryPrint = printOf(rand, 0.8);
  } else if (kind === "man") {
    look.top = pick(rand, MEN_TOPS);
    look.topPrint = rand() < 0.15 ? [0.1, 0.1, 0.12, 1] : [0, 0, 0, 0];
    look.lower = "trousers";
    look.bottom = pick(rand, TROUSERS);
    look.bottomPrint = [0, 0, 0, 0];
    if (rand() < 0.3) look.head = "cap", look.headColor = pick(rand, CAPS);
    const carry = rand();
    if (carry < 0.2) look.carry = "bag";
    else if (carry < 0.36) look.carry = "backpack";
    else if (carry < 0.43) look.carry = "sack";
    else if (carry < 0.48) look.carry = "jerrycan", look.carryColor = 0xf2c230;
    look.build *= 1.06;
  } else if (kind === "child") {
    look.top = pick(rand, [...MEN_TOPS, ...WOMEN_TOPS]);
    look.topPrint = [0, 0, 0, 0];
    look.lower = rand() < 0.5 ? "skirt" : "trousers";
    look.bottom = pick(rand, look.lower === "skirt" ? SKIRTS : TROUSERS);
    look.bottomPrint = [0, 0, 0, 0];
    look.scale = 0.58 + rand() * 0.1;
  }
  return look;
}

export function riderLook(rand) {
  /** Return a moto taxi rider: a plain yellow and blue reflective vest, a helmet and dark trousers. */
  const look = randomLook(rand, "man");
  const yellowVest = rand() < 0.7;
  const second = new THREE.Color(yellowVest ? 0x6fa8dc : 0xf2d21b);
  look.top = yellowVest ? 0xf2d21b : 0x6fa8dc;
  look.topPrint = [second.r, second.g, second.b, 1];
  look.head = "helmet";
  look.headColor = pick(rand, [0xc0392b, 0xf2c230, 0x1f1f1f, 0x1f4e9a, 0xc0392b]);
  look.carry = "none";
  return look;
}

export function porterLook(rand) {
  /** Return a young porter looking for work: a deep amber vest with a silver reflective stripe, often an empty sack or a bag. */
  const look = randomLook(rand, "man");
  look.top = 0xf0a400;
  look.topPrint = [0.86, 0.86, 0.84, 1];
  look.head = rand() < 0.3 ? "cap" : "hair";
  look.headColor = 0x1f1f1f;
  const carry = rand();
  look.carry = carry < 0.35 ? "sack" : carry < 0.55 ? "bag" : "none";
  look.carryColor = 0x1c1c1c;
  look.scale = 0.95 + rand() * 0.08;
  return look;
}

export function agentLook(rand) {
  /** Return a mobile money agent: a plain lemon yellow vest or jacket over everyday clothes, seated at a small table. */
  const look = randomLook(rand, rand() < 0.5 ? "woman" : "man");
  look.top = 0xffe14a;
  look.topPrint = [0, 0, 0, 0];
  look.carry = "none";
  return look;
}

export function policeLook(rand) {
  /** Return a traffic officer: a white shirt under a lime reflective vest with silver stripes, dark trousers and a white cap. */
  const look = randomLook(rand, "man");
  look.top = 0xd4f02e;
  look.topPrint = [0.9, 0.9, 0.88, 1];
  look.bottom = 0x1f2a44;
  look.head = "cap";
  look.headColor = 0xf4f4f0;
  look.carry = "none";
  look.scale = 1.0;
  return look;
}

export function addPerson(crowd, look) {
  /** Add a person to the crowd and return its record; the caller moves it and sets its mode. */
  const person = { look, x: 0, y: 0, z: 0, yaw: 0, speed: 0, mode: "idle", phase: Math.random() * 6.28, seed: crowd.people.length,
    active: true, ring: null, bagColor: null, seat: 0.45, lean: 0, lastX: null, lastZ: null };
  crowd.people.push(person);
  return person;
}

function walkPose(person, time) {
  /** Fill the pose for walking at the person's speed, with carrying and upset variations. */
  const phase = person.phase;
  const swing = Math.sin(phase);
  const hurry = THREE.MathUtils.clamp(person.speed / 1.4, 0.6, 1.6);
  pose.hipL = 0.4 * swing * hurry;
  pose.hipR = -0.4 * swing * hurry;
  pose.knL = 0.1 + 0.75 * Math.max(0, Math.cos(phase)) * hurry;
  pose.knR = 0.1 + 0.75 * Math.max(0, -Math.cos(phase)) * hurry;
  pose.bob = 0.03 * Math.abs(Math.cos(phase)) * hurry - 0.015;
  pose.shL = -0.32 * swing * hurry;
  pose.shR = 0.32 * swing * hurry;
  pose.elL = 0.25 + 0.15 * Math.max(0, -swing);
  pose.elR = 0.25 + 0.15 * Math.max(0, swing);
  pose.twist = 0.07 * swing;
  pose.lean = 0.05 * hurry;
  pose.headYaw = Math.sin(time * 0.4 + person.seed) * 0.25;
  if (person.mode === "upset") {
    pose.headYaw = Math.sin(time * 8) * 0.35;
    pose.outL = pose.outR = 0.35;
  }
}

function standPose(person, time) {
  /** Fill the pose for standing: weight shifts, looking around, talking hands and haggling. */
  const s = person.seed;
  pose.sway = Math.sin(time * 0.7 + s) * 0.03;
  pose.knL = 0.06 + Math.max(0, Math.sin(time * 0.7 + s)) * 0.08;
  pose.knR = 0.06 + Math.max(0, -Math.sin(time * 0.7 + s)) * 0.08;
  pose.headYaw = Math.sin(time * 0.35 + s * 2.1) * 0.45;
  pose.shL = 0.05;
  pose.shR = 0.05;
  if (person.mode === "talk" || person.mode === "haggle") {
    const rate = person.mode === "haggle" ? 4.2 : 2.8;
    pose.shR = 0.55 + 0.3 * Math.sin(time * rate + s);
    pose.elR = 1.2 + 0.35 * Math.sin(time * (rate + 1.1) + s);
    pose.outR = 0.15;
    pose.headPitch = 0.07 * Math.sin(time * 5 + s);
    pose.headYaw *= 0.3;
    if (person.mode === "haggle") {
      pose.shL = 0.45 + 0.25 * Math.sin(time * 3.3 + s + 1);
      pose.elL = 1.1;
    }
  } else if (person.mode === "upset") {
    pose.outL = pose.outR = 0.45;
    pose.elL = pose.elR = 0.6;
    pose.headYaw = Math.sin(time * 8) * 0.4;
  } else if (person.mode === "arrange") {
    pose.lean = 0.45 + 0.15 * Math.sin(time * 1.3 + s);
    pose.shL = pose.shR = 0.9;
    pose.elL = pose.elR = 0.5 + 0.2 * Math.sin(time * 2.4 + s);
    pose.headPitch = 0.3;
  } else if (person.mode === "direct") {
    pose.outR = 1.45;
    pose.shR = 0.25 + 0.35 * Math.max(0, Math.sin(time * 2.2 + s));
    pose.elR = 0.15;
    pose.outL = 0.25;
    pose.elL = 1.6;
    pose.shL = 0.3;
    pose.headYaw = Math.sin(time * 0.6 + s) * 0.5;
  } else if (person.mode === "present") {
    pose.shL = pose.shR = 1.2 + 0.05 * Math.sin(time * 1.5 + s);
    pose.outL = pose.outR = 0.32;
    pose.elL = pose.elR = 0.25;
    pose.headYaw *= 0.3;
  } else if (person.mode === "wave") {
    pose.shR = 2.6;
    pose.outR = 0.3 + 0.25 * Math.sin(time * 7);
    pose.elR = 0.4;
  }
}

function sitPose(person, time) {
  /** Fill the pose for sitting on a stool, sewing, riding a moto or sitting on a sack. */
  const s = person.seed;
  pose.hipY = person.seat + 0.07;
  pose.hipL = pose.hipR = 1.45;
  pose.knL = pose.knR = 1.45;
  pose.spread = 0.12;
  pose.shL = pose.shR = 0.5;
  pose.elL = pose.elR = 0.9;
  pose.lean = 0.12;
  pose.headYaw = Math.sin(time * 0.3 + s * 1.7) * 0.5;
  if (person.mode === "sew") {
    pose.shL = pose.shR = 0.95 + Math.sin(time * 9 + s) * 0.06;
    pose.elL = pose.elR = 0.85;
    pose.lean = 0.3;
    pose.headPitch = 0.4;
    pose.headYaw = 0;
  } else if (person.mode === "ride") {
    pose.hipL = pose.hipR = 1.1;
    pose.knL = pose.knR = 1.55;
    pose.shL = pose.shR = 1.15;
    pose.elL = pose.elR = 0.35;
    pose.outL = pose.outR = 0.2;
    pose.lean = 0.2;
    pose.headYaw = person.speed > 0.5 ? 0 : pose.headYaw;
  } else if (person.mode === "groundSit") {
    pose.hipL = pose.hipR = 1.25;
    pose.knL = pose.knR = 2.1;
    pose.spread = 0.3;
  } else if (person.mode === "sitTalk") {
    pose.shR = 0.7 + 0.3 * Math.sin(time * 2.6 + s);
    pose.elR = 1.3;
    pose.headYaw *= 0.4;
  }
}

function resetPose() {
  /** Return the pose to a relaxed stance before filling it. */
  Object.assign(pose, { hipY: HIP_Y, bob: 0, lean: 0, sway: 0, twist: 0, headYaw: 0, headPitch: 0, hipL: 0, knL: 0.05, hipR: 0,
    knR: 0.05, shL: 0.04, outL: 0.08, elL: 0.15, shR: 0.04, outR: 0.08, elR: 0.15, spread: 0 });
}

function computePose(person, time) {
  /** Choose and fill the pose for a person's mode and movement. */
  resetPose();
  const sitting = ["sit", "sew", "ride", "groundSit", "sitTalk"].includes(person.mode);
  if (sitting) sitPose(person, time);
  else if (person.speed > 0.05) walkPose(person, time);
  else standPose(person, time);
  pose.lean += person.lean;
  const carry = person.look.carry;
  if (!sitting && (carry === "basket" || carry === "sack")) {
    pose.shR = 2.75;
    pose.outR = 0.1;
    pose.elR = 0.55;
    pose.headYaw *= 0.2;
  }
  if (!sitting && (carry === "bag" || carry === "jerrycan" || person.bagColor !== null)) {
    pose.shR *= 0.35;
    pose.elR = 0.12;
    pose.outR = carry === "jerrycan" ? 0.2 : 0.12;
  }
}

function link(out, parent, tx, ty, tz, rx, ry, rz) {
  /** Set out to parent * translate * rotate, the step down one joint of the body. */
  tmp.euler.set(rx, ry, rz);
  tmp.local.makeRotationFromEuler(tmp.euler);
  tmp.local.setPosition(tx, ty, tz);
  return out.multiplyMatrices(parent, tmp.local);
}

function emit(crowd, name, matrix, colorHex, print = null) {
  /** Write one visible instance of a body part. */
  const mesh = crowd.parts[name];
  const index = crowd.counts[name];
  crowd.counts[name] = index + 1;
  matrix.toArray(mesh.instanceMatrix.array, index * 16);
  const colors = mesh.instanceColor.array;
  colors[index * 3] = ((colorHex >> 16) & 255) / 255;
  colors[index * 3 + 1] = ((colorHex >> 8) & 255) / 255;
  colors[index * 3 + 2] = (colorHex & 255) / 255;
  const prints = mesh.geometry.attributes.aPrint.array;
  if (print) prints.set(print, index * 4);
  else prints[index * 4 + 3] = 0;
}

function emitPerson(crowd, person) {
  /** Write every visible part of one posed person. */
  const look = person.look;
  const s = look.scale;
  tmp.euler.set(0, person.yaw, 0);
  M.root.makeRotationFromEuler(tmp.euler).scale(tmp.scale.set(s, s, s)).setPosition(person.x, person.y, person.z);
  link(M.pelvis, M.root, 0, pose.hipY + pose.bob, 0, 0, pose.twist * 0.5, pose.sway);
  link(M.torso, M.pelvis, 0, 0, 0, pose.lean, pose.twist, 0);
  link(M.head, M.torso, 0, TORSO, 0.01, pose.headPitch, pose.headYaw, 0);
  M.out.copy(M.torso).scale(tmp.scale.set(look.build, 1, 1));
  emit(crowd, "torso", M.out, look.top, look.topPrint);
  emit(crowd, "head", M.head, look.skin);
  if (look.head === "hair") emit(crowd, "hair", M.head, look.hair);
  else if (look.head === "wrap") emit(crowd, "wrap", M.head, look.headColor, look.headPrint);
  else if (look.head === "cap") emit(crowd, "cap", M.head, look.headColor);
  else if (look.head === "helmet") emit(crowd, "helmet", M.head, look.headColor);
  const skirt = look.lower === "skirt";
  M.out.copy(M.pelvis).scale(tmp.scale.set(look.build, 1, 1));
  emit(crowd, "pelvis", M.out, look.bottom, look.bottomPrint);
  if (skirt && !["sit", "sew", "ride", "groundSit", "sitTalk"].includes(person.mode)) emit(crowd, "skirt", M.out, look.bottom, look.bottomPrint);
  const legColor = skirt ? look.skin : look.bottom;
  const sx = SHOULDER[0] * look.build;
  link(M.shL, M.torso, sx, SHOULDER[1], 0, -pose.shL, 0, pose.outL);
  link(M.shR, M.torso, -sx, SHOULDER[1], 0, -pose.shR, 0, -pose.outR);
  link(M.elL, M.shL, 0, -UPPER_ARM, 0, -pose.elL, 0, 0);
  link(M.elR, M.shR, 0, -UPPER_ARM, 0, -pose.elR, 0, 0);
  emit(crowd, "upperArm", M.shL, look.top, look.topPrint);
  emit(crowd, "upperArm", M.shR, look.top, look.topPrint);
  emit(crowd, "forearm", M.elL, look.skin);
  emit(crowd, "forearm", M.elR, look.skin);
  link(M.hipL, M.pelvis, HIP_X, -0.03, 0, -pose.hipL, 0, pose.spread);
  link(M.hipR, M.pelvis, -HIP_X, -0.03, 0, -pose.hipR, 0, -pose.spread);
  link(M.knL, M.hipL, 0, -THIGH, 0, pose.knL, 0, 0);
  link(M.knR, M.hipR, 0, -THIGH, 0, pose.knR, 0, 0);
  const sitting = ["sit", "sew", "ride", "groundSit", "sitTalk"].includes(person.mode);
  const thighColor = skirt && !sitting ? look.skin : look.bottom;
  emit(crowd, "thigh", M.hipL, sitting && skirt ? look.bottom : thighColor, sitting && skirt ? look.bottomPrint : null);
  emit(crowd, "thigh", M.hipR, sitting && skirt ? look.bottom : thighColor, sitting && skirt ? look.bottomPrint : null);
  emit(crowd, "shin", M.knL, legColor);
  emit(crowd, "shin", M.knR, legColor);
  emitCarried(crowd, person);
}

function emitCarried(crowd, person) {
  /** Write what a person carries: a shop bag, a basket or sack on the head, a backpack, a jerrycan or a baby. */
  const look = person.look;
  const sitting = ["sit", "sew", "ride", "groundSit", "sitTalk"].includes(person.mode);
  if (person.bagColor !== null) {
    link(M.out, M.elR, 0, -0.3, 0.02, pose.elR + pose.shR * 0.9, 0, 0);
    emit(crowd, "bag", M.out, person.bagColor);
    return;
  }
  if (look.carry === "bag" && !sitting) {
    link(M.out, M.elR, 0, -0.3, 0.02, pose.elR + pose.shR * 0.9, 0, 0);
    emit(crowd, "bag", M.out, look.carryColor);
  } else if (look.carry === "jerrycan" && !sitting) {
    link(M.out, M.elR, 0, -0.3, 0.02, pose.elR + pose.shR * 0.9, 0, 0);
    emit(crowd, "jerrycan", M.out, look.carryColor);
  } else if (look.carry === "basket" && !sitting) {
    emit(crowd, "basket", M.head, 0xffffff);
  } else if (look.carry === "sack" && !sitting) {
    emit(crowd, "sack", M.head, 0xe9e1cf);
  } else if (look.carry === "backpack") {
    emit(crowd, "backpack", M.torso, look.carryColor);
  } else if (look.carry === "baby") {
    emit(crowd, "baby", M.torso, look.carryColor, look.carryPrint);
  }
}

function emitGround(crowd, person, mesh, index, size, colorHex = null) {
  /** Write a flat ground marker under a person: the soft shadow blob or a shop's customer ring. */
  M.flat.makeScale(size, 1, size).setPosition(person.x, person.y + 0.025 + (colorHex !== null ? 0.005 : 0), person.z);
  M.flat.toArray(mesh.instanceMatrix.array, index * 16);
  if (colorHex !== null) {
    const colors = mesh.instanceColor.array;
    colors[index * 3] = ((colorHex >> 16) & 255) / 255;
    colors[index * 3 + 1] = ((colorHex >> 8) & 255) / 255;
    colors[index * 3 + 2] = (colorHex & 255) / 255;
  }
}

export function updateCrowd(crowd, delta, time, camera, quality) {
  /** Pose and draw everyone in view, packing visible people first so hidden ones cost nothing on the GPU. */
  for (const name of Object.keys(crowd.parts)) crowd.counts[name] = 0;
  tmp.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  tmp.frustum.setFromProjectionMatrix(tmp.projection);
  const maxDistance = MAX_DISTANCE[quality] || MAX_DISTANCE.high;
  let blobs = 0;
  let rings = 0;
  for (const person of crowd.people) {
    if (!person.active) {
      person.lastX = null;
      continue;
    }
    if (person.lastX !== null && delta > 0) {
      const moved = Math.hypot(person.x - person.lastX, person.z - person.lastZ);
      const speed = moved > 2.5 ? 0 : moved / delta;
      person.speed = THREE.MathUtils.lerp(person.speed, speed, Math.min(1, delta * 10));
    }
    person.lastX = person.x;
    person.lastZ = person.z;
    if (person.speed > 0.05) person.phase += (delta * person.speed * Math.PI * 2) / STRIDE;
    tmp.sphere.center.set(person.x, person.y + 0.9, person.z);
    tmp.sphere.radius = 1.2;
    if (!tmp.frustum.intersectsSphere(tmp.sphere) || camera.position.distanceTo(tmp.sphere.center) > maxDistance) continue;
    computePose(person, time + person.seed * 0.37);
    emitPerson(crowd, person);
    emitGround(crowd, person, crowd.blob, blobs, ["sit", "sew", "groundSit", "sitTalk"].includes(person.mode) ? 0.95 : 0.8);
    blobs += 1;
    if (person.ring !== null) {
      emitGround(crowd, person, crowd.ring, rings, 1, person.ring);
      rings += 1;
    }
  }
  for (const [name, mesh] of Object.entries(crowd.parts)) {
    mesh.count = crowd.counts[name];
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.geometry.attributes.aPrint.needsUpdate = true;
  }
  crowd.blob.count = blobs;
  crowd.blob.instanceMatrix.needsUpdate = true;
  crowd.ring.count = rings;
  crowd.ring.instanceMatrix.needsUpdate = true;
  crowd.ring.instanceColor.needsUpdate = true;
  crowd.visible = blobs;
}
