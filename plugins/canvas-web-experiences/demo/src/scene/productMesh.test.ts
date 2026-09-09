import { describe, expect, it } from 'vitest';
import {
  createProductMesh,
  createSpatialMesh,
  meshVertexCount,
  PRODUCT_LOOP_SEGMENTS,
  PRODUCT_LOOP_SIDES,
  PRODUCT_MESH_PARTS,
  PRODUCT_MESH_STRIDE_FLOATS,
} from './productMesh';

function bounds(mesh: Float32Array) {
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < mesh.length; index += PRODUCT_MESH_STRIDE_FLOATS) {
    for (let axis = 0; axis < 3; axis += 1) {
      minimum[axis] = Math.min(minimum[axis], mesh[index + axis]);
      maximum[axis] = Math.max(maximum[axis], mesh[index + axis]);
    }
  }
  return { minimum, maximum };
}

describe('product mesh', () => {
  it('provides a dense interleaved triangle mesh with finite, unit-length normals', () => {
    const mesh = createProductMesh();
    expect(mesh).toBeInstanceOf(Float32Array);
    expect(mesh.length % (PRODUCT_MESH_STRIDE_FLOATS * 3)).toBe(0);
    expect(meshVertexCount(mesh)).toBeGreaterThan(6_000);

    for (let index = 0; index < mesh.length; index += PRODUCT_MESH_STRIDE_FLOATS) {
      const nx = mesh[index + 3];
      const ny = mesh[index + 4];
      const nz = mesh[index + 5];
      expect(Number.isFinite(mesh[index]) && Number.isFinite(mesh[index + 1]) && Number.isFinite(mesh[index + 2])).toBe(true);
      expect(Number.isFinite(nx) && Number.isFinite(ny) && Number.isFinite(nz)).toBe(true);
      expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 5);
    }
  });

  it('has genuine x, y, and z volume so a full yaw and pitch orbit reveals new surfaces', () => {
    const mesh = createProductMesh();
    const { minimum, maximum } = bounds(mesh);
    expect(maximum[0] - minimum[0]).toBeGreaterThan(1.8);
    expect(maximum[1] - minimum[1]).toBeGreaterThan(2.5);
    expect(maximum[2] - minimum[2]).toBeGreaterThan(0.8);

    const spatial = createSpatialMesh();
    expect(spatial.length % (PRODUCT_MESH_STRIDE_FLOATS * 3)).toBe(0);
    expect(bounds(spatial).maximum[2] - bounds(spatial).minimum[2]).toBeGreaterThan(1);
  });

  it('keeps every triangle nondegenerate and joins the loop deterministically at its wrap seam', () => {
    const mesh = createProductMesh();
    for (let triangle = 0; triangle < mesh.length; triangle += PRODUCT_MESH_STRIDE_FLOATS * 3) {
      const a = [mesh[triangle], mesh[triangle + 1], mesh[triangle + 2]];
      const b = [mesh[triangle + 6], mesh[triangle + 7], mesh[triangle + 8]];
      const c = [mesh[triangle + 12], mesh[triangle + 13], mesh[triangle + 14]];
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const twiceArea = Math.hypot(
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0],
      );
      expect(twiceArea).toBeGreaterThan(1e-5);
    }

    const loopStart = PRODUCT_MESH_PARTS.loopStartVertex * PRODUCT_MESH_STRIDE_FLOATS;
    const finalRing = loopStart + (PRODUCT_LOOP_SEGMENTS - 1) * PRODUCT_LOOP_SIDES * 6 * PRODUCT_MESH_STRIDE_FLOATS;
    for (let side = 0; side < PRODUCT_LOOP_SIDES; side += 1) {
      const firstRingVertex = loopStart + side * 6 * PRODUCT_MESH_STRIDE_FLOATS;
      const wrappedNextRingVertex = finalRing + (side * 6 + 1) * PRODUCT_MESH_STRIDE_FLOATS;
      for (let component = 0; component < PRODUCT_MESH_STRIDE_FLOATS; component += 1) {
        expect(mesh[wrappedNextRingVertex + component]).toBeCloseTo(mesh[firstRingVertex + component], 6);
      }
    }
  });
});
