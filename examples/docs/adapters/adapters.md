# Napojení jiných knihoven

Části, které jdou vyměnit, jsou služby v kontejneru. Adaptér je třída, která službu nahradí: zaregistruješ ji v `services.ts` a framework ji použije místo výchozí. Presentery a komponenty se nemění.

| Služba | Výchozí | K čemu adaptér |
|---|---|---|
| `FlashMessages` | zprávy pro layout, s časovačem | `CapifyFlashMessages` (`phlox-js/adapters/capify`), jiná knihovna toastů |
| `Dialogs` | nativní `<dialog>` | `KendoDialogs` (Kendo Window), okna jiné knihovny |
| `Theme` | výchozí třídy `phlox-*` | `BootstrapTheme`, jiný CSS framework |
| `Translator` | `IntlTranslator` | i18next nebo jiný překladač |
| `UserStorage` | `sessionStorage` | `localStorage`, cookies |
| `Preferences` | `localStorage` (`BrowserPreferences`) | nastavení uživatele na serveru |
| `Authenticator`, `Authorizator` | žádný, chyba při použití | přihlášení a oprávnění aplikace |
| `FormControl` | prvky formulářů | widgety jiné knihovny jako prvky formuláře |

Vlastní adaptér pro jinou knihovnu toastů:

```ts
class ToastifyFlashMessages extends FlashMessages {
  override add(text: string, type = 'info', options: FlashOptions = {}): Flash {
    const duration = options.duration ?? this.duration;
    Toastify({ text, className: type, duration }).showToast();
    return { text, type, duration };
  }
}

services.add(ToastifyFlashMessages);
```

<!-- demo: adapter-flashes -->

Adaptér, který knihovnu dostane v konstruktoru (jako `CapifyFlashMessages`), nemá na knihovnu závislost a dá se otestovat s falešnou náhradou.
