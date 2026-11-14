# Pravidla a kontrola

```ts
form.addText('name').setRequired('Vyplňte jméno.');
form.addText('zip').addRule(Form.Pattern, 'PSČ má pět číslic.', '\\d{5}');
form.addInteger('age').addRule(Form.Range, 'Věk mezi %d a %d.', [18, 120]);

const password = form.addPassword('password').addRule(Form.MinLength, 'Aspoň %d znaků.', 8);
form.addPassword('again').addRule(Form.Equal, 'Hesla se neshodují.', password);

form.addText('note')
  .addConditionOn(form.get('done'), Form.Filled)
    .setRequired('U hotového úkolu vyplňte poznámku.')
  .elseCondition()
    .addRule(Form.MaxLength, 'Nejvýš %d znaků.', 50)
  .endCondition();
```

<!-- demo: rules-conditions -->

- **Pravidla:** `Filled` (= `Required`), `Blank`, `Equal`, `NotEqual`, `MinLength`, `MaxLength`, `Length`, `Email`, `URL`, `Pattern`, `Integer`, `Float`, `Min`, `Max`, `Range`, `IsIn`, pro soubory `MaxFileSize`, `MimeType` a `Image`. `Min` a `Max` porovnávají i data: `addRule(Form.Min, 'Termín nesmí být v minulosti.', today)`.
- **Vlastní pravidlo** je funkce `(control, arg) => boolean`: `addRule(control => control.getValue() !== 'admin', 'Toto jméno je vyhrazené.')`.
- **Jako v Nette se pravidla kontrolují jen u vyplněného prvku,** kromě `setRequired`. Prázdné nepovinné pole s `Form.Email` je tedy v pořádku.
- **U prvku se hlásí jen první chyba.**
- **Zástupné hodnoty v hláškách:** `%d` a `%s` podle argumentů, `%label`, `%name`, `%value`.
- **Výchozí hlášky** jsou anglicky, česky s `setTexts(cs)` (viz Překlady, znění jako v českém Nette). Jednotlivou přepíše `Form.messages.set(Form.Filled, 'Vyplňte %label.')`.
- **`toggle(id)`** v podmínce zobrazí prvek s tím id, jen když podmínka platí: `form.get('done').addCondition(Form.Filled).toggle('note-pair')`.

## Kdy se kontroluje

- **Při odeslání** se zkontroluje celý formulář. Když neprojde, zavolá se `onError`, u polí se objeví chyby a kurzor skočí na první chybné pole. Při úspěchu se zavolá `onSuccess`.
- **Během psaní:** po opuštění pole, které uživatel změnil, se kontroluje živě. Chyba zmizí, jakmile ji uživatel opraví.
- **Pole, na které uživatel nesáhl,** se při opuštění nekontroluje: projití prázdného povinného pole Tabem chybu neukáže, ukáže ji až odeslání. U dropdownlistu a stromu v panelu se počítá i otevření seznamu.
- **`form.reset()`** vrátí formulář do stavu nového, pole se pak zase chovají jako nedotčená. Hodí se po odeslání komentáře, kdy pole zůstává ve fokusu.
- **Přechod z pole na tlačítko** chybu ještě neukáže. Chyba by tlačítko posunula a klik by skončil vedle. Odeslání stejně zkontroluje celý formulář.
- **Během `onSuccess`** jsou tlačítka formuláře zakázaná a `form.submitting()` vrací `true`.
- **Tlačítko bez kontroly**, třeba Zrušit: `addSubmit('cancel').setValidationScope([])`. Které tlačítko formulář odeslalo, řekne v `onSuccess` metoda `button.isSubmittedBy()`.
- **Odeslání z kódu:** `await form.submit()`, třeba z tlačítka v patičce dialogu, které leží mimo `<form>`. Vrací, jestli formulář prošel.
- **Enter v textovém poli** formulář odešle, i když formulář nemá tlačítko pro odeslání a má víc textových polí. Prohlížeč by to sám neudělal.

## Chyby ze serveru

Kontrola v prohlížeči slouží uživateli, bezpečnost zajišťuje server. Když `onSuccess` skončí chybou neplatných parametrů z `phlox-rpc-api` (`-32602`), formulář ji nevyhodí, ale ukáže u polí. `input.name` patří k prvku `name`, `input.customer.city` k městu v kontejneru `customer` a `input.lines.2.quantity` k množství ve třetím řádku (viz Kontejnery a řádky). Cesta ke celým řádkům (`input.lines`) se ukáže nad řádky. Cesta, ke které prvek není, se ukáže jako chyba celého formuláře v `<FormErrors>`.

<!-- demo: rules-server -->

Ručně: `form.addServerErrors(error)` a vlastní předpona cesty `form.addServerErrors(error, 'data')`. Jiné chyby z `onSuccess` dostane `app.onError`.

**Žádné pravidlo nesmí platit jen v prohlížeči.** Co prohlížeč pustí a server odmítne, se uživateli ukáže u pole. Rozdílná pravidla jsou pak jen nepohodlí, ne díra.
