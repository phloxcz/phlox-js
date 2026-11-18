# Služby a DI

Služby se registrují na jednom místě, jako v `config.neon`:

```ts
// services.ts
export const services = new Container()
  .add(UserApi, AppAuthorizator)            // třída: vytvoří se, až ji někdo potřebuje
  .add(new AppConfig({ apiUrl: '/api' }))   // hotová instance
  .use(rpcExtension);                       // rozšíření: funkce, která přidá své služby
```

Kdo službu potřebuje, napíše si ji do konstruktoru. Platí to pro služby, presentery i komponenty:

```ts
class UsersPresenter extends Presenter {
  public constructor(private api: UserApi, private auth: Authorizator) {
    super();
  }
}
```

<!-- demo: services-di -->

- **Služba se hledá podle typu,** i podle abstraktního předka. `Authorizator` výše najde zaregistrovaný `AppAuthorizator`. Když typu nevyhovuje žádná služba nebo jich vyhovuje víc, je to chyba.
- **Presentery a komponenty se neregistrují,** vytváří je framework.
- **Kontraktem je abstraktní třída, ne `interface`.** Rozhraní za běhu neexistují, takže podle nich hledat nejde.
- **Čísla a texty do konstruktoru nepatří.** Nastavení zabal do služby, třeba `AppConfig`.
- **Generika se nerozliší:** `Repo<User>` a `Repo<Task>` jsou za běhu stejná třída.

Bez pluginu jde závislosti zapsat ručně: `static $inject = () => [UserApi, Authorizator];`.
