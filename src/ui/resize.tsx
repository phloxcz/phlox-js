/**
 * A handle at the edge of an element that changes its width: a column of a layout, a side panel.
 * The width is a state, so with Component.preference() it is remembered.
 */

import { untrack } from '../reactive/reactive';
import type { State } from '../reactive/reactive';
import type { Child } from './dom';

export interface ResizeHandleProps {
  /** The width in px. The element uses it, e.g. style={() => ({ width: `${width()}px` })}. */
  size: State<number>;
  min?: number;
  max?: number;
  /** The edge the handle is at: `end` (right, default) or `start` (left, the element grows to the left). */
  edge?: 'end' | 'start';
  /** A double click returns to this width. */
  initial?: number;
  /** The name for screen readers, e.g. 'Šířka seznamu úkolů'. */
  label?: string;
}

/** How far one press of an arrow key moves the edge, with Shift four times as far. */
const STEP = 16;

/**
 * Put it as the last child of the element whose width it changes; base.css positions that element.
 * Dragging by the mouse or a finger, Escape during dragging returns the width. With the focus on it
 * arrows change the width, Home and End set the smallest and the largest.
 */
export function ResizeHandle(props: ResizeHandleProps): Child {
  const min = props.min ?? 0;
  const max = props.max ?? Number.POSITIVE_INFINITY;
  const sign = props.edge === 'start' ? -1 : 1;
  const clamp = (width: number) => Math.round(Math.min(max, Math.max(min, width)));
  let handle: HTMLElement;

  const drag = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    const start = event.clientX;
    const from = untrack(props.size);
    const pointer = event.pointerId;
    const root = document.documentElement;
    handle.classList.add('phlox-resizing');
    root.classList.add('phlox-col-resizing');

    const move = (next: PointerEvent): void => {
      if (next.pointerId === pointer) props.size.set(clamp(from + sign * (next.clientX - start)));
    };
    const finish = (cancelled: boolean): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', escape, true);
      handle.classList.remove('phlox-resizing');
      root.classList.remove('phlox-col-resizing');
      if (cancelled) props.size.set(from);
    };
    const up = (): void => finish(false);
    const cancel = (): void => finish(true);
    const escape = (key: KeyboardEvent): void => {
      if (key.key !== 'Escape') return;
      key.preventDefault();
      key.stopPropagation();
      finish(true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', escape, true);
  };

  const keydown = (event: KeyboardEvent): void => {
    const step = event.shiftKey ? STEP * 4 : STEP;
    const width = untrack(props.size);
    const next = event.key === 'ArrowRight' ? width + sign * step
      : event.key === 'ArrowLeft' ? width - sign * step
        : event.key === 'Home' ? min
          : event.key === 'End' && Number.isFinite(max) ? max
            : null;
    if (next === null) return;
    event.preventDefault();
    props.size.set(clamp(next));
  };

  return (
    <div
      class={`phlox-resize-handle phlox-resize-${props.edge ?? 'end'}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={props.label ?? null}
      aria-valuenow={props.size}
      aria-valuemin={min}
      aria-valuemax={Number.isFinite(max) ? max : null}
      tabIndex={0}
      ref={element => { handle = element; }}
      onPointerdown={drag}
      onKeydown={keydown}
      onDblclick={() => {
        if (props.initial !== undefined) props.size.set(clamp(props.initial));
      }}
    />
  );
}
