/**
 * A button with the classes of the theme: <Button primary onClick={…}>Uložit</Button>.
 * Without a variant it is a secondary button (Cancel, Close).
 */
import type { Child, ElementProps } from './jsx';
export type ButtonProps = Omit<ElementProps<HTMLButtonElement>, 'class'> & {
    /** The main action of the place, like Save. */
    primary?: boolean;
    /** An action that destroys something, like Delete. */
    danger?: boolean;
    small?: boolean;
    /** Own classes added to the ones of the theme. */
    class?: string;
};
export declare function Button(props: ButtonProps): Child;
