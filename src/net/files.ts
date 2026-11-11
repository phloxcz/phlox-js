/**
 * Sending files over JSON-RPC, which carries only text: the file goes in parts encoded in base64.
 * A form upload gives File objects, how they are sent is up to the application.
 */

export interface FileChunk {
  /** Order of the part from 0, and the number of all parts. An empty file has one empty part. */
  index: number;
  total: number;
  /** Where the part starts in the file, in bytes. */
  offset: number;
  /** The bytes of the part in base64. */
  data: string;
}

/**
 * Parts of a file, read one by one, so a large file is never in memory whole:
 * for await (const chunk of fileChunks(file)) await api.call('file.chunk', { id, ...chunk }).
 */
export async function* fileChunks(file: Blob, size = 1024 * 1024): AsyncGenerator<FileChunk> {
  const total = Math.max(1, Math.ceil(file.size / size));
  for (let index = 0; index < total; index++) {
    const offset = index * size;
    const bytes = new Uint8Array(await file.slice(offset, offset + size).arrayBuffer());
    yield { index, total, offset, data: toBase64(bytes) };
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  // In pieces: String.fromCharCode() with too many arguments overflows the stack
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return btoa(binary);
}
