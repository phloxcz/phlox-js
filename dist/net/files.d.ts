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
export declare function fileChunks(file: Blob, size?: number): AsyncGenerator<FileChunk>;
