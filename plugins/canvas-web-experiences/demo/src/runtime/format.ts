export const quantityFormatter = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 3 });

export function formatQuantity(value: number): string {
  return quantityFormatter.format(value);
}

export function parseFormattedQuantity(value: string): number | null {
  const normalized = value.replace(/[\s,]/g, '');
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}
