// The owner gate. Until personal links arrive, only Paula's phone can start a live run. Her owner link carries
// OWNER_SECRET in its path once, and sets a cookie holding an HMAC of that secret, never the secret itself.
import { createHmac, timingSafeEqual } from "node:crypto";

export const OWNER_COOKIE = "co_owner";

const proof = (secret: string) => createHmac("sha256", secret).update("corner-office owner v1").digest("base64url");

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function ownerSecret() {
  const s = process.env.OWNER_SECRET;
  return s && s.length >= 32 ? s : null;
}

export function tokenIsOwner(token: string) {
  const s = ownerSecret();
  return !!s && same(token, s);
}

export function cookieValue() {
  const s = ownerSecret();
  return s ? proof(s) : null;
}

export function cookieIsOwner(value: string | undefined) {
  const s = ownerSecret();
  return !!s && !!value && same(value, proof(s));
}
