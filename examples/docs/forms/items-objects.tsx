import { Component, computed } from '@phloxcz/phlox-js';
import { Form, FormView } from '@phloxcz/phlox-js/forms';
import { PEOPLE, readPerson, searchPeople } from './_people';
import type { Person } from './_people';

interface Values { assigneeId: number | null; reviewerId: number | null; watchers: number[] }

/** A person with a coloured initial, the own template of items. */
const Avatar = (props: { person: Person }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}>
    <span style={{
      display: 'inline-grid', placeItems: 'center', width: '1.4rem', height: '1.4rem', borderRadius: '50%', fontSize: '.7rem', color: '#fff',
      background: ['#0b7285', '#c2255c', '#5f3dc4'][props.person.id % 3]!,
    }}>{props.person.name[0]}</span>
    {props.person.name} <small style={{ opacity: 0.6 }}>{props.person.team}</small>
  </span>
);

/** Items as objects straight from the server, drawn by a template; a saved value passed with its object. */
export default class ObjectItems extends Component {
  readonly form = new Form<Values>();
  readonly values = computed(() => JSON.stringify(this.form.getValues()));

  constructor() {
    super();
    this.form.addDropDownList('assigneeId', 'Řešitel', {
      items: PEOPLE.slice(0, 12),
      itemValue: person => person.id,
      itemLabel: person => person.name,
      template: person => <Avatar person={person} />,
      placeholder: 'Nepřiřazeno',
    });
    const reviewer = this.form.addComboBox('reviewerId', 'Kontrolor (objekty ze search)', {
      search: searchPeople,
      itemValue: person => person.id,
      itemLabel: person => person.name,
      template: person => <Avatar person={person} />,
    });
    const watchers = this.form.addTagInput('watchers', 'Sledující', {
      search: searchPeople,
      itemValue: person => person.id,
      itemLabel: person => person.name,
      template: person => <Avatar person={person} />,
      label: readPerson,
    });
    // The server sent the reviewer with the task: no query for its label
    reviewer.setValue(260, PEOPLE[259]);
    watchers.setValue([5, 270]);
  }

  render() {
    return <div><FormView form={this.form} /><p><code>{this.values}</code></p></div>;
  }
}
