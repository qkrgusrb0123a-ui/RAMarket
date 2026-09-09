import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const hashPrefix = 'scrypt';

export function createPasswordHash(password: string) {
  const salt = randomBytes(16);
  const digest = scryptSync(password, salt, 64);
  return `${hashPrefix}$${salt.toString('hex')}$${digest.toString('hex')}`;
}

export function verifyPasswordHash(password: string, storedHash: string) {
  const [prefix, saltHex, digestHex] = storedHash.split('$');
  if (prefix !== hashPrefix || !saltHex || !digestHex) return false;
  try {
    const expected = Buffer.from(digestHex, 'hex');
    const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
