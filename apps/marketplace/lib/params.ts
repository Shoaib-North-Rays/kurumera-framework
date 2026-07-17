export type SP = Record<string, string | string[] | undefined>;

export function spGet(sp: SP, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

/** Build an href from the current params with some keys updated/removed (empty = remove). */
export function buildHref(base: string, current: SP, updates: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) p.set(k, val);
  }
  for (const [k, v] of Object.entries(updates)) {
    if (!v) p.delete(k);
    else p.set(k, v);
  }
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}
