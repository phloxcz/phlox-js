// src/net/files.ts
/**
* Parts of a file, read one by one, so a large file is never in memory whole:
* for await (const chunk of fileChunks(file)) await api.call('file.chunk', { id, ...chunk }).
*/
async function* fileChunks(file, size = 1048576) {
	const total = Math.max(1, Math.ceil(file.size / size));
	for (let index = 0; index < total; index++) {
		const offset = index * size;
		const bytes = new Uint8Array(await file.slice(offset, offset + size).arrayBuffer());
		yield {
			index,
			total,
			offset,
			data: toBase64(bytes)
		};
	}
}
function toBase64(bytes) {
	let binary = "";
	for (let start = 0; start < bytes.length; start += 32768) binary += String.fromCharCode(...bytes.subarray(start, start + 32768));
	return btoa(binary);
}
export { fileChunks };
