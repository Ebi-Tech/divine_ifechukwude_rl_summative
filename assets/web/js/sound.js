import * as THREE from "three";
import { LAYOUT } from "./layout.js";
import { trafficEvents } from "./traffic.js";

const MASTER_LEVEL = 0.9;
const SOUND_DIR = "/assets/web/sounds/";
const BEDS = [
  { name: "market_kigali", zone: "market", level: 0.55 },
  { name: "market_kampala", zone: "hall", level: 0.6 },
  { name: "roadside_hawkers", zone: "gate", level: 0.55 },
  { name: "street_lagos", zone: "road", level: 0.32 },
  { name: "market_far", zone: "far", level: 0.4 },
];
const VOICE_SOURCES = ["market_kigali", "street_lagos", "roadside_hawkers", "market_kampala"];
const MAX_VOICES = 4;
const MAX_SHOTS = 10;
const ENGINE_SLOTS = 3;
const ENGINE_RANGE = 32;
const EVENT_RANGE = 75;
const ENGINE_TONE = {
  moto: { base: 52, perSpeed: 9, wave: "sawtooth", cutoff: 1100, level: 0.16 },
  car: { base: 34, perSpeed: 4, wave: "sawtooth", cutoff: 420, level: 0.14 },
  pickup: { base: 30, perSpeed: 4, wave: "sawtooth", cutoff: 380, level: 0.16 },
  coach: { base: 24, perSpeed: 3, wave: "square", cutoff: 260, level: 0.26 },
  truck: { base: 26, perSpeed: 4, wave: "square", cutoff: 300, level: 0.28 },
};
const GATES = [[LAYOUT.block.west - 4, LAYOUT.mainGate.z], [LAYOUT.facadeGate.x, LAYOUT.block.north - 4], [LAYOUT.southGate.x, LAYOUT.block.south + 4], [LAYOUT.busPark.x1, LAYOUT.busPark.gateZ]];
const forward = new THREE.Vector3();

function smooth(value) {
  /** Clamp to 0..1 and ease, for soft zone edges. */
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function boxDistance(x, z, x0, z0, x1, z1) {
  /** Return how far a ground point lies outside a rectangle (0 inside). */
  return Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
}

function zoneWeights(position) {
  /** Weigh each recorded bed by where the listener stands: lanes, hall, gates, roads, or high above it all. */
  const { x, y, z } = position;
  const B = LAYOUT.block;
  const H = LAYOUT.hall;
  const R = LAYOUT.roads;
  const inHall = boxDistance(x, z, H.xMin, H.zMin, H.xMax, H.zMax);
  const inBlock = boxDistance(x, z, B.west, B.north, B.east, B.south);
  const road = Math.min(Math.abs(z - R.north), Math.abs(z - R.south), Math.abs(x - R.west), Math.abs(x - R.east));
  const gate = Math.min(...GATES.map(([gx, gz]) => Math.hypot(x - gx, z - gz)));
  const height = smooth((y - 6) / 45);
  const near = 1 - 0.55 * height;
  return {
    market: near * (inHall === 0 ? 0.35 : 1) * (1 - 0.8 * smooth(inBlock / 30)),
    hall: near * (1 - smooth(inHall / 10)),
    gate: near * (1 - smooth((gate - 10) / 30)),
    road: near * (1 - smooth((road - 4) / 14)),
    far: 0.25 + 0.75 * height,
  };
}

function panner(context, position, output, ref = 4) {
  /** Make a positional source at a world point, fading with distance from the camera. */
  const node = context.createPanner();
  node.panningModel = "equalpower";
  node.distanceModel = "inverse";
  node.refDistance = ref;
  node.rolloffFactor = 1.1;
  node.maxDistance = 120;
  setPosition(node, position);
  node.connect(output);
  return node;
}

function setPosition(node, { x, y, z }) {
  /** Move a panner, with the older setter as a fallback. */
  if (node.positionX) {
    node.positionX.value = x;
    node.positionY.value = y;
    node.positionZ.value = z;
  } else {
    node.setPosition(x, y, z);
  }
}

function placeListener(context, camera) {
  /** Put the ears where the camera is, facing where it looks. */
  const listener = context.listener;
  camera.getWorldDirection(forward);
  const p = camera.position;
  if (listener.positionX) {
    listener.positionX.value = p.x;
    listener.positionY.value = p.y;
    listener.positionZ.value = p.z;
    listener.forwardX.value = forward.x;
    listener.forwardY.value = forward.y;
    listener.forwardZ.value = forward.z;
    listener.upX.value = 0;
    listener.upY.value = 1;
    listener.upZ.value = 0;
  } else {
    listener.setPosition(p.x, p.y, p.z);
    listener.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
  }
}

async function loadBuffers(sound) {
  /** Fetch and decode the recorded market loops and calls. */
  const names = [...new Set([...BEDS.map((bed) => bed.name), "call_street"])];
  await Promise.all(names.map(async (name) => {
    try {
      const response = await fetch(`${SOUND_DIR}${name}.mp3`);
      sound.buffers[name] = await sound.context.decodeAudioData(await response.arrayBuffer());
    } catch (error) {
      console.warn(`sound: could not load ${name}`, error);
    }
  }));
  for (const bed of BEDS) {
    const buffer = sound.buffers[bed.name];
    if (!buffer) continue;
    const source = sound.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = sound.context.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(sound.bus);
    source.start(0, Math.random() * buffer.duration);
    sound.beds.push({ ...bed, gain });
  }
}

function makeEngines(sound) {
  /** Build a few engine voices that follow the nearest moving vehicles. */
  const { context } = sound;
  for (let i = 0; i < ENGINE_SLOTS; i += 1) {
    const main = context.createOscillator();
    const sub = context.createOscillator();
    sub.type = "triangle";
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    const gain = context.createGain();
    gain.gain.value = 0;
    const node = panner(context, { x: 0, y: 0, z: 0 }, sound.bus, 5);
    main.connect(filter);
    sub.connect(filter);
    filter.connect(gain).connect(node);
    const wobble = context.createOscillator();
    const depth = context.createGain();
    wobble.frequency.value = 7 + i * 1.7;
    depth.gain.value = 2.5;
    wobble.connect(depth);
    depth.connect(main.frequency);
    main.start();
    sub.start();
    wobble.start();
    sound.engines.push({ main, sub, filter, gain, node, vehicle: null });
  }
}

function updateEngines(sound, traffic, camera) {
  /** Give the nearest running vehicles an engine note that rises with their speed. */
  const near = [];
  for (const group of [traffic.loopVehicles, traffic.parking, traffic.gateMotos, traffic.coaches, traffic.dirt]) {
    for (const vehicle of group) {
      if (!vehicle.visible || (vehicle.state === "parked" && vehicle.speed < 0.1)) continue;
      const distance = vehicle.pos.distanceTo(camera.position);
      if (distance < ENGINE_RANGE) near.push([distance, vehicle]);
    }
  }
  near.sort((a, b) => a[0] - b[0]);
  const now = sound.context.currentTime;
  sound.engines.forEach((engine, i) => {
    const vehicle = near[i]?.[1];
    if (!vehicle) {
      engine.gain.gain.setTargetAtTime(0, now, 0.3);
      return;
    }
    const tone = ENGINE_TONE[vehicle.kind] || ENGINE_TONE.car;
    if (engine.vehicle !== vehicle) {
      engine.main.type = tone.wave;
      engine.filter.frequency.setValueAtTime(tone.cutoff, now);
      engine.vehicle = vehicle;
    }
    const pitch = tone.base + vehicle.speed * tone.perSpeed;
    engine.main.frequency.setTargetAtTime(pitch, now, 0.15);
    engine.sub.frequency.setTargetAtTime(pitch / 2, now, 0.15);
    engine.gain.gain.setTargetAtTime(tone.level * (0.35 + 0.65 * Math.min(vehicle.speed / 6, 1)), now, 0.2);
    setPosition(engine.node, { x: vehicle.pos.x, y: 0.6, z: vehicle.pos.z });
  });
}

function envelope(gain, start, peak, attack, hold, release) {
  /** Shape a short sound: rise, hold, then fall away. */
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  gain.gain.setValueAtTime(peak, start + attack + hold);
  gain.gain.linearRampToValueAtTime(0, start + attack + hold + release);
  return start + attack + hold + release;
}

function horn(sound, event) {
  /** Sound a horn: a thin double beep for motos, a two-note car horn, a deep long blast for coaches. */
  const { context } = sound;
  const node = panner(context, { x: event.pos.x, y: 1, z: event.pos.z }, sound.bus, 6);
  const notes = event.kind === "moto" ? [620 + Math.random() * 80] : (event.kind === "coach" || event.kind === "truck") ? [262, 330] : [405 + Math.random() * 30, 505 + Math.random() * 30];
  const beeps = event.kind === "moto" ? 2 + Math.floor(Math.random() * 2) : Math.random() < 0.4 ? 2 : 1;
  const long = (event.kind === "coach" || event.kind === "truck") ? 0.9 : event.kind === "moto" ? 0.11 : 0.22 + Math.random() * 0.4;
  const level = (event.kind === "coach" || event.kind === "truck") ? 0.3 : event.kind === "moto" ? 0.14 : 0.2;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = event.kind === "moto" ? 3500 : 2200;
  const gain = context.createGain();
  filter.connect(gain).connect(node);
  let t = context.currentTime + 0.02;
  let end = t;
  for (let b = 0; b < beeps; b += 1) {
    end = envelope(gain, t, level, 0.015, long, 0.04);
    t = end + 0.09;
  }
  for (const frequency of notes) {
    const oscillator = context.createOscillator();
    oscillator.type = "square";
    oscillator.frequency.value = frequency;
    oscillator.connect(filter);
    oscillator.start(context.currentTime);
    oscillator.stop(end + 0.05);
  }
  return end;
}

function whistle(sound, event) {
  /** Blow a police whistle: a shrill trilled note, one long blast when the officer switches the flow, else a few short ones. */
  const { context } = sound;
  const node = panner(context, event.pos, sound.bus, 8);
  const oscillator = context.createOscillator();
  oscillator.frequency.value = 2900 + Math.random() * 400;
  const trill = context.createOscillator();
  const depth = context.createGain();
  trill.frequency.value = 26 + Math.random() * 8;
  depth.gain.value = 180;
  trill.connect(depth).connect(oscillator.frequency);
  const gain = context.createGain();
  oscillator.connect(gain).connect(node);
  const blasts = event.long ? [0.75, 0.18] : Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => 0.12 + Math.random() * 0.12);
  let t = context.currentTime + 0.02;
  for (const length of blasts) {
    envelope(gain, t, 0.11, 0.01, length, 0.03);
    t += length + 0.14;
  }
  oscillator.start();
  trill.start();
  oscillator.stop(t);
  trill.stop(t);
  return t;
}

function airBrake(sound, event) {
  /** Let a coach's air brakes hiss as it stops. */
  const { context } = sound;
  const node = panner(context, { x: event.pos.x, y: 0.5, z: event.pos.z }, sound.bus, 6);
  const source = context.createBufferSource();
  source.buffer = sound.noise;
  const band = context.createBiquadFilter();
  band.type = "highpass";
  band.frequency.value = 2400;
  const gain = context.createGain();
  source.connect(band).connect(gain).connect(node);
  const end = envelope(gain, context.currentTime + 0.05, 0.22, 0.02, 0.15, 0.7);
  source.start();
  source.stop(end);
  return end;
}

function noiseBuffer(context, seconds) {
  /** Return a buffer of white noise for hisses. */
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function playEvents(sound, camera) {
  /** Play the horns, whistles and brakes the traffic reported this frame, if they are within earshot. */
  const now = sound.context.currentTime;
  sound.shots = sound.shots.filter((end) => end > now);
  for (const event of trafficEvents) {
    if (sound.shots.length >= MAX_SHOTS || event.pos.distanceTo(camera.position) > EVENT_RANGE) continue;
    const play = event.type === "horn" ? horn : event.type === "whistle" ? whistle : airBrake;
    sound.shots.push(play(sound, event));
  }
}

function voice(sound, crowd, camera, busy) {
  /** Let someone nearby speak or call out: a few seconds cut from the recorded markets, placed at a person in the crowd. */
  const { context } = sound;
  const now = context.currentTime;
  sound.voices = sound.voices.filter((end) => end > now);
  if (sound.voices.length >= MAX_VOICES) return;
  const people = crowd.people;
  let person = null;
  for (let tries = 0; tries < 12 && !person; tries += 1) {
    const candidate = people[Math.floor(Math.random() * people.length)];
    if (candidate?.active && Math.hypot(candidate.x - camera.position.x, candidate.z - camera.position.z) < 28) person = candidate;
  }
  if (!person) return;
  const call = Math.random() < 0.12;
  const buffer = sound.buffers[call ? "call_street" : VOICE_SOURCES[Math.floor(Math.random() * VOICE_SOURCES.length)]];
  if (!buffer) return;
  const length = call ? buffer.duration : 2.5 + Math.random() * 2.5;
  const offset = call ? 0 : Math.random() * (buffer.duration - length);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = 0.94 + Math.random() * 0.12;
  const band = context.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1100;
  band.Q.value = 0.6;
  const gain = context.createGain();
  source.connect(band).connect(gain).connect(panner(context, { x: person.x, y: 1.6, z: person.z }, sound.bus, 3));
  const end = envelope(gain, now, (call ? 0.9 : 0.75) * (0.7 + busy * 0.5), 0.25, length - 0.6, 0.35);
  source.start(now, offset);
  source.stop(end);
  sound.voices.push(end);
}

export function createSound() {
  /** Create the optional market sound, silent until switched on. */
  return { context: null, master: null, bus: null, on: false, buffers: {}, beds: [], engines: [], shots: [], voices: [], nextVoice: 0, noise: null };
}

export function setSound(sound, on) {
  /** Switch the market sound on or off; the audio graph and recordings are loaded the first time it is switched on. */
  sound.on = on;
  if (on && !sound.context) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    const context = new AudioContext();
    sound.context = context;
    sound.master = context.createGain();
    sound.master.gain.value = 0;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 8;
    sound.master.connect(limiter).connect(context.destination);
    sound.bus = sound.master;
    sound.noise = noiseBuffer(context, 1.5);
    makeEngines(sound);
    loadBuffers(sound);
  }
  if (!sound.context) return on;
  if (on) sound.context.resume();
  sound.master.gain.setTargetAtTime(on ? MASTER_LEVEL : 0, sound.context.currentTime, 0.4);
  return on;
}

export function updateSound(sound, { busy, time, camera, crowd, traffic }) {
  /** Mix the market for where the camera is: recorded beds by zone, nearby voices, engines, and the traffic's horns and whistles. */
  if (!sound.on || !sound.context) {
    trafficEvents.length = 0;
    return;
  }
  const now = sound.context.currentTime;
  placeListener(sound.context, camera);
  const weights = zoneWeights(camera.position);
  for (const bed of sound.beds) {
    const crowdLift = bed.zone === "market" || bed.zone === "hall" ? 0.55 + busy * 0.6 : 1;
    bed.gain.gain.setTargetAtTime(bed.level * weights[bed.zone] * crowdLift, now, 0.6);
  }
  if (traffic) {
    updateEngines(sound, traffic, camera);
    playEvents(sound, camera);
  }
  trafficEvents.length = 0;
  if (crowd && time > sound.nextVoice && camera.position.y < 25) {
    voice(sound, crowd, camera, busy);
    sound.nextVoice = time + 0.5 + Math.random() * (2.2 - busy * 1.4);
  }
}
