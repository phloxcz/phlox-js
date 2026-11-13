// Data of the mock server: the same on every start, dates relative to today. They live in memory only.
import { Buffer } from 'node:buffer';
import type {
  AttachmentResource, CommentResource, HistoryResource, NotificationResource, Priority, ProjectResource,
  Status, TaskDetail, UserResource,
} from '../api.ts';

export interface Database {
  users: (UserResource & { password: string })[];
  projects: Omit<ProjectResource, 'taskCount'>[];
  tasks: Omit<TaskDetail, 'projectName' | 'commentCount' | 'attachmentCount'>[];
  comments: (Omit<CommentResource, 'likes' | 'liked'> & { likedBy: number[] })[];
  attachments: (Omit<AttachmentResource, 'url'> & { content: Buffer })[];
  history: HistoryResource[];
  notifications: (NotificationResource & { userId: number })[];
  lastId: number;
}

const DAY = 86_400_000;

/** A day relative to today as YYYY-MM-DD. */
export function day(offset: number): string {
  const date = new Date(Date.now() + offset * DAY);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** A moment relative to today, `at(-1, 17, 12)` is yesterday at 17:12. */
export function at(offset: number, hours: number, minutes = 0): string {
  const date = new Date(Date.now() + offset * DAY);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

const USERS: [string, string, string][] = [
  ['Lucie Dvořáková', 'Projektová manažerka', '#0f766e'],
  ['Jan Novák', 'Backend vývojář', '#1d4ed8'],
  ['Petra Svobodová', 'Testerka', '#b45309'],
  ['Tomáš Král', 'Frontend vývojář', '#7c3aed'],
  ['Eva Malá', 'DevOps', '#be123c'],
  ['Martin Černý', 'Analytik', '#4d7c0f'],
];

const PROJECTS: [string, string, string][] = [
  ['Apollo – Nová platforma', 'Vývoj a nasazení', '#1ba3b2'],
  ['Datové centrum', 'Infrastruktura', '#2563eb'],
  ['Marketing 2026', 'Kampaň a obsah', '#f59e0b'],
  ['Interní nástroje', 'Produktivita', '#ef4444'],
  ['Klient ABC', 'Implementace', '#0e95a8'],
  ['Bezpečnostní audit', 'Audit a compliance', '#eab308'],
  ['Roadmapa Q1', 'Plánování', '#1d4ed8'],
];

/** Tasks of Apollo as in the design: title, priority, assignee, due in days from today. */
const APOLLO: [string, Priority, number, number][] = [
  ['Optimalizace načítání dashboardu', 'high', 2, 0],
  ['Doplnit export do PDF', 'medium', 3, 0],
  ['Oprava chyby v notifikacích', 'low', 1, 1],
  ['Přidat filtr dle oddělení', 'medium', 3, 1],
  ['Aktualizace uživatelských práv', 'high', 2, 2],
  ['Testování nové verze API', 'medium', 3, 2],
  ['Vytvořit dokumentaci k API', 'low', 4, 3],
  ['Zkontrolovat logy z produkce', 'medium', 1, 3],
  ['Přidat podporu pro mobilní aplikaci', 'low', 6, 6],
  ['Nastavení zálohování databáze', 'high', 5, 6],
];

const TITLES: Record<number, string[]> = {
  1: ['Refaktoring přihlašování', 'Migrace na nový build', 'Zrychlit hledání', 'Ošetřit vypršení session', 'Upravit e-mailové šablony',
    'Sjednotit formát dat', 'Audit závislostí', 'Přidat tmavý režim', 'Opravit stránkování', 'Logování chyb na klientu',
    'Revize oprávnění API', 'Cache pro reporty', 'Nasazení na stage', 'Úklid starých migrací'],
  2: ['Výměna disků v poli A', 'Aktualizace firmwaru switchů', 'Monitoring teploty', 'Záloha konfigurace routerů', 'Nový VLAN pro hosty',
    'Test záložního zdroje', 'Inventura serverů', 'Obnova certifikátů', 'Kapacitní plán na příští rok', 'Dokumentace kabeláže',
    'Výpadek NAS – analýza', 'Nastavit alerting', 'Přesun racku R4', 'Kontrola UPS', 'Upgrade hypervisorů', 'Revize přístupů', 'Test obnovy ze zálohy'],
  3: ['Podzimní kampaň – briefing', 'Texty na landing page', 'Bannery pro sociální sítě', 'Newsletter listopad', 'Případová studie Klient ABC',
    'Fotky produktu', 'Plán příspěvků na prosinec', 'Video s ukázkou', 'Překlad webu do angličtiny', 'SEO audit', 'Webinář – pozvánky', 'Vyhodnocení kampaně'],
  4: ['Šablona pro reporty', 'Bot na připomínky', 'Sdílený kalendář směn', 'Import docházky', 'Wiki – struktura', 'Formulář pro nákupy',
    'Automatizace faktur', 'Přehled licencí', 'Onboarding checklist'],
  5: ['Úvodní workshop', 'Analýza požadavků', 'Nastavení prostředí', 'Import zákaznických dat', 'Školení uživatelů', 'Integrace s ERP',
    'Úprava tiskových sestav', 'Akceptační testy', 'Předávací protokol', 'Podpora po spuštění', 'Napojení SSO', 'Exporty do účetnictví',
    'Úprava workflow schvalování', 'Měsíční report pro klienta'],
  6: ['Penetrační test webu', 'Revize hesel', 'Politika záloh', 'Školení phishing', 'Kontrola logů přístupu', 'Šifrování disků notebooků', 'Zpráva pro vedení'],
  7: ['Priority na Q1', 'Odhad kapacit týmů', 'Rozpočet projektu Apollo', 'Termíny vydání', 'Rizika a závislosti', 'Prezentace pro vedení'],
};

const CATEGORIES = ['Vývoj', 'Infrastruktura', 'Obsah', 'Podpora', 'Dokumentace'];

const PARAGRAPHS = [
  'Prosím o kontrolu a návrh dalšího postupu. Podklady jsou v přílohách.',
  'Úkol vyplynul z poslední porady. Termín je pevný kvůli navazujícím pracím.',
  'Zákazník se ozval podruhé, prosím o prioritní řešení.',
  'Navazuje na předchozí úkol, detaily v komentářích.',
];

export function seed(): Database {
  let random = 11;
  const next = () => (random = (random * 16807) % 2147483647) / 2147483647;
  const pick = <T,>(list: T[]): T => list[Math.floor(next() * list.length)]!;
  let id = 0;
  const db: Database = { users: [], projects: [], tasks: [], comments: [], attachments: [], history: [], notifications: [], lastId: 0 };

  USERS.forEach(([name, title, color], index) => {
    const login = name.split(' ')[0]!.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    db.users.push({ id: index + 1, name, title, color, email: `${login}@helpdesk.cz`, password: 'demo' });
  });
  PROJECTS.forEach(([name, subtitle, color], index) => db.projects.push({ id: index + 1, name, subtitle, color }));

  const task = (projectId: number, title: string, priority: Priority, assigneeId: number | null, due: number | null, status: Status) => {
    const created = at(-Math.floor(next() * 20) - 2, 8 + Math.floor(next() * 9), Math.floor(next() * 60));
    db.tasks.push({
      id: ++id, projectId, title, priority, assigneeId, status, due: due === null ? null : day(due),
      description: pick(PARAGRAPHS), category: projectId === 3 ? 'Obsah' : projectId === 2 ? 'Infrastruktura' : pick(CATEGORIES),
      created, updated: created,
    });
    // Changes are numbered on their own, so that tasks have the numbers 1, 2, 3...
    db.history.push({ id: 10_000 + db.history.length, taskId: id, authorId: 1, field: 'created', from: null, to: null, created });
    return db.tasks.at(-1)!;
  };

  // Apollo: the ten tasks of the design and more, 18 open, 3 in progress, 3 closed
  for (const [title, priority, assignee, due] of APOLLO) task(1, title, priority, assignee, due, 'open');
  TITLES[1]!.forEach((title, index) => {
    const status: Status = index < 8 ? 'open' : index < 11 ? 'progress' : 'closed';
    task(1, title, pick<Priority>(['low', 'medium', 'high']), pick([1, 1, 2, 3, 4, 5, 6]), Math.floor(next() * 30) - 5, status);
  });
  for (let project = 2; project <= 7; project++) {
    for (const title of TITLES[project]!) {
      const status = pick<Status>(['open', 'open', 'open', 'progress', 'closed']);
      task(project, title, pick<Priority>(['low', 'medium', 'medium', 'high']), pick([1, 2, 3, 4, 5, 6, null]), Math.floor(next() * 40) - 8, status);
    }
  }

  // The task of the design with its description, comments and attachments
  const first = db.tasks[0]!;
  first.description = 'Dashboard se u některých uživatelů načítá déle než 10 sekund. Prosím prověřte výkon a navrhněte řešení '
    + '(např. optimalizace dotazů nebo cache).';
  first.category = 'Vývoj';
  first.created = at(-1, 14, 32);
  first.updated = at(0, 16, 20);
  db.history.find(change => change.taskId === first.id)!.created = first.created;
  db.comments.push(
    { id: ++id, taskId: first.id, authorId: 3, text: 'Díky, čekáme na další update.', created: at(-1, 17, 12), likedBy: [] },
    { id: ++id, taskId: first.id, authorId: 2, text: 'Dodám logy z produkce, jakmile je budu mít k dispozici.', created: at(0, 15, 45), likedBy: [3] },
    { id: ++id, taskId: first.id, authorId: 1, text: 'Problém potvrzen i na testovacím prostředí. Pracuji na analýze možných příčin.', created: at(0, 16, 20), likedBy: [2] },
  );
  const har = Buffer.from('{"log":{"version":"1.2","entries":[]}}');
  const notes = Buffer.from('Měření načítání dashboardu\n\n/api/stats  8,4 s\n/api/tasks  2,1 s\n');
  db.attachments.push(
    { id: ++id, taskId: first.id, authorId: 2, name: 'profil-dashboard.har', type: 'application/json', size: har.length, content: har, created: at(-1, 15, 2) },
    { id: ++id, taskId: first.id, authorId: 1, name: 'mereni-nacitani.txt', type: 'text/plain', size: notes.length, content: notes, created: at(0, 9, 40) },
  );
  db.history.push(
    { id: ++id, taskId: first.id, authorId: 1, field: 'priority', from: 'medium', to: 'high', created: at(-1, 15, 10) },
    { id: ++id, taskId: first.id, authorId: 1, field: 'assignee', from: 'Lucie Dvořáková', to: 'Jan Novák', created: at(0, 9, 5) },
  );

  db.notifications.push(
    { id: ++id, userId: 1, taskId: first.id, projectId: 1, text: 'Jan Novák přidal komentář k úkolu Optimalizace načítání dashboardu', created: at(0, 15, 45), read: false },
    { id: ++id, userId: 1, taskId: 3, projectId: 1, text: 'Byl vám přiřazen úkol Oprava chyby v notifikacích', created: at(0, 11, 30), read: false },
    { id: ++id, userId: 1, taskId: 8, projectId: 1, text: 'Úkol Zkontrolovat logy z produkce má termín za 3 dny', created: at(0, 8, 0), read: false },
    { id: ++id, userId: 1, taskId: 2, projectId: 1, text: 'Petra Svobodová změnila prioritu úkolu Doplnit export do PDF', created: at(-1, 13, 20), read: true },
  );
  db.lastId = 10_000 + db.history.length;
  return db;
}
