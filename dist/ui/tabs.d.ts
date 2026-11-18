/**
 * Tabs: a row of tabs over panels, only the panel of the chosen tab is visible.
 *
 *   <Tabs>
 *     <Tab title="Název a popis">…</Tab>
 *     <Tab title="Varianty">…</Tab>
 *   </Tabs>
 *
 * The panels stay in the page when hidden, so the controls of a form in them keep their values and are
 * validated. A control that gets the focus from a hidden panel (the first error after a failed validation)
 * switches to its tab, and a tab with an error in its panel has a mark. Tabs that do not fit are behind "More".
 */
import type { State } from '../reactive/reactive';
import type { Child } from './dom';
export declare const tabsTexts: {
    more: string;
    hasErrors: string;
};
export interface TabProps {
    /** Text or a template (an icon and text); it is shown in the tab and in the menu "More" too. */
    title: Child;
    children?: Child;
}
export interface TabsProps {
    /** The index of the chosen tab; a state of the caller lets it keep the tab, e.g. in the URL or by preference(). */
    selected?: State<number>;
    'aria-label'?: string;
    /** Classes of the whole, added to the theme slot `tabs`. */
    class?: string;
    children?: Child;
}
/** A tab of <Tabs>, it can be used only directly inside it. */
export declare function Tab(_props: TabProps): Child;
/**
 * Which tabs are shown when they need `widths` and there is `available` room: as many from the start as fit
 * next to the button "More" (`moreWidth`). The chosen one is shown always, instead of the last that fits.
 */
export declare function fitTabs(widths: number[], available: number, moreWidth: number, selected: number): boolean[];
export declare function Tabs(props: TabsProps): Child;
