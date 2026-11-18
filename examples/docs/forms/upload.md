# Soubory

Drop zóna s tlačítkem a tabulka vybraných souborů, vzhled převzatý z [phloxcz/components-upload](https://github.com/phloxcz/components-upload). **Nic se nenahrává:** hodnotou jsou objekty `File` a co s nimi, rozhodne `onSuccess`. Jako v Nette, kde `addUpload()` předá `FileUpload` a uložení je na presenteru.

```ts
// Typ formuláře, ne vygenerované DTO: to typ File nemá
interface ArticleInput { title: string; cover: File | null; attachments: File[] }

this.form.addUpload('cover', 'Obrázek:')
  .addRule(Form.Image, 'Jen obrázek.')
  .addRule(Form.MaxFileSize, 'Nejvýš 5 MB.', 5 * 1024 * 1024);
this.form.addMultiUpload('attachments', 'Přílohy:')
  .addRule(Form.MaxLength, 'Nejvýš %d souborů.', 10);

this.form.onSuccess = async values => {
  const id = await this.api.call('article.create', { input: { title: values.title } });
  // Přes RPC po částech v base64 (viz Soubory přes RPC)...
  for (const file of values.attachments) {
    for await (const chunk of fileChunks(file)) {
      await this.api.call('article.attachmentChunk', { id, name: file.name, ...chunk });
    }
  }
  // ...nebo proudem do REST API
  if (values.cover) await fetch(`/api/articles/${id}/cover`, { method: 'PUT', body: values.cover });
};
```

<!-- demo: upload-files -->

- **Hodnota:** `addUpload` dává `File` nebo `null`, `addMultiUpload` `File[]`. Kompilátor dovolí `addUpload` jen na pole typu `File | null` a `addMultiUpload` jen na `File[]`. Formulář s uploadem má proto vlastní typ, ze kterého obsluha sestaví volání API.
- **Výběr:** klik na zónu nebo tlačítko, Enter nebo mezerník na zóně, klik na popisek, přetažení souborů na zónu. U jednoho souboru nový výběr nahradí starý. U více souborů se přidávají a stejný soubor (název, velikost, datum změny) se nepřidá dvakrát.
- **Seznam:** název (dlouhý se zkrátí), velikost, u obrázků náhled, křížek pro odebrání.
- **Pravidla** se kontrolují hned po výběru. `MaxFileSize` (v bajtech), `MimeType` (`'application/pdf'`, `['text/plain', 'image/*']`) a `Image` (JPEG, GIF, PNG, WebP, AVIF jako v Nette) platí pro každý soubor a soubor, který je porušuje, se v seznamu označí. Počet souborů hlídají `MinLength`, `MaxLength` a `Length`, povinnost `setRequired()`.
- **Atribut `accept`** se doplní z pravidel `MimeType` a `Image`, takže dialog prohlížeče rovnou nabídne jen vhodné soubory. Pravidla platí dál, přetažený soubor `accept` neomezí.
- **`setValue()`** a `reset()` fungují jako u jiných prvků. Soubory přidá i kód: `control.addFiles(files)`.
- **Existující soubory** záznamu (už uložené přílohy) upload neukazuje, vykresli je zvlášť.
- **Texty:** `UploadControl.texts.headingMultiple` a `headingSingle` (nadpis zóny, „Přetáhněte soubory sem“ / „Přetáhněte soubor sem“), `or`, `browseMultiple`, `browseSingle`, `dropzoneMultiple` a `dropzoneSingle` (popis zóny pro čtečky), `remove` (`%s` je název souboru). **Vzhled:** místa `upload.dropzone`, `upload.dropzoneIdle`, `upload.dropzoneActive`, `upload.button`, `upload.table`, `upload.row`, `upload.rowError`, `upload.cellName`, `upload.cellSize`, `upload.cellRemove`, `upload.remove`. Třídy `pu-*` z PHP knihovny jsou v každém tématu.
- **Velikost** pro lidi: `formatFileSize(3_400_000)` vrátí `3.2 MB`.
