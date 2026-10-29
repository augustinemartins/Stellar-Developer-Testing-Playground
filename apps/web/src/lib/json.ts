/** True if two JSON texts parse to the same value (formatting ignored). False if either is invalid. */
export function sameJson(a: string, b: string): boolean {
  try {
    return JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b));
  } catch {
    return false;
  }
}
