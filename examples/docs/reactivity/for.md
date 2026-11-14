# Seznamy

Uvnitř je funkce, která pro položku vrátí šablonu řádku. Při změně seznamu zůstanou v DOM řádky, které v něm byly, a jen se doplní, odeberou nebo přesunou. Má dva režimy.

## Bez `key`: položky jsou objekty, které žijí dál

Řádek patří konkrétnímu objektu. Položku dostaneš jako obyčejnou hodnotu. Co se má v řádku měnit, je `state` uvnitř položky.

```tsx
interface Item {
  name: string;
  done: State<boolean>;
}

const items = state<Item[]>([]);

<For each={items}>
  {item => (
    <li class={() => (item.done() ? 'done' : '')}>
      <input
        type="checkbox"
        checked={item.done}
        onChange={event => item.done.set(event.currentTarget.checked)}
      />
      <span>{item.name}</span>
      <button onClick={() => remove(item)}>Smazat</button>
    </li>
  )}
</For>
```

<!-- demo: for-items -->

## S `key`: seznam se načítá znovu ze serveru

`key` říká, podle čeho se pozná „ten samý řádek“. Když přijdou úplně nové objekty, řádky se stejným klíčem zůstanou v DOM a jen se aktualizují. Zachová se tak fokus, pozice rolování i rozepsaný text.

```tsx
interface Item {
  id: number;
  name: string;
  done: boolean;
}

const items = state<Item[]>([]);

<For each={items} key={item => item.id}>
  {item => (
    <li class={() => (item().done ? 'done' : '')}>
      <input
        type="checkbox"
        checked={() => item().done}
        onChange={event => api.setDone(item().id, event.currentTarget.checked)}
      />
      <span>{() => item().name}</span>
      <button onClick={() => remove(item().id)}>Smazat</button>
    </li>
  )}
</For>
```

<!-- demo: for-keyed -->

**Položka je tu funkce, ne hodnota.** Řádek přežije výměnu objektu, takže se musí umět zeptat na aktuální data: `item().name`.

**Pozor na jednu chybu:** co se má samo aktualizovat, musí být ve funkci. `{() => item().name}` se aktualizuje, `{item().name}` se přečte jen jednou při vytvoření řádku. Že je `item` funkce, hlídá kompilátor. To obalení do funkce už ne.

## Kdy který režim

| Situace | Režim |
|---|---|
| Položky vznikají v prohlížeči a mění se jejich vnitřní `state` | bez `key` |
| Seznam se načítá z RPC nebo se položky nahrazují novými objekty | s `key` |

Bez `key` by znovu načtený seznam fungoval taky, jen by se všechny řádky zahodily a postavily znovu.

## Pořadí řádku

Druhý parametr je pořadí řádku jako funkce. Aktualizuje se při přesunu.

```tsx
<For each={items}>
  {(item, index) => <li>{() => index() + 1}. {item.name}</li>}
</For>
```
