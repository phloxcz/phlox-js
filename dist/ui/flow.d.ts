/** Control flow in templates: If with ElseIf and Else, and For. */
import type { Accessor } from '../reactive/reactive';
import type { Child } from './dom';
type Truthy<T> = Exclude<T, null | undefined | false | 0 | ''>;
/** Like Child, but a function in the first branch may take the value of `when`. */
type IfChild<T> = Node | string | number | boolean | null | undefined | ((value: Accessor<Truthy<T>>) => Child) | IfChild<T>[];
/**
 * Shows the first branch whose condition is truthy:
 *
 *   <If when={user}> ... <ElseIf when={loading} /> ... <Else /> ... </If>
 *
 * Only the shown branch is created and inserted. A hidden one is removed and cleaned up,
 * and it is rebuilt only when another branch takes over, not with every change of the value.
 */
export declare function If<T>(props: {
    when: Accessor<T>;
    children?: IfChild<T>;
}): Child;
/** Starts the branch of <If> shown when no condition above is truthy. Like {else} in Latte. */
export declare function Else(): Child;
/** Starts another conditional branch of <If>. Like {elseif} in Latte. */
export declare function ElseIf(_props: {
    when: Accessor<unknown>;
}): Child;
/** Without `key` a row belongs to its item (compared by identity) and receives it as a plain value. */
export declare function For<T>(props: {
    each: Accessor<readonly T[]>;
    key?: undefined;
    children: (item: T, index: Accessor<number>) => Child;
}): Child;
/** With `key` a row survives a new object with the same key and receives the item as an accessor. */
export declare function For<T>(props: {
    each: Accessor<readonly T[]>;
    key: (item: T) => unknown;
    children: (item: Accessor<T>, index: Accessor<number>) => Child;
}): Child;
export {};
