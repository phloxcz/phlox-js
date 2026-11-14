/**
 * Animations of the framework: on, off, or as the system says (the setting to reduce motion).
 * JS animations ask allowsMotion(); CSS transitions multiply their duration by --phlox-motion,
 * which is 0 or 1 by the attribute data-phlox-motion on <html> and the media query in base.css.
 */
import type { Accessor } from '../reactive/reactive';
export type Motion = 'on' | 'off' | 'system';
/** The current setting, reactive. */
export declare const motion: Accessor<Motion>;
/** Switches animations of the framework, e.g. from a setting of the user. 'system' is the default. */
export declare function setMotion(value: Motion): void;
/** Whether animations may run now: by the setting, or by the system for 'system'. */
export declare function allowsMotion(): boolean;
