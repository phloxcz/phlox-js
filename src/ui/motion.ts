/**
 * Animations of the framework: on, off, or as the system says (the setting to reduce motion).
 * JS animations ask allowsMotion(); CSS transitions multiply their duration by --phlox-motion,
 * which is 0 or 1 by the attribute data-phlox-motion on <html> and the media query in base.css.
 */

import { state } from '../reactive/reactive';
import type { Accessor } from '../reactive/reactive';

export type Motion = 'on' | 'off' | 'system';

const current = state<Motion>('system');

/** The current setting, reactive. */
export const motion: Accessor<Motion> = current;

/** Switches animations of the framework, e.g. from a setting of the user. 'system' is the default. */
export function setMotion(value: Motion): void {
  current.set(value);
  const root = document.documentElement;
  if (value === 'system') delete root.dataset.phloxMotion;
  else root.dataset.phloxMotion = value;
}

/** Whether animations may run now: by the setting, or by the system for 'system'. */
export function allowsMotion(): boolean {
  const value = current();
  if (value !== 'system') return value === 'on';
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
