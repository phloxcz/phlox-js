# PhloxJS

Frontendový framework, který přenáší způsob práce z Nette do prohlížeče. Na začátku práce si přečti [docs/handoff.md](docs/handoff.md): je tam cíl, rozhodnutí a jejich důvody, plán a chyby z předchůdce TraceJS, kterým se máme vyhnout.

- S autorem komunikuj česky.
- O návrhu rozhoduje autor. Nová architektonická rozhodnutí a jejich důvody zapisuj do `docs/`.
- Udržuj příručku: je to web s ukázkami v `examples/docs` (stránky `<sekce>/<stránka>.md`, ukázky `.tsx` vedle nich, jak psát je v [docs/guide.md](docs/guide.md)). S každou změnou veřejného API ve stejném kroku uprav stránku i její ukázku. Patří tam i vysvětlení použití, která autorovi dáš v chatu. Popisuje jen to, co je napsané a otestované. Důvody návrhu patří do `docs/design.md`.
- Kód piš malý a čitelný, aby ho autor uměl opravit i bez tebe.
- Členy tříd vždy s modifikátorem viditelnosti, i `public` (jako v Nette), hlídá `npm run lint`. Dvě mezery, závorka na konci řádku.
- Sousední knihovny ekosystému jsou v `d:\Projekty\phlox\`.
- Do Tracedo (`d:\Web\abra\BDP\NEW.tracedo`) nezasahuj, slouží jen jako zdroj zkušeností.
