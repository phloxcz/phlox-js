# Akce, parametry a odkazy

- **Parametry jsou texty:** `actionDetail({ id })` dostane `'15'`, na číslo si ho převeď.
- **Query parametry** (`?page=2`) dostane presenter na konci řetězu, tedy ten, jehož routa nemá `presenter`. Parametr routy má při stejném názvu přednost. Své persistentní parametry (viz níže) dostane presenter i uprostřed řetězu.
- **Ve `startup()` presenter už zná** své `route()`, `params()` a `basePath()`, jako v Nette.
- **Akce běží,** když se změní routa nebo její parametry. Když zůstanou stejné, presenter i jeho stav zůstávají.
- **Presenter pod routou se vytvoří znovu,** když se změní parametry routy nad ním. Přechod z `/users/5/orders` na `/users/6/orders` tedy vytvoří nový `UserDetailPresenter`.
- **`this.route()` a `this.params()`** jsou `state` s aktuální routou a parametry, jdou použít v šabloně.
- **Co má být načtené vždy, patří do `startup()`,** ne do akce. Akce jiné routy se při přímém odkazu nespustí.

## Odkazy a přesměrování

```tsx
this.link('detail', { id: 5 })            // /users/5: routa tohoto presenteru
this.link('detail', { id: 5, tab: 'a' })  // /users/5?tab=a: co není v routě, jde do query
this.link('this', { page: 2 })            // aktuální URL se změněným query, null parametr odebere
this.link('/about')                       // absolutní cesta

<a href={this.link('detail', { id: user.id })}>{user.name}</a>
```

Odkaz je obyčejné `<a href>`. Kliknutí zachytí aplikace a přejde bez načtení stránky, otevření v novém panelu funguje normálně. Odkaz s `target` nebo `download`, odkaz na jiný web a odkaz mimo `app.basePath` nechá prohlížeči.

`link('název')` zná jen routy vlastního presenteru. Do hlubší úrovně vede absolutní cesta, nebo `link()` zavolaný na cílovém presenteru.

```ts
async handleDelete(id: number) {
  await this.api.delete(id);
  this.flashMessage('Smazáno.');
  this.redirect('this');          // znovu spustí akci, i když se URL nezměnila
}

actionOld() {
  return this.redirect('users');  // rozdíl proti Nette: redirect metodu neukončí, napiš return
}
```

<!-- demo: actions-links -->

- **`this.error(404)`** ukončí akci chybou `BadRequestError`, dostane ji `app.onError`.
- **Neznámá URL** zavolá `notFound(path)` na presenteru, kde hledání skončilo. Výchozí chování je `error(404)`. Přepiš ji, pokud chceš ukázat vlastní stránku nebo přesměrovat.
- **`app.router.navigate('/users')`** přejde na URL z kódu mimo presenter.
