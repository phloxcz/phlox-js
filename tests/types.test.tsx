/**
 * Checked by `npm run typecheck`: every @ts-expect-error fails the check when the line below it compiles.
 * Regression from TraceJS, where IntrinsicElements was `any`.
 */
import { expect, test } from 'vitest';
import { Else, ElseIf, For, If } from '../src/ui/flow';
import { state } from '../src/reactive/reactive';

export function typeChecks() {
  const name = state('a');
  const count = state(1);
  const on = state(true);
  const rows = state([{ id: 1 }]);

  return [
    <a href="/x" title={name} class={() => 'a'} data-x={1} aria-label="x" />,
    <input disabled={on} value={name} maxLength={3} onInput={e => e.currentTarget.value} />,
    <label for="x" />,

    // @ts-expect-error unknown attribute
    <div hrefx="x" />,
    // @ts-expect-error attribute of another element
    <div href="/x" />,
    // @ts-expect-error wrong attribute type
    <input disabled="yes" />,
    // @ts-expect-error wrong type of a reactive value
    <input disabled={name} />,
    // @ts-expect-error class is the attribute
    <div className="x" />,
    // @ts-expect-error HTML from a string is not available as an attribute
    <div innerHTML="<b>x</b>" />,
    // @ts-expect-error read-only property
    <div offsetWidth={1} />,
    // @ts-expect-error unknown element
    <foo />,
    // @ts-expect-error a handler must be a function
    <button onClick="x" />,

    <For each={rows}>{row => <b>{row.id}</b>}</For>,
    <For each={rows} key={row => row.id}>{row => <b>{() => row().id}</b>}</For>,
    // @ts-expect-error without a key the item is a plain value
    <For each={rows}>{row => <b>{row().id}</b>}</For>,
    // @ts-expect-error with a key the item is an accessor
    <For each={rows} key={row => row.id}>{row => <b>{row.id}</b>}</For>,

    <If when={count}>{value => <b>{value() + 1}</b>}</If>,
    <If when={on}><b /></If>,
    <If when={on}>text<b /><ElseIf when={() => count() > 1} /><i /><Else />{count}</If>,
    // @ts-expect-error when must be reactive
    <If when={true}><b /></If>,
    // @ts-expect-error ElseIf needs a condition
    <If when={on}><b /><ElseIf /><i /></If>,
    // @ts-expect-error the condition of ElseIf must be reactive
    <If when={on}><b /><ElseIf when={true} /><i /></If>,
  ];
}

test('compile-time checks live in typeChecks()', () => {
  expect(typeChecks).toBeTypeOf('function');
});
