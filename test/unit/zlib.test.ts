import { describe, it, expect } from 'vitest';
import { deflate } from 'node:zlib';
import { promisify } from 'node:util';
import { decompressMessage } from '../../src/util/zlib.js';

const deflateAsync = promisify(deflate);

describe('decompressMessage', () => {
  it('decompresses a base64 zlib string', async () => {
    const original = JSON.stringify({ Position: [{ Timestamp: '2025-01-01' }] });
    const compressed = await deflateAsync(Buffer.from(original));
    const base64 = compressed.toString('base64');

    const result = await decompressMessage(base64);
    expect(result).toBe(original);
  });

  it('handles unicode content', async () => {
    const original = '{"name":"São Paulo"}';
    const compressed = await deflateAsync(Buffer.from(original));
    const base64 = compressed.toString('base64');

    const result = await decompressMessage(base64);
    expect(result).toBe(original);
  });

  it('throws on invalid base64', async () => {
    await expect(decompressMessage('not-valid-base64!!!')).rejects.toThrow();
  });
});
