import { state } from "../reactive/reactive.js";
// src/ui/motion.ts
/**
* Animations of the framework: on, off, or as the system says (the setting to reduce motion).
* JS animations ask allowsMotion(); CSS transitions multiply their duration by --phlox-motion,
* which is 0 or 1 by the attribute data-phlox-motion on <html> and the media query in base.css.
*/
var current = state("system");
/** The current setting, reactive. */
var motion = current;
/** Switches animations of the framework, e.g. from a setting of the user. 'system' is the default. */
function setMotion(value) {
	current.set(value);
	const root = document.documentElement;
	if (value === "system") delete root.dataset.phloxMotion;
	else root.dataset.phloxMotion = value;
}
/** Whether animations may run now: by the setting, or by the system for 'system'. */
function allowsMotion() {
	const value = current();
	if (value !== "system") return value === "on";
	return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
export { allowsMotion, motion, setMotion };
