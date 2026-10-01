import type { PricePoint } from "@/lib/types";

export type PeriodKey = "1Y" | "3Y" | "5Y";

export const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`);

export function pointsForPeriod(points: PricePoint[], period: PeriodKey) {
  if (points.length < 2) return points;
  const latest = new Date(toTime(points[points.length - 1].date));
  const years = period === "1Y" ? 1 : period === "3Y" ? 3 : 5;
  const cutoff = new Date(latest);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
  const filtered = points.filter((point) => toTime(point.date) >= cutoff.getTime());
  return filtered.length >= 2 ? filtered : points;
}

export function periodStats(points: PricePoint[]) {
  if (points.length < 2) return null;
  const first = points[0], last = points[points.length - 1];
  const movement = (last.adjusted_close / first.adjusted_close - 1) * 100;
  let peak = first.adjusted_close, drawdown = 0;
  for (const point of points) {
    peak = Math.max(peak, point.adjusted_close);
    drawdown = Math.min(drawdown, (point.adjusted_close / peak - 1) * 100);
  }
  return { movement, drawdown, start: first.date, end: last.date, startPrice: first.adjusted_close, endPrice: last.adjusted_close };
}

export function rupees(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: value < 100 ? 2 : 0 }).format(value);
}

export function signedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function shortDate(time: number) {
  return new Date(time).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export function niceTicks(min: number, max: number, target = 4) {
  const raw = Math.max((max - min) / target, 1e-6);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  let step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= raw) ?? raw;
  if (Math.floor(max / step) - Math.ceil(min / step) + 1 < target - 1) step /= 2;
  const ticks: number[] = [];
  for (let value = Math.ceil(min / step) * step; value <= max + 1e-9; value += step) ticks.push(Number(value.toFixed(6)));
  return ticks;
}

/** Keep roughly `max` evenly spaced items, always including the last. */
export function downsample<T>(items: T[], max: number) {
  if (items.length <= max) return items;
  const every = Math.ceil(items.length / max);
  return items.filter((_, index) => index % every === 0 || index === items.length - 1);
}
