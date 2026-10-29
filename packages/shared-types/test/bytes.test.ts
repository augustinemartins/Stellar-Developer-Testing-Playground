import { describe, expect, it } from "vitest";
import { bytesToHex, hexToBytes, isHex } from "../src";

describe("bytes", () => {
  it("round-trips hex", () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255]);
    expect(bytesToHex(bytes)).toBe("00017f80ff");
    expect(hexToBytes("0x00017F80ff")).toEqual(bytes);
  });
  it("validates hex", () => {
    expect(isHex("")).toBe(true);
    expect(isHex("abc")).toBe(false);
    expect(isHex("zz")).toBe(false);
    expect(() => hexToBytes("abc")).toThrow();
  });
});
