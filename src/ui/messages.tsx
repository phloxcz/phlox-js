/**
 * Messages for the user, taken over from @phloxcz/capify: alert, confirm and prompt as a dialog or as a popover
 * at an element, a dialog while something loads, and toasts for flash messages. Classes come from the theme,
 * so they follow Bootstrap, the dark mode and setMotion() like the rest of the framework.
 */

import { For, If } from './flow';
import { Scope, effect, state, untrack } from '../reactive/reactive';
import { h, insert } from './dom';
import type { Child } from './dom';
import { Component } from './component';
import { THEME, classes, currentTheme } from './theme';
import type { Theme } from './theme';
import { allowsMotion } from './motion';
import type { Flash, FlashMessages } from '../application/application';

export type Placement = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type MessageKind = 'alert' | 'confirm' | 'prompt';

export interface MessageOptions {
  title?: Child;
  okText?: string;
  cancelText?: string;
  /** The OK button warns: deleting, overwriting... */
  danger?: boolean;
  /** Shows a small popover at this element instead of a dialog, e.g. at the button that asked. */
  anchor?: HTMLElement | null;
  /** Where the popover is, it turns over when there is no room. */
  placement?: Placement;
}

export interface PromptOptions extends MessageOptions {
  value?: string;
  placeholder?: string;
}

/** A dialog shown while something runs, see loading(). */
export interface LoadingHandle {
  update(message: Child): void;
  close(): void;
}

export const messageTexts = { ok: 'OK', cancel: 'Cancel', close: 'Close', loading: 'Loading…' };

interface BoxProps {
  kind: MessageKind;
  message: Child;
  options: PromptOptions;
}

/** The content of alert, confirm and prompt in a dialog of the framework. */
export class MessageBox extends Component<BoxProps, boolean | string> {
  readonly value = state(this.props.options.value ?? '');

  override title() {
    return this.props.options.title ?? '';
  }

  override actions() {
    const { kind, options } = this.props;
    const theme = currentTheme();
    return [
      kind === 'alert' ? null : (
        <button type="button" class={theme.class('message.cancel')} onClick={() => this.close()}>
          {options.cancelText ?? messageTexts.cancel}
        </button>
      ),
      <button
        type="button"
        class={theme.class(options.danger ? 'message.okDanger' : 'message.ok')}
        autofocus={kind !== 'prompt'}
        onClick={() => this.close(kind === 'prompt' ? untrack(this.value) : true)}
      >
        {options.okText ?? messageTexts.ok}
      </button>,
    ];
  }

  render() {
    const theme = currentTheme();
    return (
      <div class={theme.class('message.body')}>
        <div class={theme.class('message.text')}>{this.props.message}</div>
        {this.props.kind === 'prompt' ? (
          <input
            type="text"
            class={theme.class('message.input')}
            value={this.value}
            placeholder={this.props.options.placeholder ?? null}
            autofocus
            onInput={event => this.value.set(event.currentTarget.value)}
            onKeydown={event => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              this.close(untrack(this.value));
            }}
          />
        ) : null}
      </div>
    );
  }
}

/** Shows alert, confirm or prompt as a dialog opened by the component, or as a popover with `anchor`. */
export async function showMessage(opener: Component<any, any>, kind: MessageKind, message: Child, options: PromptOptions = {}): Promise<boolean | string | null> {
  const result = options.anchor
    ? await showPopover(opener.scope, kind, message, options)
    : await opener.openDialog(MessageBox, { kind, message, options });
  // Escape, a click outside or the close button is Cancel
  if (kind === 'alert') return true;
  if (kind === 'confirm') return result === true;
  return typeof result === 'string' ? result : null;
}

const GAP = 8;

/** Where a popover goes: under or above the element, aligned to its left or right, turned over when it does not fit. */
function placePopover(anchor: HTMLElement, popover: HTMLElement, placement: Placement) {
  const box = anchor.getBoundingClientRect();
  const width = popover.offsetWidth;
  const height = popover.offsetHeight;
  let [y, x] = placement.split('-') as ['top' | 'bottom', 'left' | 'right'];
  if (y === 'bottom' && box.bottom + GAP + height > window.innerHeight && box.top - GAP - height > 0) y = 'top';
  else if (y === 'top' && box.top - GAP - height < 0 && box.bottom + GAP + height < window.innerHeight) y = 'bottom';
  if (x === 'left' && box.left + width > window.innerWidth && box.right - width > 0) x = 'right';
  else if (x === 'right' && box.right - width < 0 && box.left + width < window.innerWidth) x = 'left';
  const top = Math.max(8, Math.min(y === 'bottom' ? box.bottom + GAP : box.top - GAP - height, window.innerHeight - height - 8));
  const left = Math.max(8, Math.min(x === 'left' ? box.left : box.right - width, window.innerWidth - width - 8));
  // The arrow points at the middle of the element, as far as the popover reaches
  const arrow = Math.max(12, Math.min(box.left + box.width / 2 - left, width - 12));
  return { top, left, y, arrow };
}

let lastPopover = 0;

/** A small dialog at an element. Escape, a click outside or Cancel closes it; the focus goes back to the element. */
function showPopover(owner: Scope, kind: MessageKind, message: Child, options: PromptOptions): Promise<boolean | string | null> {
  const anchor = options.anchor!;
  const scope = new Scope(owner);
  const host = document.createElement('div');
  const id = `phlox-popover-${++lastPopover}`;
  const value = state(options.value ?? '');

  return new Promise(resolve => {
    let popover: HTMLElement;
    const close = (result: boolean | string | null) => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('pointerdown', outside, true);
      scope.dispose();
      host.remove();
      anchor.focus();
      resolve(result);
    };
    const cancel = () => close(kind === 'confirm' ? false : null);
    const ok = () => close(kind === 'prompt' ? untrack(value) : true);
    const place = () => {
      // Fixed before measuring: as an ordinary block it would be as wide as it may be, not as its content
      Object.assign(popover.style, { position: 'fixed', margin: '0' });
      const { top, left, y, arrow } = placePopover(anchor, popover, options.placement ?? 'bottom-left');
      Object.assign(popover.style, { top: `${top}px`, left: `${left}px` });
      popover.dataset.placement = y;
      popover.style.setProperty('--phlox-arrow', `${arrow}px`);
      const theme = untrack(() => scope.find<Theme>(THEME));
      const sides = theme?.class('popover.side') ?? '';
      if (sides) popover.className = classes(theme!.class('popover.wrap'), sides.replace('%s', y));
    };
    const outside = (event: PointerEvent) => {
      if (!popover.contains(event.target as Node) && !anchor.contains(event.target as Node)) cancel();
    };

    scope.run(() => {
      const theme = currentTheme();
      insert(host, (
        <div
          class={theme.class('popover.wrap')}
          role={kind === 'confirm' ? 'alertdialog' : 'dialog'}
          aria-labelledby={id}
          ref={element => { popover = element; }}
          onKeydown={event => {
            if (event.key !== 'Escape') return;
            // Only the popover closes, not a dialog under it
            event.preventDefault();
            event.stopPropagation();
            cancel();
          }}
        >
          <div class={theme.class('popover.arrow')} />
          <div class={theme.class('popover.body')}>
            <div class={theme.class('popover.label')} id={id}>{message}</div>
            {kind === 'prompt' ? (
              <input
                type="text"
                class={theme.class('popover.input')}
                value={value}
                placeholder={options.placeholder ?? null}
                aria-labelledby={id}
                onInput={event => value.set(event.currentTarget.value)}
                onKeydown={event => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  ok();
                }}
              />
            ) : null}
            <div class={theme.class('popover.actions')}>
              {kind === 'alert' ? null : (
                <button type="button" class={theme.class('popover.cancel')} onClick={cancel}>{options.cancelText ?? messageTexts.cancel}</button>
              )}
              <button type="button" class={theme.class(options.danger ? 'popover.okDanger' : 'popover.ok')} onClick={ok}>
                {options.okText ?? messageTexts.ok}
              </button>
            </div>
          </div>
        </div>
      ), null);
    });

    document.body.append(host);
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    document.addEventListener('pointerdown', outside, true);
    (popover!.querySelector<HTMLElement>('input') ?? [...popover!.querySelectorAll<HTMLElement>('button')].at(-1))?.focus();
  });
}

/**
 * A dialog without buttons while something runs. It cannot be closed by the user, only by close().
 * The message can be changed: handle.update('Saving 2 of 5…').
 */
export function showLoading(owner: Scope, message: Child = messageTexts.loading): LoadingHandle {
  const scope = new Scope(owner);
  const text = state<Child>(message);
  const element = document.createElement('dialog');
  element.addEventListener('cancel', event => event.preventDefault());
  scope.run(() => {
    const theme = currentTheme();
    element.className = classes(theme.class('dialog'), 'phlox-loading');
    element.setAttribute('aria-busy', 'true');
    insert(element, h('div', { class: theme.class('dialogContent') },
      h('div', { class: classes(theme.class('dialogBody'), theme.class('message.loading')), role: 'status' },
        h('span', { class: theme.class('message.spinner'), 'aria-hidden': 'true' }),
        h('span', null, () => text()),
      ),
    ), null);
  });
  document.body.append(element);
  if (typeof element.showModal === 'function') element.showModal();
  else element.setAttribute('open', '');
  return {
    update: next => text.set(next),
    close: () => {
      scope.dispose();
      element.remove();
    },
  };
}

/**
 * Flash messages as toasts, like the notifications of capify: they stack in a corner, disappear by themselves
 * with a bar of the remaining time, wait while the pointer or the focus is on them, and can be closed.
 * The Application shows them; a layout that shows flash messages itself sets flashes.toasts = false.
 */
export function Toasts(props: { flashes: FlashMessages }): Child {
  const { flashes } = props;
  const theme = currentTheme();
  const slot = (name: string) => theme.class(`toast.${name}`);
  // A closed toast stays a moment to slide away
  const shown = state<Flash[]>([]);
  const leaving = state<Flash[]>([]);
  effect(() => {
    const now = flashes.messages();
    untrack(() => {
      const gone = shown().filter(flash => !now.includes(flash) && !leaving().includes(flash));
      shown.update(list => [...list, ...now.filter(flash => !list.includes(flash))]);
      if (!gone.length) return;
      const drop = () => {
        shown.update(list => list.filter(flash => !gone.includes(flash)));
        leaving.update(list => list.filter(flash => !gone.includes(flash)));
      };
      if (!allowsMotion()) return drop();
      leaving.update(list => [...list, ...gone]);
      setTimeout(drop, 200);
    });
  });

  return (
    <div class={classes('cap-notify-container', slot('container'))} data-pos={flashes.position}>
      <For each={shown}>
        {flash => {
          const type = ['success', 'warning', 'error'].includes(flash.type) ? flash.type : 'info';
          return (
            <div
              class={() => classes('cap-notify', slot('card'), slot(type), leaving().includes(flash) && 'cap-notify-exit')}
              data-type={type}
              role={type === 'error' ? 'alert' : 'status'}
              onMouseenter={() => flashes.pause(flash)}
              onMouseleave={() => flashes.resume(flash)}
              onFocusin={() => flashes.pause(flash)}
              onFocusout={() => flashes.resume(flash)}
            >
              <If when={() => Boolean(flash.title)}>
                <div class={slot('title')}>{flash.title}</div>
              </If>
              <div class={slot('message')}>{flash.text}</div>
              <button type="button" class={classes('cap-notify-close', slot('close'))} aria-label={messageTexts.close} onClick={() => flashes.remove(flash)}>
                {theme.closeText}
              </button>
              {flash.duration > 0 ? <div class="cap-notify-progress" style={`animation-duration: ${flash.duration}ms`} /> : null}
            </div>
          );
        }}
      </For>
    </div>
  );
}
