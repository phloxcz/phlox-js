import { classes, currentTheme } from "./theme.js";
import { jsx } from "../jsx-runtime.js";
// src/ui/button.tsx
function Button(props) {
	const { primary, danger, small, class: own, children, ...attributes } = props;
	const theme = currentTheme();
	const variant = danger ? "buttonDanger" : primary ? "buttonPrimary" : "buttonSecondary";
	return /* @__PURE__ */ jsx("button", {
		type: "button",
		...attributes,
		class: classes(theme.class(variant), small && theme.class("buttonSmall"), own),
		children
	});
}
export { Button };
