# Úklid

Úklid je automatický. Když zmizí větev `<If>`, řádek `<For>` nebo celé view z `render`, zruší se všechny jejich efekty a posluchače událostí. V šabloně není potřeba nic odhlašovat.

Vlastní úklid (časovač, cizí widget) se přihlásí přes `onCleanup` nebo návratovou hodnotou efektu:

```tsx
function Clock() {
  const now = state(new Date());
  const timer = setInterval(() => now.set(new Date()), 1000);
  onCleanup(() => clearInterval(timer));
  return <time>{() => now().toLocaleTimeString()}</time>;
}
```

<!-- demo: cleanup-clock -->
