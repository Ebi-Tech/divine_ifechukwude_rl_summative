import * as THREE from "three";
import { mergeGeometries } from "three/addons/BufferGeometryUtils.js";
import { Sky } from "three/addons/Sky.js";
import { cloudTexture } from "./textures.js";

const TEXTURE_DIR = "/assets/web/textures/";
const QUALITY = {
  high: { pixelRatio: 1.25, shadows: true, shadowSize: 2048 },
  low: { pixelRatio: 0.8, shadows: false, shadowSize: 1024 },
};
const SHADOW_HALF = 34;
const SKY_SCALE = 900;
const SKY_GAIN = 0.5;
const DAY_KEYS = [
  { at: 0.0, elevation: 2, sun: 0xc9ced8, sunPower: 0.7, sky: 0xaab0bd, ground: 0x4a4038, hemi: 1.1, fog: 0xb8bdc6, exposure: 0.95 },
  { at: 0.12, elevation: 14, sun: 0xeef0f2, sunPower: 1.5, sky: 0xd8dce2, ground: 0x6e5a48, hemi: 1.75, fog: 0xc9ced4, exposure: 1.0 },
  { at: 0.42, elevation: 70, sun: 0xfbfbf8, sunPower: 1.9, sky: 0xe4e7ea, ground: 0x7e6650, hemi: 2.0, fog: 0xd2d6db, exposure: 0.95 },
  { at: 0.78, elevation: 18, sun: 0xf2eee6, sunPower: 1.5, sky: 0xd2d4d8, ground: 0x6a5646, hemi: 1.7, fog: 0xc4c7cc, exposure: 1.0 },
  { at: 1.0, elevation: -3, sun: 0xa9b0c4, sunPower: 0.5, sky: 0x8a90a6, ground: 0x40382f, hemi: 1.15, fog: 0x7d8296, exposure: 1.0 },
];
const CLOUD_HEIGHT = 150;

export const PALETTE = {
  steel: 0x8b979e, steelDark: 0x515b61, fasciaBlue: 0x2f62a8, fasciaRust: 0x8a4a2a, tyre: 0x1b1b1b, black: 0x222222,
  white: 0xffffff, cream: 0xf4ead5, lampShade: 0x2b2b2b, bulb: 0xfff1c9, red: 0xe5533d, table: 0x9b6b43,
  woodDark: 0x5e3b22, wood: 0x8a5a36, counterTop: 0xc9935e, rice: 0xfaf3e1, bowl: 0x2f6f9f, cashBox: 0x2f6d4e,
  notes: 0x9ccf8c, book: 0xa63d2e, chalk: 0x23392c, sackCloth: 0xd9c9a3, glass: 0x5d7380, skylight: 0xf4f6f2,
};

const TEXTURED = {
  corrTeal: ["corrugated", 0x5fa9a6, 1.6], corrBlue: ["corrugated", 0x4a7fb6, 1.6], corrYellow: ["corrugated", 0xf0b52a, 1.6],
  corrRoof: ["corrugated", 0xc9cdcf, 1.6], corrRust: ["corrugated", 0xa86a42, 1.6], corrGreen: ["corrugated", 0x75a070, 1.6],
  corrRed: ["corrugated", 0xb8493a, 1.6], corrGrey: ["corrugated", 0x9aa3a8, 1.6],
  dirtRed: ["ground", 0xffb48c, 5], dirtLane: ["ground", 0xf0d7b0, 5], earthLane: ["concrete", 0xe8cfa4, 2.6], concrete: ["concrete", 0xe2dccf, 3.2],
  concreteDark: ["concrete", 0xa49e94, 2.4], asphalt: ["concrete", 0x5a5856, 4],
  planks: ["planks", 0xc29a70, 2.2], planksDark: ["planks", 0x8a6646, 2.2], planksPainted: ["planks", 0xe8ddc8, 2.2],
  plasterCream: ["plaster", 0xf3e6cb, 3], plasterYellow: ["plaster", 0xf3c43a, 3], plasterBlue: ["plaster", 0xb1d2e6, 3],
  plasterPink: ["plaster", 0xefc0b0, 3], plasterWhite: ["plaster", 0xf6f3ec, 3], plasterGreen: ["plaster", 0xa9d3b0, 3],
};

const TEXTURE_FILES = {
  corrugated: ["corrugated_color.jpg", "corrugated_normal.jpg"], ground: ["ground_color.jpg", "ground_normal.jpg"],
  concrete: ["concrete_color.jpg", null], planks: ["planks_color.jpg", "planks_normal.jpg"], plaster: ["plaster_color.jpg", null],
};

export function createWorld(container) {
  /** Create the renderer, scene, sky, camera and lights, sized to the container. */
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY.high.pixelRatio));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = DAY_KEYS[0].exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(DAY_KEYS[0].fog, 70, 420);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1200);
  const sky = new Sky();
  sky.scale.setScalar(SKY_SCALE);
  Object.assign(sky.material.uniforms.turbidity, { value: 12 });
  sky.material.uniforms.rayleigh.value = 0.5;
  sky.material.uniforms.mieCoefficient.value = 0.02;
  sky.material.uniforms.mieDirectionalG.value = 0.7;
  sky.material.fog = false;
  sky.material.uniforms.skyGain = { value: SKY_GAIN };
  sky.material.fragmentShader = `uniform float skyGain;\n${sky.material.fragmentShader}`
    .replace("gl_FragColor = vec4( retColor, 1.0 );", "gl_FragColor = vec4( retColor * skyGain, 1.0 );");
  const hemi = new THREE.HemisphereLight(DAY_KEYS[0].sky, DAY_KEYS[0].ground, DAY_KEYS[0].hemi);
  const sun = new THREE.DirectionalLight(DAY_KEYS[0].sun, DAY_KEYS[0].sunPower);
  sun.castShadow = true;
  sun.shadow.mapSize.set(QUALITY.high.shadowSize, QUALITY.high.shadowSize);
  Object.assign(sun.shadow.camera, { left: -SHADOW_HALF, right: SHADOW_HALF, top: SHADOW_HALF, bottom: -SHADOW_HALF, near: 1, far: 160 });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.03;
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, fog: false, color: 0xe8eaee }));
  clouds.position.y = CLOUD_HEIGHT;
  scene.add(sky, clouds, hemi, sun, sun.target);
  const textures = loadTextures(renderer);
  const world = { renderer, scene, camera, sky, clouds, hemi, sun, textures, quality: "high", time: { value: 0 }, focus: new THREE.Vector3(),
    sunDirection: new THREE.Vector3(), lampLevel: 0 };
  world.materials = createMaterials(world);
  return world;
}

function loadTextures(renderer) {
  /** Load the CC0 colour and normal maps once, set to tile. */
  const loader = new THREE.TextureLoader();
  const anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const textures = {};
  for (const [name, [colorFile, normalFile]] of Object.entries(TEXTURE_FILES)) {
    const color = loader.load(TEXTURE_DIR + colorFile);
    color.colorSpace = THREE.SRGBColorSpace;
    color.wrapS = color.wrapT = THREE.RepeatWrapping;
    color.anisotropy = anisotropy;
    textures[name] = { color, normal: null };
    if (normalFile) {
      const normal = loader.load(TEXTURE_DIR + normalFile);
      normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
      textures[name].normal = normal;
    }
  }
  return textures;
}

function createMaterials(world) {
  /** Return the shared materials: tiled photo-scanned surfaces, flat colours and glowing bulbs. */
  const materials = {};
  for (const [name, color] of Object.entries(PALETTE)) {
    materials[name] = new THREE.MeshLambertMaterial({ color });
  }
  for (const [name, [texture, color, tile]] of Object.entries(TEXTURED)) {
    const maps = world.textures[texture];
    const material = new THREE.MeshLambertMaterial({ color, map: maps.color, normalMap: maps.normal });
    if (maps.normal) material.normalScale.set(0.8, 0.8);
    material.userData.tile = tile;
    materials[name] = material;
  }
  for (const name of ["corrTeal", "corrBlue", "corrYellow", "corrRoof", "corrRust", "corrGreen", "corrRed", "corrGrey"]) {
    materials[name].side = THREE.DoubleSide;
  }
  materials.bulb = new THREE.MeshBasicMaterial({ color: 0x8a7a60 });
  materials.skylight = new THREE.MeshBasicMaterial({ color: 0xf7f4ea, side: THREE.DoubleSide, fog: false });
  materials.shaft = new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.08, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  materials.lowStock = new THREE.MeshLambertMaterial({ color: PALETTE.wood, emissive: PALETTE.red, emissiveIntensity: 0.5 });
  materials.vertex = new THREE.MeshLambertMaterial({ vertexColors: true });
  materials.shopPlaster = materials.plasterCream.clone();
  materials.shopPlaster.emissive.setHex(0x4a3e30);
  materials.shopPlaster.userData.tile = 3;
  materials.shelfWood = materials.planksDark.clone();
  materials.shelfWood.emissive.setHex(0x2e2014);
  materials.shelfWood.userData.tile = 2.2;
  return materials;
}

export function accentMaterial(world, color) {
  /** Return the shared painted material for a shop accent colour, creating it once. */
  const key = `accent${color}`;
  if (!world.materials[key]) {
    world.materials[key] = new THREE.MeshLambertMaterial({ color, map: world.textures.plaster.color });
    world.materials[key].userData.tile = 3;
  }
  return world.materials[key];
}

function worldUVs(geometry, tile) {
  /** Give a placed geometry UVs from its world position, so textures tile at real scale on any size of box. */
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i += 1) {
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));
    let u;
    let v;
    if (ny >= nx && ny >= nz) {
      u = position.getX(i);
      v = position.getZ(i);
    } else if (nx >= nz) {
      u = position.getZ(i);
      v = position.getY(i);
    } else {
      u = position.getX(i);
      v = position.getY(i);
    }
    uv[i * 2] = u / tile;
    uv[i * 2 + 1] = v / tile;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

const scratchMatrix = new THREE.Matrix4();
const scratchQuaternion = new THREE.Quaternion();
const scratchEuler = new THREE.Euler();
const scratchPosition = new THREE.Vector3();
const scratchScale = new THREE.Vector3();

export function placement(position, rotation = null, scale = null) {
  /** Return a matrix for a position, an optional XYZ rotation and an optional scale. */
  scratchEuler.set(...(rotation || [0, 0, 0]));
  scratchQuaternion.setFromEuler(scratchEuler);
  scratchPosition.set(...position);
  scratchScale.set(...(scale || [1, 1, 1]));
  return new THREE.Matrix4().compose(scratchPosition, scratchQuaternion, scratchScale);
}

export class StaticBatch {
  /** Collect static shapes per material and merge each group into one mesh, to keep draw calls low. */

  constructor(world) {
    /** Start an empty batch for a world. */
    this.world = world;
    this.groups = new Map();
  }

  addMatrix(geometry, matrix, material) {
    /** Queue a geometry placed by a matrix under a material. */
    const placed = (geometry.index ? geometry.toNonIndexed() : geometry.clone()).applyMatrix4(matrix);
    for (const name of Object.keys(placed.attributes)) {
      if (!["position", "normal", "uv"].includes(name)) placed.deleteAttribute(name);
    }
    if (!placed.attributes.uv) placed.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(placed.attributes.position.count * 2), 2));
    if (!this.groups.has(material)) this.groups.set(material, []);
    this.groups.get(material).push(placed);
  }

  add(geometry, position, material, rotation = null, scale = null) {
    /** Queue a geometry at a position, with an optional rotation and scale, under a material. */
    this.addMatrix(geometry, placement(position, rotation, scale), material);
  }

  addObject(object) {
    /** Queue every mesh of an object group with its world transform, then leave the group unused. */
    object.updateMatrixWorld(true);
    object.traverse((child) => {
      if (child.isMesh) this.addMatrix(child.geometry, child.matrixWorld, child.material);
    });
  }

  box(size, position, material, rotation = null) {
    /** Queue a box of a size at a position. */
    this.add(new THREE.BoxGeometry(...size), position, material, rotation);
  }

  cylinder(radiusTop, radiusBottom, height, position, material, segments = 8, rotation = null) {
    /** Queue a low-poly cylinder at a position. */
    this.add(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), position, material, rotation);
  }

  build(parent, { cast = true, receive = true } = {}) {
    /** Merge every queued group into one mesh per material, with world-scale UVs on tiled materials. */
    const meshes = [];
    for (const [material, geometries] of this.groups) {
      const merged = mergeGeometries(geometries, false);
      if (material.userData && material.userData.tile) worldUVs(merged, material.userData.tile);
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = cast && !material.transparent;
      mesh.receiveShadow = receive;
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.groups.clear();
    return meshes;
  }
}

function lerpKeys(progress) {
  /** Return the two day-cycle keys around a progress value and the blend between them. */
  for (let index = 0; index < DAY_KEYS.length - 1; index += 1) {
    const from = DAY_KEYS[index];
    const to = DAY_KEYS[index + 1];
    if (progress <= to.at) return [from, to, (progress - from.at) / (to.at - from.at)];
  }
  return [DAY_KEYS[DAY_KEYS.length - 2], DAY_KEYS[DAY_KEYS.length - 1], 1];
}

const colorA = new THREE.Color();
const colorB = new THREE.Color();

function mix(target, from, to, blend) {
  /** Set a colour to a blend of two hex colours. */
  colorA.setHex(from);
  colorB.setHex(to);
  target.copy(colorA).lerp(colorB, blend);
}

export function applyDayCycle(world, progress) {
  /** Light the market for a point in the day: sun across the sky, warm evening, lamps at dusk. */
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  const [from, to, blend] = lerpKeys(p);
  const smooth = blend * blend * (3 - 2 * blend);
  mix(world.sun.color, from.sun, to.sun, smooth);
  world.sun.intensity = THREE.MathUtils.lerp(from.sunPower, to.sunPower, smooth);
  mix(world.hemi.color, from.sky, to.sky, smooth);
  mix(world.hemi.groundColor, from.ground, to.ground, smooth);
  world.hemi.intensity = THREE.MathUtils.lerp(from.hemi, to.hemi, smooth);
  mix(world.scene.fog.color, from.fog, to.fog, smooth);
  world.renderer.toneMappingExposure = THREE.MathUtils.lerp(from.exposure, to.exposure, smooth);
  const elevation = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(from.elevation, to.elevation, smooth));
  const azimuth = THREE.MathUtils.lerp(0.15, Math.PI - 0.15, p);
  world.sunDirection.set(Math.cos(elevation) * Math.cos(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.sin(azimuth) * 0.55 + 0.25).normalize();
  world.sky.material.uniforms.sunPosition.value.copy(world.sunDirection);
  const lift = Math.max(world.sunDirection.y, 0.12);
  world.sun.position.copy(world.focus).addScaledVector(world.sunDirection.clone().setY(lift).normalize(), 80);
  world.sun.target.position.copy(world.focus);
  world.lampLevel = Math.max(THREE.MathUtils.clamp((p - 0.74) / 0.2, 0, 1), THREE.MathUtils.clamp((0.1 - p) / 0.1, 0, 1));
  world.materials.bulb.color.setRGB(0.54 + world.lampLevel * 0.46, 0.48 + world.lampLevel * 0.42, 0.38 + world.lampLevel * 0.2);
  world.materials.shopPlaster.emissiveIntensity = 1 + world.lampLevel * 1.8;
  world.materials.shelfWood.emissiveIntensity = 1 + world.lampLevel * 1.8;
  world.materials.shaft.opacity = 0.05 + 0.05 * Math.sin(p * Math.PI);
  world.hemi.intensity += world.lampLevel * 0.2;
  world.clouds.material.map.offset.x = world.time.value * 0.0015;
  world.clouds.material.color.copy(world.scene.fog.color).multiplyScalar(1.12);
  return p < 0.35 ? "Morning" : p < 0.7 ? "Afternoon" : "Evening";
}

export function setFocus(world, point) {
  /** Centre the sun's shadow box on the part of the market the camera is looking at. */
  world.focus.copy(point);
  world.focus.y = 0;
}

export function setQuality(world, quality) {
  /** Switch between high quality (shadows, sharper pixels) and low quality (no shadows, fewer pixels). */
  world.quality = quality;
  const settings = QUALITY[quality];
  world.renderer.shadowMap.enabled = settings.shadows;
  world.sun.castShadow = settings.shadows;
  world.renderer.setPixelRatio(quality === "high" ? Math.min(window.devicePixelRatio, settings.pixelRatio)
    : Math.min(window.devicePixelRatio, 1) * settings.pixelRatio);
  world.scene.traverse((object) => {
    if (object.userData.detail) object.visible = quality === "high";
    if (object.material && !Array.isArray(object.material)) object.material.needsUpdate = true;
  });
}

export function resizeWorld(world, container) {
  /** Fit the renderer and camera to the container. */
  const width = container.clientWidth;
  const height = container.clientHeight;
  world.renderer.setSize(width, height);
  world.camera.aspect = width / height;
  world.camera.updateProjectionMatrix();
}

export function addSway(material, world, strength = 0.08) {
  /** Make instanced hanging goods swing gently about their top, in the vertex shader, at no CPU cost. */
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = world.time;
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace("#include <begin_vertex>", `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float swayPhase = dot(instanceMatrix[3].xz, vec2(1.7, 2.3));
        float swing = sin(uTime * 1.3 + swayPhase) * 0.6 + sin(uTime * 2.9 + swayPhase * 1.7) * 0.4;
        transformed.x += swing * ${strength.toFixed(3)} * max(-transformed.y, 0.0);
        transformed.z += cos(uTime * 1.1 + swayPhase) * ${(strength * 0.5).toFixed(3)} * max(-transformed.y, 0.0);
      #endif`);
  };
  material.customProgramCacheKey = () => `sway${strength}`;
  return material;
}
