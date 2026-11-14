// src/net/openrpc.ts
var typeName = (name) => name.replace(/\W/g, "_").replace(/^(\d)/, "_$1");
var propertyName = (name) => /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
function comment(lines, indent) {
	const text = lines.filter((line) => Boolean(line)).join("\n\n").replaceAll("*/", "*\\/");
	if (!text) return "";
	if (!text.includes("\n")) return `${indent}/** ${text} */\n`;
	return `${indent}/**\n${text.split("\n").map((line) => `${indent} *${line ? ` ${line}` : ""}`).join("\n")}\n${indent} */\n`;
}
/** A union or intersection needs brackets before `[]`, a plain object does not. */
var parenthesize = (type) => /^\{\n[\s\S]*\}$/.test(type) || !/[|&]/.test(type) ? type : `(${type})`;
function union(types) {
	const unique = [...new Set(types)];
	return unique.includes("unknown") ? "unknown" : unique.join(" | ");
}
/** One schema as a TypeScript type. */
function toType(schema, indent) {
	if (!schema || typeof schema !== "object") return "unknown";
	if (schema.$ref) return typeName(schema.$ref.split("/").pop());
	if (schema.allOf) return schema.allOf.map((part) => parenthesize(toType(part, indent))).join(" & ");
	if (schema.anyOf || schema.oneOf) return union((schema.anyOf ?? schema.oneOf).map((part) => toType(part, indent)));
	if (schema.const !== void 0) return JSON.stringify(schema.const);
	if (schema.enum) return union(schema.enum.map((value) => JSON.stringify(value)));
	if (Array.isArray(schema.type)) return union(schema.type.map((type) => toType({
		...schema,
		type
	}, indent)));
	switch (schema.type) {
		case "string": return "string";
		case "integer":
		case "number": return "number";
		case "boolean": return "boolean";
		case "null": return "null";
		case "array": return `${parenthesize(toType(schema.items, indent))}[]`;
		case "object": return objectType(schema, indent);
		default: return "unknown";
	}
}
function objectType(schema, indent) {
	const extra = schema.additionalProperties;
	const record = typeof extra === "object" ? `Record<string, ${toType(extra, indent)}>` : "Record<string, unknown>";
	const properties = Object.entries(schema.properties ?? {});
	if (properties.length === 0) return extra === false ? "Record<string, never>" : record;
	const inner = `${indent}  `;
	const required = new Set(schema.required ?? []);
	const object = `{\n${properties.map(([name, property]) => {
		const note = property.format && property.format !== "binary" ? `Format: ${property.format}.` : void 0;
		const optional = required.has(name) ? "" : "?";
		return `${comment([property.description, note], inner)}${inner}${propertyName(name)}${optional}: ${toType(property, inner)};`;
	}).join("\n")}\n${indent}}`;
	return typeof extra === "object" ? `${object} & ${record}` : object;
}
function authorization(method) {
	if (!method["x-authorize"]) return void 0;
	const roles = method["x-roles"] ?? [];
	if (roles.length === 0) return "Requires login.";
	return `Requires login and roles: ${roles.map((group) => group.join(" or ")).join(", and ")}.`;
}
/** Returns the content of a TypeScript file with the types of the document and a typed client class. */
function generateRpcTypes(document, options = {}) {
	const className = options.className ?? "RpcApi";
	const source = [document.info?.title, document.info?.version].filter(Boolean).join(" ");
	const out = [
		`// Generated from the OpenRPC document${source ? ` of ${source}` : ""}. Do not edit, generate it again.`,
		`import { RpcClient } from ${JSON.stringify(options.importFrom ?? "@phloxcz/phlox-js/net")};`,
		""
	];
	for (const [name, schema] of Object.entries(document.components?.schemas ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
		const type = toType(schema, "");
		out.push(comment([schema.description], "") + (type.startsWith("{\n") ? `export interface ${typeName(name)} ${type}` : `export type ${typeName(name)} = ${type};`), "");
	}
	out.push("export interface RpcMethods {");
	for (const method of [...document.methods].sort((a, b) => a.name.localeCompare(b.name))) {
		const params = method.params ?? [];
		const paramsType = params.length === 0 ? "Record<string, never>" : `{\n${params.map((param) => `${comment([param.description], "      ")}      ${propertyName(param.name)}${param.required ? "" : "?"}: ${toType(param.schema, "      ")};`).join("\n")}\n    }`;
		out.push(comment([
			method.summary,
			method.description,
			authorization(method),
			method.deprecated && "@deprecated"
		], "  ") + `  ${JSON.stringify(method.name)}: {\n    params: ${paramsType};\n${comment([method.result?.description], "    ")}    result: ${toType(method.result?.schema, "    ")};\n  };`);
	}
	out.push("}", "", `/** Typed client. Register an instance in the container: \`new ${className}('/rpc')\`. */`, `export class ${className} extends RpcClient<RpcMethods> {}`, "");
	return out.join("\n");
}
export { generateRpcTypes };
