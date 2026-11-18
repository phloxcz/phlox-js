# Formuláře

Jako `Nette\Forms`. Importuje se z `@phloxcz/phlox-js/forms`.

```tsx
// CreateTask je DTO vygenerované z PHP (npm run rpc:types)
class TaskCreatePresenter extends Presenter {
  public form = new Form<CreateTask>();

  public constructor(private api: RpcApi) {
    super();
    this.form.addText('name', 'Název:')
      .setRequired('Vyplňte název.')
      .addRule(Form.MaxLength, 'Nejvýš %d znaků.', 100);
    this.form.addSelect('priority', 'Priorita:', { 1: 'Nízká', 2: 'Střední', 3: 'Vysoká' })
      .setPrompt('Vyberte');
    this.form.addDate('dueDate', 'Termín:');
    this.form.addSubmit('save', 'Uložit');
    this.form.onSuccess = values => this.handleSave(values);
  }

  public async handleSave(values: CreateTask) {
    await this.api.call('task.create', { input: values });
    this.flashMessage('Uloženo.');
    this.redirect('default');
  }

  public render() {
    return <FormView form={this.form} />;
  }
}
```

<!-- demo: form-basic -->

- **Typ hodnot je DTO.** Kompilátor hlídá názvy prvků i jejich druh: `addText('nmae')` je chyba, stejně jako `addText('priority')`, když je priorita číslo. `onSuccess` dostane hodnoty typu `CreateTask`.
- **Prvek, se kterým budeš dál pracovat, si nech z `addXxx()`:** `public readonly shop = this.form.addComboBox('shop', …)`. Ten má svůj typ, takže jsou vidět i jeho vlastní metody (`isCustom()`, `getSplitValue()`, `setValue(hodnota, objekt)`, `editor`, `tree`). `form.get('shop')` vrací obecný `FormControl` s hodnotou, pravidly a chybami, na `<Input>`, `<Label>` a `.value` stačí.
- **Formulář se tvoří v konstruktoru** nebo jako pole třídy, obdoba `createComponentXxx()`.
- **Data ze serveru** se do prvků dostanou přes `form.setDefaults({ name: task.name })`, typicky ve `startup()`.
- **`form.isChanged()`** je `true`, když se hodnoty liší od uložených (reaktivně, jde dát do šablony). Uložené jsou hodnoty z `setDefaults()`, po úspěšném `onSuccess`, po `reset()`, jinak ty, které měl formulář při prvním vykreslení. Změna tam a zpět se nepočítá. `form.markSaved()` označí aktuální hodnoty za uložené, když se ukládá mimo `onSuccess`. Slouží hlavně pro `hasUnsavedChanges()`, viz Odchod s neuloženými změnami.
