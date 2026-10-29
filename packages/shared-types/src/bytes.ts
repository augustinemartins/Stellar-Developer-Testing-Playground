/** Browser-safe byte helpers (no Node `Buffer` dependency). */

export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) {
    throw new Error("expected an even-length hex string");
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function isHex(value: string): boolean {
  const clean = value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
  return clean.length % 2 === 0 && /^[0-9a-fA-F]*$/.test(clean);
}
