# Šablony

Šablony se píšou v TSX. Kvůli samotnému TSX se nic neimportuje, ani pro `<>…</>`. Projekt to má nastavené jednou v `tsconfig.json`:

```json
"jsx": "react-jsx",
"jsxImportSource": "@phloxcz/phlox-js"
```

Uvnitř repozitáře frameworku převádí `@phloxcz/phlox-js` na `src/` volba `paths` v `tsconfig.json`.

Šablonu vrací `render()` komponenty nebo presenteru. Kousek šablony jde vyčlenit do funkce:

```tsx
function Counter() {
  const count = state(0);
  return <button onClick={() => count.update(n => n + 1)}>Kliknuto: {count}</button>;
}
```

Bez aplikace a presenterů jde šablonu vložit do stránky funkcí `render`, která vrátí funkci pro odstranění: `const remove = render(() => <Counter />, element)`. Komponenty psané jako třída takto použít nejdou, potřebují běžící `Application`.

## Co je reaktivní

**Reaktivní je to, co předáš jako `state` nebo funkci.** Obyčejná hodnota se přečte jednou při vytvoření.

```tsx
<span>{count}</span>                        // aktualizuje se
<span>{() => count() * 2}</span>            // aktualizuje se
<span>{count() * 2}</span>                  // přečte se jednou, dál se nemění

<li class={() => (public done() ? 'done' : '')} /> // aktualizuje se
<input disabled={saving} />                 // aktualizuje se
```

<!-- demo: templates-reactive -->

Komponenta (funkce jako `Counter` výše) se spustí jednou. Nespouští se znovu při změně stavu, mění se jen místa v šabloně, která stav čtou.

## Atributy

- **Názvy** jsou jako v HTML: `class`, `for`. Kompilátor hlídá názvy i typy podle prvku.
- **`false`, `null` a `undefined`** atribut odstraní: `disabled={false}` prvek nezakáže.
- **`value` a `checked`** se nastavují tak, jak je uživatel vidí, i poté, co do pole psal.
- **`style`** bere text nebo objekt s názvy jako v `element.style`: `style={{ color: 'red', marginTop: '1rem' }}`. Číslo se zapíše tak, jak je, bez jednotky: `opacity: 0.5` a `flexGrow: 1` fungují, šířka potřebuje jednotku (`width: '100px'`).
- **Text se nikdy nevkládá jako HTML.** `innerHTML` mezi atributy záměrně není.
- **SVG** funguje přímo v šabloně: `<svg viewBox="0 0 24 24"><path d="M5 12h14" stroke-width="2" /></svg>`. Prvky uvnitř `<svg>` jsou SVG, obsah `<foreignObject>` zase HTML. Atributy s pomlčkou (`stroke-width`, `aria-hidden`) kompilátor nekontroluje.

## Události

Události jsou `on` + název s velkým písmenem. `event.currentTarget` má typ podle prvku.

```tsx
<input value={draft} onInput={event => draft.set(event.currentTarget.value)} />
<form onSubmit={save} />
```

<!-- demo: templates-events -->

**Chyby obsluh** jdou do `app.onError`, vyhozené i z promise, který obsluha vrátí. `onClick={() => this.handleSave()}` tak chybu serveru neztratí, ukáže se jako každá jiná chyba aplikace. Mimo běžící aplikaci (`render()`) se obsluha volá beze změny.

## Přístup k prvku: `ref`

`<div />` v kódu není DOM prvek, je to šablona. Skutečný prvek vznikne až při vložení do stránky a dostaneš ho přes `ref`:

```tsx
<input ref={element => element.focus()} />
```

Díky tomu jde šablonu uložit do proměnné, předat jinam nebo vložit vícekrát. Pokaždé vznikne nová instance.
