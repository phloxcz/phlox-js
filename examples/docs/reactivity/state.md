# Reaktivní hodnoty

## `state`

Hodnota, která se může měnit. Čte se zavoláním, mění přes `set` nebo `update`.

```ts
const count = state(1);

count();                    // 1
count.set(2);
count.update(n => n + 1);   // 3
```

<!-- demo: state-counter -->

Nastavení stejné hodnoty nic nespustí. Pole a objekty se porovnávají identitou, takže se nemění na místě, ale nahrazují:

```ts
items.update(list => [...list, item]);   // správně
items().push(item);                      // špatně, nikdo se o změně nedozví
```

## `computed`

Odvozená hodnota. Spočítá se, až ji někdo čte, a znovu jen tehdy, když se změnilo něco, co četla.

```ts
const remaining = computed(() => items().filter(item => !item.done()).length);
```

`computed` nesmí měnit žádný `state`, skončí to chybou.

## `effect`

Funkce, která se spustí hned a pak znovu po každé změně toho, co četla. V šablonách není potřeba, ty se aktualizují samy. Hodí se pro napojení na okolí: titulek stránky, `localStorage`, cizí widget.

```ts
const stop = effect(() => {
  document.title = `Zbývá ${remaining()}`;
});

stop();   // ukončí efekt
```

Efekt může vrátit úklidovou funkci. Zavolá se před dalším spuštěním a při ukončení:

```ts
effect(() => {
  const timer = setInterval(tick, delay());
  return () => clearInterval(timer);
});
```

<!-- demo: effect-timer -->

## `batch` a `untrack`

```ts
// Více změn najednou, efekty a šablony se aktualizují až po poslední
batch(() => {
  first.set('Jan');
  last.set('Novák');
});

// Přečte hodnotu, aniž by se na ni efekt přihlásil
effect(() => {
  save(form(), untrack(userId));
});
```

<!-- demo: batch-names -->
