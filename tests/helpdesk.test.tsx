/**
 * A test of a whole application, as an application would write it with phlox-js/testing:
 * the helpdesk with its real presenters and services, the API answered by its mock server in memory.
 */
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { bootApp, cleanup, until } from '../src/testing/index';
import { AppPresenter } from '../examples/helpdesk/presenters/AppPresenter';
import { createServices } from '../examples/helpdesk/services';
import { helpdeskMock } from '../examples/helpdesk/server/mock';
import { resetDatabase } from '../examples/helpdesk/server/methods';

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
});
