import { Component } from 'phlox-js';
import { t } from '../i18n';

/** A yes/no question. Closed by Escape it returns undefined, which the caller takes as "no". */
export class Confirm extends Component<{ question: string }, boolean> {
  override title() {
    return t('confirm.title');
  }

  override actions() {
    return (
      <>
        <button onClick={() => this.close(false)}>{t('confirm.no')}</button>
        <button onClick={() => this.close(true)}>{t('confirm.yes')}</button>
      </>
    );
  }

  render() {
    return <p>{this.props.question}</p>;
  }
}
