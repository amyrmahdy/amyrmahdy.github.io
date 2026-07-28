import * as THREE from "three";

/**
 * Round brilliant at real grading proportions (girdle diameter = 1).
 * Made-up proportions read as programmer art instantly, even to people who
 * could not say why — the crown angle in particular.
 */
const TABLE = 0.56;
const CROWN_H = 0.145;
const GIRDLE_H = 0.03;
const PAV_H = 0.431;

export function buildBrilliant(segments = 16): THREE.BufferGeometry {
  const rGirdle = 1;
  const yTable = CROWN_H + GIRDLE_H / 2;
  const yGirdleTop = GIRDLE_H / 2;
  const yGirdleBot = -GIRDLE_H / 2;
  const yCulet = -(PAV_H + GIRDLE_H / 2);

  const ring = (r: number, y: number) =>
    Array.from({ length: segments }, (_, i) => {
      const a = (i / segments) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    });

  const table = ring(TABLE, yTable);
  const gTop = ring(rGirdle, yGirdleTop);
  const gBot = ring(rGirdle, yGirdleBot);
  const culet = new THREE.Vector3(0, yCulet, 0);
  const centre = new THREE.Vector3(0, yTable, 0);

  const pos: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);

  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    tri(centre, table[i], table[j]);
    tri(table[i], gTop[i], gTop[j]);
    tri(table[i], gTop[j], table[j]);
    tri(gTop[i], gBot[i], gBot[j]);
    tri(gTop[i], gBot[j], gTop[j]);
    tri(gBot[i], culet, gBot[j]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  // Flat normals: facets must read as facets, not as a smooth blob.
  geo.computeVertexNormals();
  return geo;
}

/** Diamond-cubic lattice sites, clipped to an octahedron — the crystal's real
 *  growth habit. Used for the carbon that collapses into the stone. */
export function latticeSites(target: number): THREE.Vector3[] {
  const A = 3.567;
  const BASIS = [
    [0, 0, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0],
    [0.25, 0.25, 0.25], [0.25, 0.75, 0.75], [0.75, 0.25, 0.75], [0.75, 0.75, 0.25],
  ];

  for (let n = 3; n <= 12; n++) {
    const half = (n * A) / 2;
    const R = half * 1.12;
    const kept: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        for (let k = 0; k < n; k++)
          for (const b of BASIS) {
            const x = (i + b[0]) * A - half;
            const y = (j + b[1]) * A - half;
            const z = (k + b[2]) * A - half;
            if (Math.abs(x) + Math.abs(y) + Math.abs(z) <= R) {
              kept.push(new THREE.Vector3(x, y, z));
            }
          }
    if (kept.length >= target || n === 12) {
      kept.sort((p, q) => p.lengthSq() - q.lengthSq());
      return kept.slice(0, target).map((v) => v.multiplyScalar(0.055));
    }
  }
  return [];
}
