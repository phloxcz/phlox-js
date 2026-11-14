// src/net/rpc.ts
/** Codes of protocol errors, the same as ProtocolError in phloxcz/api-core. */
var RpcErrorCode = {
	ParseError: -32700,
	InvalidRequest: -32600,
	MethodNotFound: -32601,
	InvalidParams: -32602,
	InternalError: -32603,
	/** Not logged in. */
	Unauthorized: 401,
	/** Logged in, but without the role. */
	Forbidden: 403,
	/** The request did not reach the server or no answer came back. */
	Network: 0
};
var RpcError = class extends Error {
	code;
	data;
	method;
	/**
	* @param code Error code from the server, an HTTP status when the HTTP request failed, 0 for a network error
	* @param data Other members of the error object, e.g. `fields` with invalid parameters
	*/
	constructor(code, message, data = {}, method = "") {
		super(method ? `${method}: ${message}` : message);
		this.code = code;
		this.data = data;
		this.method = method;
		this.name = "RpcError";
	}
};
var RpcClient = class {
	url;
	options;
	queue = [];
	lastId = 0;
	constructor(url, options = {}) {
		this.url = url;
		this.options = options;
		options.offline?.attach((method, params) => this.request(method, params));
	}
	/** Calls a method and returns its result, or rejects with RpcError. */
	call(method, ...[params]) {
		const offline = this.options.offline;
		if (offline?.handles(method)) return offline.call(method, params);
		return this.request(method, params);
	}
	/** A call over the network, without the offline layer. */
	request(method, params) {
		return new Promise((resolve, reject) => this.enqueue({
			method,
			params,
			id: ++this.lastId,
			resolve,
			reject
		}));
	}
	/** Calls a method without waiting for its result. The server answers nothing, not even an error. */
	notify(method, ...[params]) {
		return new Promise((resolve, reject) => this.enqueue({
			method,
			params,
			id: void 0,
			resolve,
			reject
		}));
	}
	enqueue(call) {
		if (this.options.batch === false) {
			this.send([call]);
			return;
		}
		this.queue.push(call);
		if (this.queue.length === 1) queueMicrotask(() => void this.send(this.queue.splice(0)));
	}
	/** The URL with the names of the methods, each once, in the order of the calls. */
	urlFor(calls) {
		if (this.options.methodsInUrl === false) return this.url;
		const names = [...new Set(calls.map((call) => encodeURIComponent(call.method)))].join(",");
		return `${this.url}${this.url.includes("?") ? "&" : "?"}${names}`;
	}
	async send(calls) {
		const requests = calls.map((call) => ({
			jsonrpc: "2.0",
			method: call.method,
			...call.params === void 0 ? {} : { params: call.params },
			...call.id === void 0 ? {} : { id: call.id }
		}));
		const failAll = (error) => calls.forEach((call) => call.reject(error));
		let body;
		try {
			const response = await (this.options.fetch ?? fetch)(this.urlFor(calls), {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					...this.options.headers?.()
				},
				body: JSON.stringify(requests.length === 1 ? requests[0] : requests),
				...this.options.credentials ? { credentials: this.options.credentials } : {}
			});
			if (!response.ok) return failAll(new RpcError(response.status, `HTTP ${response.status} ${response.statusText}`.trim()));
			body = response.status === 204 ? null : await response.json();
		} catch (error) {
			return failAll(new RpcError(RpcErrorCode.Network, `Network error: ${error instanceof Error ? error.message : String(error)}`));
		}
		const responses = body === null ? [] : Array.isArray(body) ? body : [body];
		const byId = new Map(responses.map((response) => [response.id, response]));
		const general = responses.find((response) => response.error && (response.id === null || response.id === void 0));
		for (const call of calls) {
			if (call.id === void 0) {
				call.resolve(void 0);
				continue;
			}
			const response = byId.get(call.id) ?? general;
			if (!response) call.reject(new RpcError(RpcErrorCode.InternalError, "The server sent no response to the call.", {}, call.method));
			else if (response.error) {
				const { code, message, ...data } = response.error;
				call.reject(new RpcError(code, message, data, call.method));
			} else call.resolve(response.result);
		}
	}
};
export { RpcClient, RpcError, RpcErrorCode };
