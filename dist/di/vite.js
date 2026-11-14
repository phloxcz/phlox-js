import { parseAst } from "vite";
// src/di/vite.ts
/**
* Vite plugin for autowiring. TypeScript types do not exist at runtime, so the plugin reads
* the constructor of every class and writes down what it needs:
*
*   constructor(private api: UserApi) {}   →   static $inject = () => [UserApi];
*
* It reads syntax only. Every type is taken through a namespace import of its module, so a type
* that is not a class is simply undefined at runtime and the container reports it when it creates the class.
*/
function walk(node, visit) {
	if (!node || typeof node !== "object") return;
	if (Array.isArray(node)) {
		for (const item of node) walk(item, visit);
		return;
	}
	if (typeof node.type === "string") visit(node);
	for (const value of Object.values(node)) walk(value, visit);
}
function phlox(options = {}) {
	return {
		name: "phlox-di",
		enforce: "pre",
		transform(code, rawId) {
			const id = rawId.split("?")[0];
			if (!/\.tsx?$/.test(id) || id.includes("/node_modules/") || options.exclude?.test(id)) return;
			if (!code.includes("constructor")) return;
			const ast = parseAst(code, { lang: id.endsWith("x") ? "tsx" : "ts" });
			/** Local name of an imported type → where it comes from. */
			const imports = /* @__PURE__ */ new Map();
			const localClasses = /* @__PURE__ */ new Set();
			let lastImportEnd = 0;
			for (const node of ast.body) {
				if (node.type !== "ImportDeclaration") continue;
				lastImportEnd = node.end;
				for (const specifier of node.specifiers) {
					if (specifier.type === "ImportNamespaceSpecifier") continue;
					const name = specifier.type === "ImportDefaultSpecifier" ? "default" : specifier.imported.name ?? specifier.imported.value;
					imports.set(specifier.local.name, {
						source: node.source.value,
						name
					});
				}
			}
			walk(ast, (node) => {
				if (node.type === "ClassDeclaration" && node.id) localClasses.add(node.id.name);
			});
			/** Module → name of its namespace import added by the plugin. */
			const namespaces = /* @__PURE__ */ new Map();
			/** A class reference, or a quoted text of the parameter for the error message of the container. */
			const dependency = (param) => {
				let target = param.type === "TSParameterProperty" ? param.parameter : param;
				if (target.type === "AssignmentPattern") target = target.left;
				const type = target.typeAnnotation?.typeAnnotation;
				const label = JSON.stringify(code.slice(target.start, target.end));
				if (type?.type !== "TSTypeReference" || type.typeArguments || type.typeName.type !== "Identifier") return label;
				const name = type.typeName.name;
				if (localClasses.has(name)) return name;
				const imported = imports.get(name);
				if (!imported) return label;
				if (!namespaces.has(imported.source)) namespaces.set(imported.source, `__phloxDi${namespaces.size}`);
				return `${namespaces.get(imported.source)}[${JSON.stringify(imported.name)}] ?? ${label}`;
			};
			const inserts = [];
			walk(ast, (node) => {
				if (node.type !== "ClassDeclaration" && node.type !== "ClassExpression") return;
				const constructor = node.body.body.find((member) => member.type === "MethodDefinition" && member.kind === "constructor" && member.value.body);
				if (!constructor || constructor.value.params.length === 0) return;
				const dependencies = constructor.value.params.map(dependency);
				if (dependencies.every((text) => text.startsWith("\""))) return;
				inserts.push([node.body.start + 1, ` static $inject = () => [${dependencies.join(", ")}];`]);
			});
			if (inserts.length === 0) return;
			const header = [...namespaces].map(([source, name]) => `import * as ${name} from ${JSON.stringify(source)};`).join(" ");
			inserts.push([lastImportEnd, header && `\n${header}`]);
			let result = code;
			for (const [position, text] of inserts.sort((a, b) => b[0] - a[0])) result = result.slice(0, position) + text + result.slice(position);
			return {
				code: result,
				map: null
			};
		}
	};
}
export { phlox };
