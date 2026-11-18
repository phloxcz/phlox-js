import { Component, computed, state } from '@phloxcz/phlox-js';
import { Form, FormView } from '@phloxcz/phlox-js/forms';
import type { FormControl } from '@phloxcz/phlox-js/forms';

type Lock = 'none' | 'readonly' | 'disabled';

interface Values {
  code: string;
  note: string;
  city: number | null;
  size: string | null;
  days: string[];
}

/** Read-only and disabled controls, disabled items; the buttons switch the state of the first three fields. */
export default class LockedControls extends Component {
  public readonly form = new Form<Values>();
  public readonly lock = state<Lock>('none');
  private readonly locked: FormControl[];
  public readonly values = computed(() => JSON.stringify(this.form.getValues(), null, 1));

  public constructor() {
    super();
    const f = this.form;
    this.locked = [
      f.addText('code', 'Kód'),
      f.addTextArea('note', 'Poznámka'),
      f.addDropDownList('city', 'Město', {
        items: [[1, 'Praha'], [2, 'Brno (zrušeno)'], [3, 'Ostrava']],
        itemDisabled: (city: number) => city === 2,
      }),
    ];
    f.addSelect('size', 'Velikost', ['S', 'M', 'L']).setPrompt('–').setDisabled(['M']);
    f.addCheckboxList('days', 'Dny', { mon: 'Po', tue: 'Út', sat: 'So' }).setDisabled(['sat']);
    f.setDefaults({ code: 'A-17', note: 'Vyplnil systém.', city: 1 });
    this.setLock('readonly');
  }

  public setLock(lock: Lock) {
    this.lock.set(lock);
    for (const control of this.locked) {
      control.setReadOnly(lock === 'readonly');
      control.setDisabled(lock === 'disabled');
    }
  }

  public render() {
    const choice = (value: Lock, caption: string) => (
      <button type="button" class={() => `btn btn-sm ${this.lock() === value ? 'btn-primary' : 'btn-outline-primary'}`}
        onClick={() => this.setLock(value)}>{caption}</button>
    );
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 14rem)', gap: '1rem' }}>
        <div>
          <div class="btn-group mb-3">
            {choice('none', 'Upravitelné')}
            {choice('readonly', 'setReadOnly()')}
            {choice('disabled', 'setDisabled()')}
          </div>
          <FormView form={this.form} />
        </div>
        <pre style={{ margin: 0, fontSize: '.8rem' }}>{this.values}</pre>
      </div>
    );
  }
}
