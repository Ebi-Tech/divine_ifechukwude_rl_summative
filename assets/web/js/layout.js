export const LAYOUT = {
  lane: { xMin: -30, xMax: 22, zMin: -1.5, zMax: 3.0, center: 0.75, ambientZ: [0.55, 2.85] },
  shopXs: [-12, -6, 0, 6, 12],
  shop: { front: -2.0, back: -8.0, width: 5.6 },
  northNeighbours: [-24, -18, 18],
  northRoof: { xMin: -27.2, xMax: 21.2, front: -0.9, back: -8.3, low: 4.45, high: 5.3 },
  southFront: { front: 3.5, back: 7.9, xs: [-27.5, -23.5, -19.5, -15.5, -9.2, -5.2, -1.2, 2.8, 9.15, 13.15, 17.15] },
  southBack: { front: 12.4, back: 8.1, xs: [-27.5, -23.5, -19.5, -15.5, -9.2, -5.2, -1.2, 2.8, 9.15, 13.15, 17.15] },
  passages: [-12.4, 5.95],
  clothes: { zMin: 12.4, zMax: 16.6, center: 14.5 },
  southRow: { front: 16.6, back: 21.4, xs: [-27.5, -23.5, -19.5, -15.5, -11.5, -7.5, -3.5, 0.5, 4.5, 8.5, 12.5, 16.5] },
  hall: { xMin: 22, xMax: 62, zMin: -18, zMax: 22, eave: 7.2, ridge: 10.6, ridgeZ: 2 },
  hallAisles: [-14.3, -6.6, 0.75, 8.1, 14.5],
  hallCross: [35.5, 48.5],
  facadeX: -30,
  archX: -30,
  yard: { xMin: -48, xMax: -30.5, zMin: -20, zMax: 26 },
  road: { x: -52.5, width: 8 },
  block: { west: -30, south: 31, east: 66, north: -18.2, roadsideBack: -44.8, roadsideFront: -39.6 },
  roads: { west: -52.5, north: -31.5, south: 35.2, east: 75, width: 7 },
  mainGate: { z: 0.75, width: 6 },
  facadeGate: { x: 50, opening: 5 },
  southGate: { x: 28, width: 5 },
  walk: { xMin: -62, xMax: 80, zMin: -39.2, zMax: 75 },
  busPark: { x0: 8, x1: 70, z0: 39.6, z1: 75.5, gateZ: 51.5, gateWidth: 9 },
  across: { x: -63 },
};

export const colliders = [];

export function addCollider(x0, z0, x1, z1) {
  /** Register a solid rectangle on the ground plan that walkers and the walk camera cannot enter. */
  colliders.push({ minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1) });
}

export function pushOutOfColliders(position, radius) {
  /** Move a ground position out of every collider it overlaps, keeping a radius of clearance. */
  for (const box of colliders) {
    const nearestX = Math.max(box.minX, Math.min(position.x, box.maxX));
    const nearestZ = Math.max(box.minZ, Math.min(position.z, box.maxZ));
    const dx = position.x - nearestX;
    const dz = position.z - nearestZ;
    const distance = Math.hypot(dx, dz);
    if (distance >= radius) continue;
    if (distance > 1e-5) {
      position.x = nearestX + (dx / distance) * radius;
      position.z = nearestZ + (dz / distance) * radius;
    } else {
      const exits = [[box.minX - radius - position.x, 0], [box.maxX + radius - position.x, 0],
        [0, box.minZ - radius - position.z], [0, box.maxZ + radius - position.z]];
      exits.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
      position.x += exits[0][0];
      position.z += exits[0][1];
    }
  }
}

export function makeRoute(points) {
  /** Turn a list of [x, z] ground points into a route with cumulative lengths, for walking or driving along it. */
  const vectors = points.map(([x, z]) => ({ x, z }));
  const lengths = [0];
  for (let i = 1; i < vectors.length; i += 1) {
    lengths.push(lengths[i - 1] + Math.hypot(vectors[i].x - vectors[i - 1].x, vectors[i].z - vectors[i - 1].z));
  }
  return { points: vectors, lengths, total: lengths[lengths.length - 1] };
}

export function routePoint(route, distance, out, direction) {
  /** Write the ground point at a distance along a route into out, and the unit direction of travel into direction. */
  const d = Math.min(Math.max(distance, 0), route.total);
  let i = 1;
  while (i < route.lengths.length - 1 && route.lengths[i] < d) i += 1;
  const a = route.points[i - 1];
  const b = route.points[i];
  const span = Math.max(route.lengths[i] - route.lengths[i - 1], 1e-6);
  const t = (d - route.lengths[i - 1]) / span;
  out.set(a.x + (b.x - a.x) * t, 0, a.z + (b.z - a.z) * t);
  direction.set((b.x - a.x) / span, 0, (b.z - a.z) / span);
}

export function seeded(index, salt = 0) {
  /** Return a stable pseudo-random number in [0, 1) so the market looks the same on every run. */
  const value = Math.sin(index * 127.1 + salt * 311.7 + 17.3) * 43758.5453;
  return value - Math.floor(value);
}
