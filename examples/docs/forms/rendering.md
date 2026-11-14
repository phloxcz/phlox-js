# Vykreslení

**Automaticky** jako `{control form}`: `<FormView form={this.form} />`. Každý prvek dostane řádek s id `<id prvku>-pair` (pro `toggle()`) a nahoře jsou chyby formuláře.

**Ručně** jako `{form}…{/form}` v Latte:

```tsx
const name = this.form.get('name');

<FormTag form={this.form}>
  <div class="field">
    <Label control={name} />
    <Input control={name} class="wide" placeholder="např. Nákup" />
    <InputError control={name} />
  </div>
  <Input control={this.form.getButton('save')} class="btn btn-primary" />
</FormTag>
```

<!-- demo: rendering-manual -->

| Latte | PhloxJS |
|---|---|
| `{form}…{/form}` | `<FormTag form={…}>` |
| `{label name /}` | `<Label control={…} />`, povinný prvek má třídu `required` |
| `{input name}` | `<Input control={…} />`, další atributy dostane prvek |
| `{inputError name}` | `<InputError control={…} />` |
| `n:name="name"` | `<input class="x" {...control.attrs()} />` |
| chyby formuláře | `<FormErrors form={…} />` |

- **Přístupnost:** chybné pole má `aria-invalid` a `aria-describedby` vede na text chyby.
- **Checkbox** se vykresluje uvnitř svého `<label>`, jako v Nette.
- **Třídy dává téma** (viz Vzhled a témata). Třída předaná do `<Input>` se přidá k třídě tématu, u tlačítka ji nahradí: `<Input control={cancel} class="btn btn-secondary" />`.
- **Prvek** dá `<Input control={text} ref={element => …} />`, nebo kdykoli později `control.element`.

## Hodnota prvku jinde na stránce

`control.value` je hodnota prvku jako stav (`state`). Dej ji do šablony bez volání a text sleduje psaní, jako binding v MVVM (v Knockoutu `text: name`). Nic se nepropojuje ručně:

```tsx
const name = this.form.get('name');

<h2>{name.value}</h2>                                 // mění se při psaní
<h2>{() => name.value() || 'Nová kategorie'}</h2>    // s úpravou: funkce, ve které se hodnota přečte
<p>{() => `${name.value().length} / 40 znaků`}</p>
```

- **Bez závorek, nebo ve funkci:** `{name.value}` předá šabloně funkci a ta ji sleduje. `{name.value()}` se závorkami přečte hodnotu jen jednou při vykreslení (viz Co je reaktivní). `name.value()` je totéž co `name.getValue()`.
- **Proč ne `{this.form.get('name')}`:** prvek v šabloně by mohl znamenat pole i hodnotu. Pole vykresluje `<Input control={…} />`, hodnotu `.value`.
- **Proč ne `this.form['name']` jako v Nette:** třída v TypeScriptu neumí přístup přes hranaté závorky typovaný podle DTO, aniž by se názvy polí tloukly s metodami formuláře (`reset`, `errors`…). `get('name')` kompilátor hlídá.
- **Zápis:** `name.value.set('Pánve')` nebo `name.value.update(text => text.trim())` zapíše hodnotu do pole, stejně jako `name.setValue()`.
- **Celý formulář:** `computed(() => this.form.getValues())` sleduje všechny prvky, i v kontejnerech a řádcích. Tak vzniká třeba živý součet faktury (viz Kontejnery a řádky).
- **Hodnota se mění při psaní,** ne až po uložení. Uložený stav (třeba název v jiném seznamu) se změní, až ho aplikace po uložení načte znovu.
