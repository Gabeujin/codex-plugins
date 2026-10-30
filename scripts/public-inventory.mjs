import {createHash} from 'node:crypto';

const ORIGINS = new Set(['existing-public-repository', 'public-repository-change', 'synthetic-fixture']);
const MEDIA = /\.(?:png|jpe?g|gif|webp|avif|pdf|ttf|otf|woff2?|mp3|wav|ogg)$/i;
const HEX = /^[a-f0-9]{64}$/;

function closed(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every(key => Object.hasOwn(value, key));
}

function safePath(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 500
    && !value.includes('\\') && !value.includes(':') && !value.startsWith('/')
    && !value.split('/').some(part => part === '..' || part === '.' || part === '');
}

export function inspectPngMetadata(bytes) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!bytes.subarray(0, 8).equals(signature)) return ['invalid-png'];
  let offset = 8;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) return ['invalid-png'];
    const length = bytes.readUInt32BE(offset);
    if (length > bytes.length - offset - 12) return ['invalid-png'];
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (['tEXt', 'iTXt', 'zTXt', 'eXIf'].includes(type)) return ['png-text-or-exif-metadata'];
    offset += length + 12;
    if (type === 'IEND') return offset === bytes.length ? [] : ['invalid-png'];
  }
  return ['invalid-png'];
}

export function verifyPublicInventory(inventory, files, readBytes) {
  const findings = [];
  const add = (file, reason) => findings.push({file, reasons: [reason]});
  if (!closed(inventory, ['schemaVersion', 'baselineCommit', 'files', 'mediaReviews'])
      || inventory.schemaVersion !== 1 || !/^[a-f0-9]{40}$/.test(inventory.baselineCommit)
      || !Array.isArray(inventory.files) || inventory.files.length > 10_000
      || !Array.isArray(inventory.mediaReviews)) {
    return [{file: 'docs/PUBLIC-SOURCE-INVENTORY.json', reasons: ['invalid-public-inventory']}];
  }
  const actual = new Set(files);
  const allowed = new Map();
  const folded = new Set();
  // 출처가 없는 파일이 공개 대상에 섞이지 않도록 등록 목록과 실제 파일을 대조
  for (const row of inventory.files) {
    if (!closed(row, ['path', 'origin']) || !safePath(row.path) || !ORIGINS.has(row.origin)) {
      add('docs/PUBLIC-SOURCE-INVENTORY.json', 'invalid-file-provenance');
      continue;
    }
    if (folded.has(row.path.toLowerCase())) add(row.path, 'duplicate-public-inventory-path');
    folded.add(row.path.toLowerCase());
    allowed.set(row.path, row.origin);
    if (!actual.has(row.path)) add(row.path, 'listed-public-file-missing');
  }
  for (const name of actual) if (!allowed.has(name)) add(name, 'unlisted-public-file');
  const reviewed = new Set();
  // 이미지의 실제 바이트가 검토 기록과 달라지면 내용·메타데이터를 다시 확인하도록 차단
  for (const row of inventory.mediaReviews) {
    // 기존 검토는 기록된 해시에만 유효하므로 바뀐 이미지에는 새 검토가 필요
    if (!closed(row, ['path', 'sha256', 'reviewedOn', 'review', 'sourceReference'])
        || !safePath(row.path) || !HEX.test(row.sha256)
        || !/^\d{4}-\d{2}-\d{2}$/.test(row.reviewedOn)
        || row.review !== 'content-and-metadata-reviewed'
        || !safePath(row.sourceReference) || !allowed.has(row.sourceReference)
        || row.sourceReference === row.path
        || !/(?:\.(?:md|txt)|(?:^|\/)(?:LICENSE|COPYING))$/i.test(row.sourceReference)
        || !MEDIA.test(row.path) || !allowed.has(row.path) || reviewed.has(row.path)) {
      add('docs/PUBLIC-SOURCE-INVENTORY.json', 'invalid-media-review');
      continue;
    }
    reviewed.add(row.path);
    try {
      const bytes = readBytes(row.path);
      if (createHash('sha256').update(bytes).digest('hex') !== row.sha256) add(row.path, 'media-review-hash-mismatch');
      if (/\.png$/i.test(row.path)) {
        for (const reason of inspectPngMetadata(bytes)) add(row.path, reason);
      }
    } catch {
      add(row.path, 'media-unreadable');
    }
  }
  for (const name of actual) if (MEDIA.test(name) && !reviewed.has(name)) add(name, 'media-review-required');
  return findings;
}
