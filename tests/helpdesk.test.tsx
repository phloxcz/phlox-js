/**
 * A test of a whole application, as an application would write it with phlox-js/testing:
 * the helpdesk with its real presenters and services, the API answered by its mock server in memory.
 */
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { bootApp, cleanup, until } from '../src/testing/index';
import { AppPresenter } from '../examples/helpdesk/presenters/AppPresenter';
import { createServices } from '../examples/helpdesk/services';
import { helpdeskMock } from '../examples/helpdesk/server/mock';
import { db, resetDatabase } from '../examples/helpdesk/server/methods';

beforeEach(() => {
  resetDatabase();
  sessionStorage.clear();
});
afterEach(cleanup);

const text = (element: Element, selector: string) => element.querySelector(selector)?.textContent ?? '';

describe('helpdesk', () => {
  test('sign-in, the tasks of a project, a change of state updates the tabs', async () => {
    const server = helpdeskMock();
    const { element, errors, go } = await bootApp(AppPresenter, {
      url: '/helpdesk/projects', basePath: '/helpdesk', services: createServices({ fetch: server.fetch }),
    });
    // Not signed in: the workspace sends to the sign-in
    await until(() => location.pathname === '/helpdesk/sign');
    element.querySelector<HTMLButtonElement>('.hd-sign-account')!.click();
    element.querySelector<HTMLButtonElement>('.hd-sign-card [type=submit]')!.click();
    await until(() => location.pathname === '/helpdesk/projects/1');
    await until(() => element.querySelectorAll('.hd-task').length === 24);
    expect(text(element, '#hd-tasks-title')).toBe('Úkoly – Apollo – Nová platforma');

    await go('/helpdesk/projects/1/1');
    expect(text(element, '#hd-task-title')).toBe('Optimalizace načítání dashboardu');
    expect(document.title).toContain('Optimalizace načítání dashboardu');

    // The state from the pill: saved, the list and its tabs load again by app.invalidate('tasks')
    element.querySelector<HTMLButtonElement>('.hd-status-pill')!.click();
    [...document.querySelectorAll<HTMLButtonElement>('.hd-menu .dropdown-item')].find(button => button.textContent === 'V řešení')!.click();
    await until(() => [...element.querySelectorAll('.hd-tabs a')].some(tab => tab.textContent === 'V řešení (4)'));
    expect(server.calls.map(call => call.method)).toContain('task.update');
    expect(errors).toEqual([]);
  });

  test('a comment from the editor: HTML cleaned by the server, shown by <Html>', async () => {
    const server = helpdeskMock();
    const { element, errors } = await bootApp(AppPresenter, {
      url: '/helpdesk/sign', basePath: '/helpdesk', services: createServices({ fetch: server.fetch }),
    });
    element.querySelector<HTMLButtonElement>('.hd-sign-account')!.click();
    element.querySelector<HTMLButtonElement>('.hd-sign-card [type=submit]')!.click();
    await until(() => element.querySelectorAll('.hd-task').length === 24);
    element.querySelector<HTMLElement>('.hd-task-title')!.click();
    await until(() => element.querySelector('.hd-composer [contenteditable]') !== null);
    expect(element.querySelector('.hd-comment-text ul')).not.toBeNull();

    // What the user writes; jsdom has no execCommand, so the pane changes and sends input
    const pane = element.querySelector<HTMLElement>('.hd-composer [contenteditable]')!;
    pane.innerHTML = '<p><b>Hotovo</b> u zákazníka<img src="x" onerror="alert(1)"></p>';
    pane.dispatchEvent(new Event('input', { bubbles: true }));
    pane.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));

    await until(() => element.querySelector('.hd-comment-text')!.innerHTML.includes('Hotovo'));
    expect(element.querySelector('.hd-comment-text')!.innerHTML).toBe('<p><strong>Hotovo</strong> u zákazníka<img src="x"></p>');
    expect(db.comments.at(-1)!.text).toBe('<p><strong>Hotovo</strong> u zákazníka<img src="x"></p>');
    await until(() => pane.innerHTML === '');
    expect(errors).toEqual([]);
  });

  test('offline: a prepared project works without a network, changes are sent when it is back', async () => {
    const server = helpdeskMock();
    const { element, errors, go } = await bootApp(AppPresenter, {
      url: '/helpdesk/sign', basePath: '/helpdesk', services: createServices({ fetch: server.fetch }),
    });
    element.querySelector<HTMLButtonElement>('.hd-sign-account')!.click();
    element.querySelector<HTMLButtonElement>('.hd-sign-card [type=submit]')!.click();
    await until(() => element.querySelectorAll('.hd-task').length === 24);

    // Prepare the project for offline
    element.querySelector<HTMLButtonElement>('button[title^="Připravit pro offline"]')!.click();
    await until(() => element.querySelector('.hd-offline-ready') !== null);

    window.dispatchEvent(new Event('offline'));
    await until(() => element.querySelector('.hd-offline-badge') !== null);
    // The tab Open is computed from the kept tasks, the detail comes from the kept data
    await go('/helpdesk/projects/1?status=open');
    await until(() => element.querySelectorAll('.hd-task').length === 18);
    await go('/helpdesk/projects/1/1?status=open');
    expect(text(element, '#hd-task-title')).toBe('Optimalizace načítání dashboardu');

    element.querySelector<HTMLButtonElement>('.hd-status-pill')!.click();
    [...document.querySelectorAll<HTMLButtonElement>('.hd-menu .dropdown-item')].find(button => button.textContent === 'V řešení')!.click();
    // Shown at once in the list (it left the tab Open), waiting in the header, not on the server yet
    await until(() => element.querySelectorAll('.hd-task').length === 17);
    await until(() => text(element, '.hd-offline-button').includes('1 změna'));
    expect(db.tasks.find(task => task.id === 1)!.status).toBe('open');

    window.dispatchEvent(new Event('online'));
    await until(() => db.tasks.find(task => task.id === 1)!.status === 'progress');
    await until(() => element.querySelector('.hd-offline-button') === null);
    expect(errors).toEqual([]);
  });
});
