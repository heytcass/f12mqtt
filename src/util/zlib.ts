import { inflate } from 'node:zlib';
import { promisify } from 'node:util';

const inflateAsync = promisify(inflate);

/**
 * Decompress a base64-encoded zlib-compressed string.
 * Used for SignalR .z topics (CarData.z, Position.z).
 */
export async function decompressMessage(base64Data: string): Promise<string> {
  const buffer = Buffer.from(base64Data, 'base64');
  const decompressed = await inflateAsync(buffer);
  return decompressed.toString('utf-8');
}
