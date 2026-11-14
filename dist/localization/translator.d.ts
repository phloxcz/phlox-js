/** Translations. Translator is the contract, like Nette\Localization\Translator, IntlTranslator is the default. */
export type MessageParams = Record<string, string | number>;
/** A text, a plural (an object with `other` and the forms of the language) or a group of messages. */
export interface Messages {
    [key: string]: string | Messages;
}
/** Keys of all messages as `group.name`. A typo in a key becomes a compile error. */
export type MessageKey<M> = string extends keyof M ? string : {
    [K in keyof M & string]: M[K] extends string | {
        other: string;
    } ? K : `${K}.${MessageKey<M[K]>}`;
}[keyof M & string];
export declare abstract class Translator {
    abstract translate(key: string, params?: MessageParams): string;
}
/**
 * Translator over messages in a plain object, usually a JSON file per language.
 * - `{name}` in a message is replaced by a parameter, numbers are formatted for the locale.
 * - A plural is an object such as `{ one, few, other }`, the form is chosen by the parameter `count`.
 */
export declare class IntlTranslator<M extends Messages = Messages> extends Translator {
    locale: string;
    private messages;
    private plural;
    private number;
    constructor(locale: string, messages: M);
    /** Switches the language. What is already rendered keeps its texts, call app.restart() afterwards. */
    setLocale(locale: string, messages: M): void;
    /** The same as translate(), with checked keys and bound, so it can be exported as `t`. */
    readonly t: (key: MessageKey<M>, params?: MessageParams) => string;
    /** For messages that contain HTML. The message is trusted, parameters are escaped. */
    readonly html: (key: MessageKey<M>, params?: MessageParams) => DocumentFragment;
    translate(key: string, params?: MessageParams): string;
    private format;
}
