/**
 * A button with the classes of the theme: <Button primary onClick={…}>Uložit</Button>.
 * Without a variant it is a secondary button (Cancel, Close).
 */

import type { Child, ElementProps } from './jsx';
import { classes, currentTheme } from './theme';

export type ButtonProps = Omit<ElementProps<HTMLButtonElement>, 'class'> & {
  /** The main action of the place, like Save. */
  primary?: boolean;
  /** An action that destroys something, like Delete. */
  danger?: boolean;
  small?: boolean;
  /** Own classes added to the ones of the theme. */
  class?: string;
};

export function Button(props: ButtonProps): Child {
  const { primary, danger, small, class: own, children, ...attributes } = props;
  const theme = currentTheme();
  const variant = danger ? 'buttonDanger' : primary ? 'buttonPrimary' : 'buttonSecondary';
  return (
    <button type="button" {...attributes} class={classes(theme.class(variant), small && theme.class('buttonSmall'), own)}>
      {children}
    </button>
  );
}
