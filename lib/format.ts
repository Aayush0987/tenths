/** m:ss.mmm, the way a timing screen shows a lap. */
export function formatLap(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const rest = seconds - m * 60;
  return m > 0 ? `${m}:${rest.toFixed(3).padStart(6, "0")}` : rest.toFixed(3);
}

/** "1:18.518" -> 78.518. Null for a missing or unparseable time. */
export function parseLapTime(value: string | null): number | null {
  if (!value) return null;
  const m = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(value.trim());
  if (!m) {
    const plain = Number(value);
    return Number.isFinite(plain) ? plain : null;
  }
  return Number(m[1]) * 60 + Number(m[2]);
}
