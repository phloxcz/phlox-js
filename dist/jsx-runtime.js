import { Fragment, h } from "./ui/dom.js";
// src/jsx-runtime.ts
/**
* Automatic JSX runtime. The compiler imports this module by itself (see `jsxImportSource` in tsconfig.json),
* so files with TSX do not import `h`.
*/
/** The compiler passes children inside props and the `key` attribute separately, `h` wants both the usual way. */
function jsx(tag, props, key) {
	const { children, ...rest } = props;
	if (key !== void 0) rest.key = key;
	return children === void 0 ? h(tag, rest) : h(tag, rest, children);
}
export { Fragment, jsx, jsx as jsxDEV, jsx as jsxs };
