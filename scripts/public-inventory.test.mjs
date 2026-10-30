import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectPngMetadata, verifyPublicInventory} from './public-inventory.mjs';

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function chunk(type, data = Buffer.alloc(0)) {
  const bytes = Buffer.alloc(12 + data.length);
  bytes.writeUInt32BE(data.length);
  bytes.write(type, 4, 4, 'ascii');
  data.copy(bytes, 8);
  return bytes;
}
const png = Buffer.concat([pngSignature, chunk('IDAT'), chunk('IEND')]);
function fixture() {
  const content = new Map([['README.md', Buffer.from('Synthetic public example')], ['demo.png', png]]);
  const inventory = {
    schemaVersion: 1, baselineCommit: 'a'.repeat(40),
    files: [...content.keys()].map(path => ({path, origin: 'synthetic-fixture'})),
    mediaReviews: [{path: 'demo.png', sha256: createHash('sha256').update(png).digest('hex'),
      reviewedOn: '2026-01-01', review: 'content-and-metadata-reviewed', sourceReference: 'README.md'}]
  };
  return {content, inventory, run: () => verifyPublicInventory(inventory, [...content.keys()], name => content.get(name))};
}

test('exact public inventory and hash-bound media declaration pass', () => {
  assert.deepEqual(fixture().run(), []);
});
test('new file cannot silently enter the public projection', () => {
  const f = fixture();
  f.content.set('notes.md', Buffer.from('Synthetic private note'));
  assert(f.run().some(x => x.reasons.includes('unlisted-public-file')));
});
test('missing provenance and duplicate/case-colliding entries fail', () => {
  const f = fixture();
  f.inventory.files[0].origin = 'private-work';
  f.inventory.files.push({path: 'DEMO.PNG', origin: 'synthetic-fixture'});
  const reasons = f.run().flatMap(x => x.reasons);
  assert(reasons.includes('invalid-file-provenance'));
  assert(reasons.includes('duplicate-public-inventory-path'));
});
test('media needs a review for the exact bytes and an included source reference', () => {
  const f = fixture();
  f.content.set('demo.png', Buffer.from('changed synthetic bytes'));
  assert(f.run().some(x => x.reasons.includes('media-review-hash-mismatch')));
  f.inventory.mediaReviews[0].sourceReference = 'missing.md';
  assert(f.run().some(x => x.reasons.includes('invalid-media-review')));
  f.inventory.mediaReviews = [];
  assert(f.run().some(x => x.reasons.includes('media-review-required')));
});
test('PNG contact text, compressed text, XMP and EXIF require removal', () => {
  for (const kind of ['tEXt', 'zTXt', 'iTXt', 'eXIf']) {
    const bytes = Buffer.concat([pngSignature, chunk(kind, Buffer.from('synthetic metadata')), chunk('IEND')]);
    assert.deepEqual(inspectPngMetadata(bytes), ['png-text-or-exif-metadata']);
  }
  assert.deepEqual(inspectPngMetadata(png.subarray(0, 12)), ['invalid-png']);
});
test('media cannot cite itself or another binary as a source document', () => {
  const f = fixture();
  f.inventory.mediaReviews[0].sourceReference = 'demo.png';
  assert(f.run().some(x => x.reasons.includes('invalid-media-review')));
  f.content.set('other.png', png);
  f.inventory.files.push({path: 'other.png', origin: 'synthetic-fixture'});
  f.inventory.mediaReviews[0].sourceReference = 'other.png';
  assert(f.run().some(x => x.reasons.includes('invalid-media-review')));
});
test('unknown schema fields, unsafe paths and absent reviewed source files fail', () => {
  const f = fixture();
  f.inventory.extra = 'synthetic';
  assert(f.run().some(x => x.reasons.includes('invalid-public-inventory')));
  delete f.inventory.extra;
  f.inventory.files[0].path = '../outside.md';
  assert(f.run().some(x => x.reasons.includes('invalid-file-provenance')));
  f.inventory.files[0].path = 'absent.md';
  assert(f.run().some(x => x.reasons.includes('listed-public-file-missing')));
});
