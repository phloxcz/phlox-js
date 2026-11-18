import { Button, Component } from '@phloxcz/phlox-js';
import { Form, FormView } from '@phloxcz/phlox-js/forms';
import { HelpdeskApi } from '../api';
import type { ProjectInput, ProjectResource } from '../api';

const COLORS: [string, string][] = [
  ['#1ba3b2', 'Tyrkysová'], ['#2563eb', 'Modrá'], ['#f59e0b', 'Oranžová'], ['#ef4444', 'Červená'], ['#8b5cf6', 'Fialová'], ['#1d4ed8', 'Tmavě modrá'],
];

/** A new project in a dialog. A name that already exists is refused by the server, the error shows at the field. */
export class ProjectEdit extends Component<{}, ProjectResource> {
  public form = new Form<ProjectInput>();

  public constructor(private api: HelpdeskApi) {
    super();
    this.form.addText('name', 'Název').setRequired('Vyplňte název.').addRule(Form.MaxLength, 'Nejvýš %d znaků.', 60);
    this.form.addText('subtitle', 'Popis', 60);
    this.form.addRadioList('color', 'Barva', COLORS).setRequired('Vyberte barvu.');
    this.form.setDefaults({ color: COLORS[0]![0] });
    this.form.onSuccess = async input => this.close(await this.api.call('project.create', { input }));
  }

  public override hasUnsavedChanges() {
    return this.form.isChanged();
  }

  public override title() {
    return 'Nový projekt';
  }

  public override actions() {
    return <>
      <Button onClick={() => this.cancel()}>Zrušit</Button>
      <Button primary disabled={this.form.submitting} onClick={() => this.form.submit()}>Založit</Button>
    </>;
  }

  public render() {
    return <FormView form={this.form} class="hd-dialog-form hd-project-form" />;
  }
}
