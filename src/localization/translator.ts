/** Translations. Translator is the contract, like Nette\Localization\Translator, IntlTranslator is the default. */

export type MessageParams = Record<string, string | number>;

/** A text, a plural (an object with `other` and the forms of the language) or a group of messages. */
export interface Messages {
  [key: string]: string | Messages;
}

/** Keys of all messages as `group.name`. A typo in a key becomes a compile error. */
export type MessageKey<M> = string extends keyof M ? string : {
  [K in keyof M & string]: M[K] extends string | { other: string } ? K : `${K}.${MessageKey<M[K]>}`;
}[keyof M & string];

export abstract class Translator {
  abstract translate(key: string, params?: MessageParams): string;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
}

/**
 * Translator over messages in a plain object, usually a JSON file per language.
 * - `{name}` in a message is replaced by a parameter, numbers are formatted for the locale.
 * - A plural is an object such as `{ one, few, other }`, the form is chosen by the parameter `count`.
 */
export class IntlTranslator<M extends Messages = Messages> extends Translator {
  locale!: string;
  private messages!: Messages;
  private plural!: Intl.PluralRules;
  private number!: Intl.NumberFormat;

  constructor(locale: string, messages: M) {
    super();
    this.setLocale(locale, messages);
  }

  /** Switches the language. What is already rendered keeps its texts, call app.restart() afterwards. */
  setLocale(locale: string, messages: M): void {
    this.locale = locale;
    this.messages = messages;
    this.plural = new Intl.PluralRules(locale);
    this.number = new Intl.NumberFormat(locale);
  }

  /** The same as translate(), with checked keys and bound, so it can be exported as `t`. */
  readonly t = (key: MessageKey<M>, params?: MessageParams): string => this.translate(key, params);

  /** For messages that contain HTML. The message is trusted, parameters are escaped. */
  readonly html = (key: MessageKey<M>, params?: MessageParams): DocumentFragment => {
    const template = document.createElement('template');
    template.innerHTML = this.format(key, params, escapeHtml);
    return template.content;
  };

  translate(key: string, params?: MessageParams): string {
    return this.format(key, params, text => text);
  }

  private format(key: string, params: MessageParams = {}, escape: (text: string) => string): string {
    let message: string | Messages | undefined = this.messages;
    for (const part of key.split('.')) {
      message = typeof message === 'object' && Object.hasOwn(message, part) ? message[part] : undefined;
    }
    if (typeof message === 'object' && typeof message.other === 'string') {
      const form: string | Messages | undefined = message[this.plural.select(Number(params.count))];
      message = typeof form === 'string' ? form : message.other;
    }
    if (typeof message !== 'string') {
      console.warn(`Missing translation '${key}' for locale '${this.locale}'.`);
      return key;
    }
    return message.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
      const value = params[name];
      if (value === undefined) return placeholder;
      return typeof value === 'number' ? this.number.format(value) : escape(value);
    });
  }
}
