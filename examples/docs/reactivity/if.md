# Podmínky

Píše se jako `{if} … {elseif} … {else} … {/if}` v Latte. `<ElseIf />` a `<Else />` oddělují větve.

```tsx
<If when={user}>
  <Profile />
<ElseIf when={loading} />
  <Spinner />
<Else />
  <Login />
</If>
```

<!-- demo: if-branches -->

- **Existuje jen zobrazená větev.** Zobrazí se první větev se splněnou podmínkou. Ostatní se nevytvoří vůbec, jejich komponenty neběží. Skrytá větev se z DOM odstraní a uklidí, při dalším zobrazení vznikne nová.
- **Podmínka je `state` nebo funkce:** `when={user}`, `when={() => items().length > 0}`. Zápis `when={items().length > 0}` kompilátor odmítne, protože by se vyhodnotil jen jednou.
- **Větev se nepřestavuje zbytečně.** Když se hodnota podmínky změní, ale větev zůstává stejná, DOM zůstane.

**Hodnota podmínky uvnitř větve:** TypeScript neví, že `user()` uvnitř není `null`. Buď napíšeš `user()!.name`, nebo si v první větvi necháš hodnotu předat jako parametr:

```tsx
<If when={user}>
  {u => <b>{() => u().name}</b>}
</If>
```
