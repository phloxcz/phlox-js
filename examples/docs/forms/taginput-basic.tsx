import { Component, computed } from '@phloxcz/phlox-js';
import { Form, FormView } from '@phloxcz/phlox-js/forms';
import { searchPeople } from './_people';

interface Values { members: number[]; labels: string[] }

const LABELS = ['chyba', 'nápad', 'dotaz', 'urgentní', 'dokumentace'];

/** Several values as tags: ids from suggestions, or texts with new tags from what is typed. */
export default class TagInputs extends Component {
  public readonly form = new Form<Values>();
  public readonly values = computed(() => JSON.stringify(this.form.getValues()));
  public readonly members = this.form.addTagInput('members', 'Členové (search)', {
    search: async text => (await searchPeople(text)).map(person => [person.id, person.name] as const),
  });
  public readonly labels = this.form.addTagInput('labels', 'Štítky (allowNew, nejvýš 4)', { items: LABELS, allowNew: true, maxTags: 4 })
    .addRule(Form.MaxLength, 'Nejvýš %d štítky.', 4);
  public readonly split = computed(() => JSON.stringify(this.labels.getSplitValue()));

  public constructor() {
    super();
    this.labels.setValue(['chyba']);
  }

  public render() {
    return (
      <div>
        <FormView form={this.form} />
        <p><code>{this.values}</code></p>
        <p>getSplitValue(): <code>{this.split}</code></p>
      </div>
    );
  }
}
