import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const VERSION = 'v1';

function getEncryptionKey() {
  const rawKey = process.env.ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error('ENCRYPTION_KEY is required to encrypt secrets');
  }

  if (!/^[0-9a-f]{64}$/i.test(rawKey)) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string');
  }

  const key = Buffer.from(rawKey, 'hex');
  if (key.length !== KEY_BYTES) {
    throw new Error('ENCRYPTION_KEY must decode to 32 bytes');
  }

  return key;
}

export function encryptSecret(plainText: string) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);

  return [
    VERSION,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

export function decryptSecret(encryptedSecret: string) {
  const [version, iv, authTag, encrypted] = encryptedSecret.split(':');

  if (version !== VERSION || !iv || !authTag || !encrypted) {
    throw new Error('Unsupported encrypted secret format');
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(authTag, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
