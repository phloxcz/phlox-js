import { For, Presenter, computed, state } from 'phlox-js';
import { HelpdeskApi } from '../api';
import type { ReportRow } from '../api';

/** Tasks of projects by state at /reports. Loaded lazily with the first visit, see the route in WorkspacePresenter. */
export default class ReportsPresenter extends Presenter {
  readonly rows = state<ReportRow[]>([]);
  readonly totals = computed(() => this.rows().reduce(
    (sum, row) => ({ open: sum.open + row.open, progress: sum.progress + row.progress, closed: sum.closed + row.closed, overdue: sum.overdue + row.overdue }),
    { open: 0, progress: 0, closed: 0, overdue: 0 },
  ));

  constructor(private api: HelpdeskApi) {
    super();
  }

  override pageTitle() {
    return 'Reporty';
  }

  override async startup() {
    this.rows.set(await this.api.call('report.projects'));
  }

  render() {
    const card = (text: string, value: () => number, kind: string) => (
      <div class={`hd-stat hd-stat-${kind}`}><span>{text}</span><strong>{value}</strong></div>
    );
    return (
      <section class="hd-column hd-page" aria-labelledby="hd-reports-title">
        <h1 id="hd-reports-title">Reporty</h1>
        <div class="hd-stats">
          {card('Otevřené', () => this.totals().open, 'open')}
          {card('V řešení', () => this.totals().progress, 'progress')}
          {card('Uzavřené', () => this.totals().closed, 'closed')}
          {card('Po termínu', () => this.totals().overdue, 'overdue')}
        </div>
        <table class="hd-report">
          <thead><tr><th>Projekt</th><th>Úkoly podle stavu</th><th>Otevřené</th><th>V řešení</th><th>Uzavřené</th><th>Po termínu</th></tr></thead>
          <tbody>
            <For each={this.rows} key={row => row.projectId}>
              {row => {
                const total = () => Math.max(1, row().open + row().progress + row().closed);
                const part = (count: number) => ({ width: `${(count / total()) * 100}%` });
                return (
                  <tr>
                    <th scope="row">
                      <a href={() => this.link(`/projects/${row().projectId}`)}>
                        <span class="hd-project-dot" style={() => ({ color: row().color })} />{() => row().name}
                      </a>
                    </th>
                    <td>
                      <div class="hd-bar" role="img" aria-label={() => `${row().open} otevřených, ${row().progress} v řešení, ${row().closed} uzavřených`}>
                        <span class="hd-status-open" style={() => part(row().open)} />
                        <span class="hd-status-progress" style={() => part(row().progress)} />
                        <span class="hd-status-closed" style={() => part(row().closed)} />
                      </div>
                    </td>
                    <td>{() => row().open}</td>
                    <td>{() => row().progress}</td>
                    <td>{() => row().closed}</td>
                    <td class={() => (row().overdue ? 'hd-urgent' : '')}>{() => row().overdue}</td>
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
      </section>
    );
  }
}
