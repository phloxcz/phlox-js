# Odchod s neuloženými změnami

Komponenta, která drží rozpracované změny, to řekne metodou `hasUnsavedChanges()`. Typicky podle formuláře:

```ts
class ItemEdit extends Presenter {
  public override hasUnsavedChanges() {
    return this.form.isChanged();
  }
}
```

<!-- demo: leave-unsaved -->

Než taková komponenta odejde, framework se uživatele zeptá „Odejít bez uložení změn?“ s tlačítky Zrušit a Odejít:

- **Jiný odkaz, `redirect`, `navigate`:** nová obrazovka se připraví stranou a před výměnou přijde otázka. Při Zrušit zůstane stará obrazovka i URL.
- **Tlačítko Zpět a Vpřed:** prohlížeč změní URL dřív, než se framework může zeptat. Při Zrušit ji router vrátí.
- **Escape a × v okně dialogu** volají `cancel()`, které se zeptá a pak dialog zavře.
- **Zavření nebo obnovení stránky, odkaz mimo aplikaci:** zeptá se prohlížeč svou vlastní otázkou, text nastavit nejde.

Platí to pro komponentu a všechno uvnitř ní: komponentu v presenteru, který odchází, i dialog otevřený z něj. Komponenta, která zůstává, se neptá.

- **Presenter, který zůstává a ukáže jiný záznam:** `/pages/5` → `/pages/6`, jiný režim `/pages/5/template` nebo jiná routa téhož presenteru. Jeho akce změní stav a obsah se vykreslí znovu, takže rozepsané změny v něm by zmizely. Router se proto zeptá ještě před akcí, jednou za presenter i všechno v něm. Změna jen query (hledání, stránka gridu) se neptá, obsah zůstává.

- **`close()` z kódu se neptá:** tlačítka Uložit a Zrušit v dialogu zavírají záměrně. Kdo chce i u svého Zrušit otázku, zavolá `this.cancel()`.
- **Akce presenterů, které zůstávají** a mění jen query, proběhnou ještě před otázkou, jako každá příprava nové obrazovky. Při Zrušit se nic nezmění.
- **Texty:** `messageTexts.unsaved` a `messageTexts.leave`. Ptá se `app.mayLeave(components)`, které jde zavolat i z vlastního kódu.
