/**
 * crypto.test.js
 * Tests the AES-GCM encrypt/decrypt primitives from crypto-core.js.
 * Uses Node 18+ built-in crypto.subtle (same WebCrypto API as the browser).
 */
import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';

// ── Replicate the crypto-core primitives under test ─────────────────────────
const subtle = webcrypto.subtle;

function toBase64(buf) {
  return Buffer.from(buf).toString('base64');
}
function fromBase64(str) {
  return Uint8Array.from(Buffer.from(str, 'base64'));
}

async function deriveKey(passphrase, saltBytes, iters = 600000) {
  const enc = new TextEncoder();
  const km = await subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: iters, hash: 'SHA-256' },
    km,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encrypt(plaintext, key) {
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const cipherBuf = await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  return { ciphertext: toBase64(cipherBuf), iv: toBase64(iv.buffer), v: 1 };
}

async function decrypt(payload, key) {
  const plainBuf = await subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(payload.iv) },
    key,
    fromBase64(payload.ciphertext)
  );
  return new TextDecoder().decode(plainBuf);
}

function isEncryptedPayload(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val) &&
    val.v === 1 && typeof val.ciphertext === 'string' && typeof val.iv === 'string';
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('AES-GCM encrypt / decrypt round-trip', () => {
  it('decrypts back to the original plaintext', async () => {
    const salt = webcrypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey('123456', salt);
    const payload = await encrypt('{"amount":1500}', key);
    const result = await decrypt(payload, key);
    expect(result).toBe('{"amount":1500}');
  });

  it('produces a different ciphertext on each call (random IV)', async () => {
    const salt = webcrypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey('123456', salt);
    const p1 = await encrypt('same plaintext', key);
    const p2 = await encrypt('same plaintext', key);
    expect(p1.ciphertext).not.toBe(p2.ciphertext);
    expect(p1.iv).not.toBe(p2.iv);
  });

  it('preserves large state JSON intact', async () => {
    const state = JSON.stringify({ months: { 'Jan 2025': { weeks: Array(4).fill({ items: [] }) } }, loans: [], savings: [] });
    const salt = webcrypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey('987654', salt);
    const payload = await encrypt(state, key);
    const result = await decrypt(payload, key);
    expect(result).toBe(state);
  });
});

describe('Wrong key rejection', () => {
  it('throws when decrypting with a different key', async () => {
    const salt = webcrypto.getRandomValues(new Uint8Array(16));
    const rightKey = await deriveKey('correct-pin', salt);
    const wrongKey = await deriveKey('wrong-pin', salt);
    const payload = await encrypt('sensitive data', rightKey);
    await expect(decrypt(payload, wrongKey)).rejects.toThrow();
  });

  it('throws when decrypting with a key derived from a different salt', async () => {
    const salt1 = webcrypto.getRandomValues(new Uint8Array(16));
    const salt2 = webcrypto.getRandomValues(new Uint8Array(16));
    const key1 = await deriveKey('same-pin', salt1);
    const key2 = await deriveKey('same-pin', salt2);
    const payload = await encrypt('sensitive data', key1);
    await expect(decrypt(payload, key2)).rejects.toThrow();
  });

  it('throws on tampered ciphertext', async () => {
    const salt = webcrypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey('123456', salt);
    const payload = await encrypt('data', key);
    const tampered = { ...payload, ciphertext: payload.ciphertext.slice(0, -4) + 'AAAA' };
    await expect(decrypt(tampered, key)).rejects.toThrow();
  });
});

describe('isEncryptedPayload detector', () => {
  it('returns true for a valid encrypted envelope', async () => {
    const salt = webcrypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey('123456', salt);
    const payload = await encrypt('test', key);
    expect(isEncryptedPayload(payload)).toBe(true);
  });

  it('returns false for a plaintext state object', () => {
    expect(isEncryptedPayload({ months: {}, loans: [], savings: [] })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isEncryptedPayload(null)).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isEncryptedPayload('{"some":"json"}')).toBe(false);
  });

  it('returns false if ciphertext field is missing', () => {
    expect(isEncryptedPayload({ iv: 'abc', v: 1 })).toBe(false);
  });
});

describe('PBKDF2 key derivation', () => {
  it('same passphrase + salt always produces equivalent encryption', async () => {
    const salt = webcrypto.getRandomValues(new Uint8Array(16));
    const key1 = await deriveKey('pincode', salt);
    const key2 = await deriveKey('pincode', salt);
    // Encrypt with key1, decrypt with key2 — if derivation is deterministic they must match
    const payload = await encrypt('round-trip test', key1);
    const result = await decrypt(payload, key2);
    expect(result).toBe('round-trip test');
  });

  it('different passphrases produce keys that cannot decrypt each other', async () => {
    const salt = webcrypto.getRandomValues(new Uint8Array(16));
    const key1 = await deriveKey('1111', salt);
    const key2 = await deriveKey('2222', salt);
    const payload = await encrypt('secret', key1);
    await expect(decrypt(payload, key2)).rejects.toThrow();
  });
});
