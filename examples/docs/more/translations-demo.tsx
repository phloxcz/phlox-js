import { Button, Component, state } from 'phlox-js';
import { IntlTranslator } from 'phlox-js/localization';

// In an application these are locales/cs.json and locales/en.json
const cs = {
  greeting: 'Ahoj {name}',
  items: { one: '{count} položka', few: '{count} položky', other: '{count} položek' },
  price: 'Cena: {amount} Kč',
};
const en: typeof cs = {
  greeting: 'Hello {name}',
  items: { one: '{count} item', few: '{count} items', other: '{count} items' },
  price: 'Price: {amount} CZK',
};

const translator = new IntlTranslator('cs', cs);
const { t } = translator;

/** Keys checked by the compiler, plurals by the rules of the language, numbers in its format. */
export default class Translations extends Component {
  readonly count = state(1);
  readonly locale = state('cs');

  switchTo(locale: 'cs' | 'en') {
    translator.setLocale(locale, locale === 'cs' ? cs : en);
    // In an application: app.restart() builds the screens again; here only this demo reads the locale
    this.locale.set(locale);
  }

  render() {
    return (
      <div>
        <p>
          <Button small onClick={() => this.switchTo('cs')}>CS</Button>{' '}
          <Button small onClick={() => this.switchTo('en')}>EN</Button>{' '}
          <Button small onClick={() => this.count.update(n => n + 1)}>+1</Button>
        </p>
        {() => {
          this.locale();
          return (
            <ul>
              <li>{t('greeting', { name: 'Jano' })}</li>
              <li>{() => t('items', { count: this.count() })}</li>
              <li>{() => t('price', { amount: this.count() * 1234.5 })}</li>
            </ul>
          );
        }}
      </div>
    );
  }
}
