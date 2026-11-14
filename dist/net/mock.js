// src/net/mock.ts
/** An error the mock sends back, like ApiException or invalid parameters (code -32602 with `fields`) in phlox-api-core. */
var RpcMockError = class extends Error {
	code;
	fields;
	constructor(code, message, fields) {
		super(message);
		this.code = code;
		this.fields = fields;
		this.name = "RpcMockError";
	}
};
function createRpcMock(handlers, options = {}) {
	const calls = [];
	const table = handlers;
	const answer = async (request, context) => {
		const id = request.id ?? null;
		const fail = (code, message, fields) => ({
			jsonrpc: "2.0",
			id,
			error: {
				code,
				message,
				...fields ? { fields } : {}
			}
		});
		if (request.jsonrpc !== "2.0" || typeof request.method !== "string") return fail(-32600, "Invalid Request");
		const handler = table[request.method];
		const notification = request.id === void 0;
		if (!handler) return notification ? null : fail(-32601, "Method not found");
		calls.push({
			method: request.method,
			params: request.params
		});
		try {
			const result = await handler(request.params ?? {}, context);
			return notification ? null : {
				jsonrpc: "2.0",
				id,
				result: result ?? null
			};
		} catch (error) {
			if (!(error instanceof RpcMockError)) console.error(error);
			if (notification) return null;
			return error instanceof RpcMockError ? fail(error.code, error.message, error.fields) : fail(-32603, "Internal error");
		}
	};
	const handle = async (body, headers = {}) => {
		let parsed;
		try {
			parsed = JSON.parse(body);
		} catch {
			return JSON.stringify({
				jsonrpc: "2.0",
				id: null,
				error: {
					code: -32700,
					message: "Parse error"
				}
			});
		}
		if (options.latency) await new Promise((resolve) => setTimeout(resolve, options.latency));
		const context = options.context ? options.context(headers) : void 0;
		const answers = (await Promise.all((Array.isArray(parsed) ? parsed : [parsed]).map((request) => answer(request, context)))).filter((item) => item !== null);
		if (!answers.length) return null;
		return JSON.stringify(Array.isArray(parsed) ? answers : answers[0]);
	};
	const fetch = (async (_input, init = {}) => {
		const headers = Object.fromEntries(Object.entries(init.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]));
		const text = await handle(String(init.body ?? ""), headers);
		return text === null ? new Response(null, { status: 204 }) : new Response(text, {
			status: 200,
			headers: { "Content-Type": "application/json" }
		});
	});
	return {
		fetch,
		handle,
		calls
	};
}
export { RpcMockError, createRpcMock };
