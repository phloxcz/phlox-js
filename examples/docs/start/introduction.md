# Úvod

PhloxJS je frontendový framework, který přenáší způsob práce z Nette do prohlížeče: presentery, komponenty, formuláře, DI s autowiringem a odkazy podle rout. Šablony se píšou v TSX a obrazovku překresluje jemná reaktivita (`state`), ne virtuální DOM.

Tato dokumentace je sama aplikace na PhloxJS. Ukázky na stránkách jsou živé: záložka Kód ukazuje přesně ten soubor, který běží. Ukázky s routami běží v rámu s vlastním adresním řádkem. Vzhled (výchozí nebo Bootstrap), světlý a tmavý režim a animace se přepínají v hlavičce. Popisuje se jen to, co je napsané a otestované. Proč je co navržené tak, jak je, je v `docs/design.md` v repozitáři.

**Kde co je:** jádro (reaktivita, šablony, komponenty, presentery, aplikace, DI) se importuje z `phlox-js`. Volitelné části mají vlastní vstup: síť (RPC) `phlox-js/net`, přihlášení a oprávnění `phlox-js/security`, formuláře `phlox-js/forms`, překlady `phlox-js/localization`, pomocníci pro testy `phlox-js/testing` a Vite plugin `phlox-js/vite`. Napojení cizích knihoven (adaptéry) jsou pod `phlox-js/adapters/…`.

Celou aplikaci proti serveru (přihlášení, RPC, vnořené presentery, `resource`, offline, PWA) ukazuje [Helpdesk](/helpdesk), odkaz je i v hlavičce. Jeho kód je v `examples/helpdesk`.

## Instalace

```bash
npm install github:phloxcz/phlox-js#v0.1.0
```

Balíček zatím není na npm, instaluje se z GitHubu podle tagu. Projekt potřebuje Vite (od verze 7) s pluginem `phlox()` a v `tsconfig.json` `"jsx": "react-jsx"`, `"jsxImportSource": "phlox-js"` a `"moduleResolution": "Bundler"` (viz Aplikace a bootstrap). Styly: `import 'phlox-js/styles/base.css'` a k nim `phlox-js/styles/default.css`, nebo Bootstrap.

## Spuštění tohoto repozitáře

| Příkaz | Co dělá |
|---|---|
| `npm run dev` | spustí tuto dokumentaci na `/` a helpdesk na `/helpdesk`. Helpdesk má mock JSON-RPC server v dev serveru (`examples/helpdesk/server/`), účty jsou na přihlašovací stránce |
| `npm run build:examples` | sestaví dokumentaci a helpdesk do `examples/dist`; `npx vite preview --config examples/vite.config.ts` je spustí i s mock serverem |
| `npm test` | spustí testy |
| `npm run typecheck` | zkontroluje typy |

## Jak se pojmy z Nette jmenují tady

| Nette | PhloxJS |
|---|---|
| `Bootstrap`, `Application` | `new Application(services).run(...)` |
| `services` v `config.neon` | `new Container().add(...)` v `services.ts` |
| autowiring konstruktoru | stejně, zařídí ho Vite plugin `phlox()` |
| `Presenter` | `Presenter` |
| `Control`, `createComponentXxx()` | `Component`, v šabloně `<UserList />` |
| `startup()`, `actionXxx()`, `handleXxx()` | stejně |
| `renderXxx()` a Latte šablona | `render()` vrací TSX |
| `{if}`, `{foreach}` | `<If>`, `<For>` |
| `link()`, `n:href`, `redirect()`, `error()`, `flashMessage()` | stejně |
| `Translator`, `{_'klíč'}` | `Translator`, `t('klíč')` |
| `$this->user`, `User`, `SimpleIdentity` | `this.user`, `User`, `Identity` |
| `Authenticator`, `Authorizator`, `Permission` | stejně |
| volání API kontroleru z `phlox-rpc-api` | `await this.api.call('user.read', { id })` |
| `Nette\Forms\Form`, `addText()`, `addRule()`, `onSuccess` | stejně, `new Form<Dto>()` |
| `{form}`, `{label}`, `{input}`, `{inputError}`, `{control form}` | `<FormTag>`, `<Label>`, `<Input>`, `<InputError>`, `<FormView>` |

**Hlavní rozdíl:** v Nette žije presenter jeden požadavek. Tady žije, dokud je na obrazovce, a obrazovku tvoří strom presenterů, mezi které se dělí URL.
