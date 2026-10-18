import { AppError } from "./auth";
export function imageInfo(b: Uint8Array): {
  mime: string;
  width: number;
  height: number;
} {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length < 30) throw new AppError(400, "Invalid image file.");
  if (
    b[0] === 137 &&
    b[1] === 80 &&
    b[2] === 78 &&
    b[3] === 71 &&
    v.getUint32(4) === 0x0d0a1a0a &&
    v.getUint32(12) === 0x49484452
  )
    return {
      mime: "image/png",
      width: v.getUint32(16),
      height: v.getUint32(20),
    };
  if (b[0] === 255 && b[1] === 216) {
    let p = 2;
    while (p + 9 < b.length) {
      if (b[p] !== 255) break;
      const marker = b[p + 1];
      if (marker === 0xda || marker === 0xd9) break;
      const len = v.getUint16(p + 2);
      if (len < 2 || p + 2 + len > b.length) break;
      if ([0xc0, 0xc1, 0xc2].includes(marker))
        return {
          mime: "image/jpeg",
          height: v.getUint16(p + 5),
          width: v.getUint16(p + 7),
        };
      p += len + 2;
    }
  }
  if (
    String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...b.slice(8, 12)) === "WEBP"
  ) {
    const type = String.fromCharCode(...b.slice(12, 16));
    if (type === "VP8X")
      return {
        mime: "image/webp",
        width: 1 + b[24] + (b[25] << 8) + (b[26] << 16),
        height: 1 + b[27] + (b[28] << 8) + (b[29] << 16),
      };
    if (type === "VP8 ")
      return {
        mime: "image/webp",
        width: v.getUint16(26, true) & 0x3fff,
        height: v.getUint16(28, true) & 0x3fff,
      };
    if (type === "VP8L" && b[20] === 0x2f) {
      const n = v.getUint32(21, true);
      return {
        mime: "image/webp",
        width: (n & 0x3fff) + 1,
        height: ((n >>> 14) & 0x3fff) + 1,
      };
    }
  }
  throw new AppError(
    400,
    "File content must be a valid JPG, PNG or WebP image.",
  );
}
export async function signature(secret: string, data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)),
    ),
  )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export async function signedMediaURL(
  origin: string,
  id: string,
  secret: string,
) {
  const expires = Date.now() + 30 * 60 * 1000;
  const sig = await signature(secret, id + ":" + expires);
  return `${origin}/api/media/${id}?expires=${expires}&signature=${sig}`;
}
export async function validSignature(
  secret: string,
  id: string,
  expires: string,
  sig: string,
) {
  const n = Number(expires);
  if (
    !Number.isSafeInteger(n) ||
    n < Date.now() ||
    n > Date.now() + 31 * 60 * 1000
  )
    return false;
  const expected = await signature(secret, id + ":" + expires);
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++)
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
