import { Presenter } from 'phlox-js';
import { html, t } from '../i18n';

/** Loaded only when somebody opens /about, see the route in AppPresenter. */
export default class AboutPresenter extends Presenter {
  render() {
    return (
      <article>
        <h1>{t('about.title')}</h1>
        <p>{html('about.text')}</p>
      </article>
    );
  }
}
