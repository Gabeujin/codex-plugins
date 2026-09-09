/**
 * Dependency-free, non-indexed triangle meshes for the raw WebGL product view.
 * Layout is position.xyz + normal.xyz, six floats per vertex.
 */
export const PRODUCT_MESH_STRIDE_FLOATS = 6;
export const PRODUCT_LOOP_SEGMENTS = 96;
export const PRODUCT_LOOP_SIDES = 24;
export const PRODUCT_MESH_PARTS = {
  // Kept explicit so renderers and tests can identify the continuous loop region.
  pedestalVertexCount: 1152,
  stemVertexCount: 216,
  loopStartVertex: 1368,
};

type Vec3 = readonly [number, number, number];
type Writer = number[];

const EPSILON = 1e-8;

function subtract(a: Vec3, b: Vec3): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(value: Vec3): [number, number, number] {
  const length = Math.hypot(value[0], value[1], value[2]);
  return length > EPSILON ? [value[0] / length, value[1] / length, value[2] / length] : [0, 1, 0];
}

function writeVertex(out: Writer, position: Vec3, normal: Vec3): void {
  out.push(position[0], position[1], position[2], normal[0], normal[1], normal[2]);
}

function writeTriangle(out: Writer, a: Vec3, b: Vec3, c: Vec3, na: Vec3, nb: Vec3, nc: Vec3): void {
  writeVertex(out, a, na);
  writeVertex(out, b, nb);
  writeVertex(out, c, nc);
}

function pointOnLoop(t: number, spatial: boolean): [number, number, number] {
  const radius = spatial ? 0.96 : 1.05;
  const harmonic = spatial ? 2 : 3;
  return [
    radius * Math.cos(t) + (spatial ? 0.16 * Math.cos(3 * t) : 0),
    0.22 + 1.22 * Math.sin(t) + 0.19 * Math.sin(harmonic * t),
    (spatial ? 0.58 : 0.46) * Math.sin(2 * t) + 0.12 * Math.sin(3 * t),
  ];
}

/** Adds a closed tube around an asymmetric vertical loop. */
function addTwistedLoop(out: Writer, spatial: boolean): void {
  const segments = spatial ? 84 : PRODUCT_LOOP_SEGMENTS;
  const sides = spatial ? 20 : PRODUCT_LOOP_SIDES;
  const tubeRadius = spatial ? 0.145 : 0.17;
  const positions: Vec3[] = [];
  const tangents: Vec3[] = [];
  const frameU: Vec3[] = [];
  const frameV: Vec3[] = [];

  for (let index = 0; index < segments; index += 1) {
    const t = (index / segments) * Math.PI * 2;
    const previous = pointOnLoop(((index - 1 + segments) / segments) * Math.PI * 2, spatial);
    const next = pointOnLoop(((index + 1) / segments) * Math.PI * 2, spatial);
    const tangent = normalize(subtract(next, previous));
    // The loop always has an xy tangent, so this reference cannot become
    // parallel. A single reference avoids the visible frame switch seam.
    const reference: Vec3 = [0, 0, 1];
    const u = normalize(cross(reference, tangent));
    positions.push(pointOnLoop(t, spatial));
    tangents.push(tangent);
    frameU.push(u);
    frameV.push(normalize(cross(tangent, u)));
  }

  const vertex = (ring: number, side: number): { position: Vec3; normal: Vec3 } => {
    // Complete an integer turn around the closed centerline: ring 0 and the
    // wrapped final ring then meet with the same frame orientation.
    const angle = (side / sides) * Math.PI * 2 + (ring / segments) * Math.PI * 2;
    const u = frameU[ring];
    const v = frameV[ring];
    const normal: [number, number, number] = normalize([
      u[0] * Math.cos(angle) + v[0] * Math.sin(angle),
      u[1] * Math.cos(angle) + v[1] * Math.sin(angle),
      u[2] * Math.cos(angle) + v[2] * Math.sin(angle),
    ]);
    const center = positions[ring];
    return {
      position: [center[0] + normal[0] * tubeRadius, center[1] + normal[1] * tubeRadius, center[2] + normal[2] * tubeRadius],
      normal,
    };
  };

  for (let ring = 0; ring < segments; ring += 1) {
    const nextRing = (ring + 1) % segments;
    for (let side = 0; side < sides; side += 1) {
      const nextSide = (side + 1) % sides;
      const a = vertex(ring, side);
      const b = vertex(nextRing, side);
      const c = vertex(nextRing, nextSide);
      const d = vertex(ring, nextSide);
      writeTriangle(out, a.position, b.position, d.position, a.normal, b.normal, d.normal);
      writeTriangle(out, b.position, c.position, d.position, b.normal, c.normal, d.normal);
    }
  }
}

/** Adds a lathed, closed pedestal without degenerate pole triangles. */
function addPedestal(out: Writer, spatial: boolean): void {
  const segments = 32;
  const profile: ReadonlyArray<readonly [number, number]> = spatial
    ? [[0.3, -1.68], [0.46, -1.58], [0.44, -1.43], [0.26, -1.31], [0.1, -1.21], [0.1, -0.86]]
    : [[0.32, -1.7], [0.5, -1.59], [0.5, -1.43], [0.38, -1.32], [0.15, -1.24], [0.12, -0.86]];
  const vertex = (profileIndex: number, segment: number): { position: Vec3; normal: Vec3 } => {
    const [radius, y] = profile[profileIndex];
    const before = profile[Math.max(0, profileIndex - 1)];
    const after = profile[Math.min(profile.length - 1, profileIndex + 1)];
    const dr = after[0] - before[0];
    const dy = after[1] - before[1];
    const angle = (segment / segments) * Math.PI * 2;
    const normal = normalize([dy * Math.cos(angle), -dr, dy * Math.sin(angle)]);
    return { position: [radius * Math.cos(angle), y, radius * Math.sin(angle)], normal };
  };

  for (let row = 0; row < profile.length - 1; row += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const a = vertex(row, segment);
      const b = vertex(row + 1, segment);
      const c = vertex(row + 1, next);
      const d = vertex(row, next);
      writeTriangle(out, a.position, d.position, b.position, a.normal, d.normal, b.normal);
      writeTriangle(out, b.position, d.position, c.position, b.normal, d.normal, c.normal);
    }
  }

  const addCap = (profileIndex: number, y: number, normal: Vec3, reverse: boolean) => {
    const center: Vec3 = [0, y, 0];
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const a = vertex(profileIndex, segment).position;
      const b = vertex(profileIndex, next).position;
      if (reverse) writeTriangle(out, center, b, a, normal, normal, normal);
      else writeTriangle(out, center, a, b, normal, normal, normal);
    }
  };
  addCap(0, spatial ? -1.7 : -1.72, [0, -1, 0], true);
  addCap(profile.length - 1, -0.84, [0, 1, 0], false);
}

function addStem(out: Writer, spatial: boolean): void {
  const sides = 18;
  const radius = spatial ? 0.1 : 0.12;
  const bottom = -1.04;
  const top = -0.62;
  for (let side = 0; side < sides; side += 1) {
    const next = (side + 1) % sides;
    const angle = (side / sides) * Math.PI * 2;
    const nextAngle = (next / sides) * Math.PI * 2;
    const normal: Vec3 = [Math.cos(angle), 0, Math.sin(angle)];
    const nextNormal: Vec3 = [Math.cos(nextAngle), 0, Math.sin(nextAngle)];
    const a: Vec3 = [radius * normal[0], bottom, radius * normal[2]];
    const b: Vec3 = [radius * normal[0], top, radius * normal[2]];
    const c: Vec3 = [radius * nextNormal[0], top, radius * nextNormal[2]];
    const d: Vec3 = [radius * nextNormal[0], bottom, radius * nextNormal[2]];
    writeTriangle(out, a, d, b, normal, nextNormal, normal);
    writeTriangle(out, b, d, c, normal, nextNormal, nextNormal);
    const bottomCenter: Vec3 = [0, bottom, 0];
    const topCenter: Vec3 = [0, top, 0];
    writeTriangle(out, bottomCenter, d, a, [0, -1, 0], [0, -1, 0], [0, -1, 0]);
    writeTriangle(out, topCenter, b, c, [0, 1, 0], [0, 1, 0], [0, 1, 0]);
  }
}

function buildSculpture(spatial: boolean): Float32Array {
  const out: Writer = [];
  addPedestal(out, spatial);
  addStem(out, spatial);
  addTwistedLoop(out, spatial);
  return new Float32Array(out);
}

/** A premium, closed-volume loop sculpture on a lathed base and mounting stem. */
export function createProductMesh(): Float32Array {
  return buildSculpture(false);
}

/** A slightly tighter, more faceted alternative for a spatial/gallery route. */
export function createSpatialMesh(): Float32Array {
  return buildSculpture(true);
}

export function meshVertexCount(mesh: Float32Array): number {
  return mesh.length / PRODUCT_MESH_STRIDE_FLOATS;
}
