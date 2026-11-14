# Uživatel a oprávnění

Jako `Nette\Security`: `User`, `Identity`, `Authenticator`, `Authorizator` a `Permission`. Importuje se z `@phloxcz/phlox-js/security`.

**Oprávnění v prohlížeči jen řídí, co se zobrazí.** Skutečnou kontrolu musí udělat server (`#[Authorize]` v `phlox-rpc-api`), protože kód v prohlížeči si uživatel může změnit.

## Přihlášení

`Authenticator` ověří jméno a heslo, typicky voláním API, a vrátí `Identity`:

```ts
class ApiAuthenticator extends Authenticator {
  constructor(private api: RpcApi) {
    super();
  }

  async authenticate(username: string, password: string): Promise<Identity> {
    const result = await this.api.call('sign.in', { username, password });
    return new Identity(result.id, result.roles, { name: result.name }, result.token);
  }
}

services.add(ApiAuthenticator);
```

```ts
await this.user.login(username, password);   // Authenticator, při chybě vyhodí výjimku
await this.user.login(identity);             // přímo, třeba po registraci
this.user.logout();
```

- **`Identity(id, roles, data, token)`** odpovídá `SimpleIdentity`. Navíc má `token`, kterým se prohlížeč prokazuje serveru. Pro hlavičku `Authorization` je dostupný jako `this.user.token`.
- **Identita přežije obnovení stránky,** ukládá se do `sessionStorage`. Zavřením panelu se zapomene. Jiné úložiště: zaregistruj vlastní `UserStorage`, nebo `new BrowserUserStorage('klíč', () => localStorage)`.
- **`this.user`** je dostupný v každé komponentě a presenteru, jinde přes DI: `constructor(private user: User)`.

## Role a oprávnění

```ts
const acl = new Permission()
  .addRole('guest')
  .addRole('authenticated', 'guest')
  .addRole('admin', 'authenticated')
  .addResource('task')
  .allow('guest', 'task', 'view')
  .allow('authenticated', 'task', ['add', 'edit'])
  .allow('admin');                      // všechno

services.add(acl);
```

```ts
this.user.isLoggedIn()
this.user.isInRole('admin')
this.user.isAllowed('task', 'edit')
this.user.getIdentity()?.data.name
```

- **Role:** nepřihlášený má roli `guest`. Přihlášený bez rolí v identitě má `authenticated`. Názvy jdou změnit přes `user.guestRole` a `user.authenticatedRole`.
- **Pravidla jsou jako v Nette:** `null` znamená všechny role, zdroje nebo privilegia. Role a zdroje dědí od rodičů a konkrétnější pravidlo vyhrává. Když role dědí od více rodičů a jejich pravidla si odporují, platí to od rodiče uvedeného později. Bez pravidla je odpověď ne.
- **Podmínka u pravidla:** `allow('author', 'article', 'edit', () => article.authorId === user.getId())`.
- **Vlastní `Authorizator`:** stačí třída s metodou `isAllowed(role, resource, privilege)`, zaregistrovaná v kontejneru.

## V šabloně

Metody `User` čtou `state`, takže se šablona po přihlášení i odhlášení aktualizuje sama:

```tsx
<If when={() => this.user.isAllowed('task', 'delete')}>
  <button onClick={() => this.handleDelete()}>Smazat</button>
</If>
```

## Chráněný presenter

Jako v Nette se kontroluje ve `startup()`:

```ts
class AdminPresenter extends Presenter {
  override startup() {
    if (!this.user.isLoggedIn()) return this.redirect('/sign/in');
    if (!this.user.isInRole('admin')) this.error(403);
  }
}
```

Přesměrování ze `startup()` nebo akce zastaví celou navigaci, takže chráněná obrazovka se neobjeví ani na okamžik.

<!-- demo: user-roles -->

Po přihlášení nebo odhlášení přesměruj (`this.redirect(...)`) nebo zavolej `this.app.restart()`, aby se obrazovky postavily znovu pro nového uživatele.
