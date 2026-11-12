import { Component, For, If } from 'phlox-js';
import type { Child } from 'phlox-js';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export interface MenuEntry {
  href: string;
  icon: IconName;
  text: string;
  current: () => boolean;
  count?: () => number;
}

/** Links of the main menu: in the bar on the left, and in the panel of the hamburger on a phone. */
export function MenuLinks(props: { entries: MenuEntry[]; onPick?: () => void }): Child {
  return (
    <For each={() => props.entries}>
      {entry => (
        <a href={entry.href} class="hd-nav-item" title={entry.text} aria-current={() => (entry.current() ? 'page' : null)}
          onClick={() => props.onPick?.()}>
          <Icon name={entry.icon} size={19} />
          <span>{entry.text}</span>
          {entry.count ? <If when={() => entry.count!() > 0}><span class="hd-nav-badge">{entry.count}</span></If> : null}
        </a>
      )}
    </For>
  );
}

/** The menu of a phone in a panel sliding in from the left. A click on a link goes there and closes it. */
export class MainMenu extends Component<{ entries: MenuEntry[] }> {
  override title() {
    return 'Menu';
  }

  render() {
    return <nav class="hd-nav hd-nav-panel" aria-label="Hlavní menu"><MenuLinks entries={this.props.entries} onPick={() => this.close()} /></nav>;
  }
}
