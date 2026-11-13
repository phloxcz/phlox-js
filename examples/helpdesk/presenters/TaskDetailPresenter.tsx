import { Button, Dropdown, Else, ElseIf, For, If, Presenter, batch, effect, state } from 'phlox-js';
import type { Child } from 'phlox-js';
import { Form, FormTag, Input, InputError, Label } from 'phlox-js/forms';
import { fileChunks } from 'phlox-js/net';
import { HelpdeskApi } from '../api';
import type { AttachmentResource, CommentResource, HistoryResource, Priority, Status, TaskDetail, TaskSettings } from '../api';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { Avatar, PriorityBadge, StatusLabel } from '../components/ui';
import { PRIORITY, STATUS, ago, dateTime, daysFrom, fileSize, longDate } from '../format';
import { Store } from '../model/Store';

type Tab = 'comments' | 'attachments' | 'history';

const STATUSES: Status[] = ['open', 'progress', 'closed'];
const PRIORITIES: Priority[] = ['high', 'medium', 'low'];

const EMOJIS =['👍', '🙂', '🎉', '🙏', '👀', '✅', '⚠️', '🔥'];

/**
 * The detail of a task at …/<task> and the quick actions next to it. The settings on the right save
 * themselves on every change; a comment being written keeps the user from leaving without a question.
 */
export class TaskDetailPresenter extends Presenter<{ taskId: number }> {
  readonly task = state<TaskDetail | null>(null);
  readonly comments = state<CommentResource[]>([]);
  readonly attachments = state<AttachmentResource[]>([]);
  readonly history = state<HistoryResource[]>([]);
  readonly tab = state<Tab>('comments');
  readonly uploading = state(false);

  readonly settings = new Form<TaskSettings>();
  readonly composer = new Form<{ text: string }>();
  private fileInput!: HTMLInputElement;
  private textArea: HTMLTextAreaElement | null = null;

  constructor(private api: HelpdeskApi, private store: Store) {
    super();
    // Items as objects with a template: a dot of the state, the avatar of the user, the icon of the priority
    this.settings.addDropDownList('status', 'Změnit stav', {
      items: STATUSES, itemValue: status => status, itemLabel: status => STATUS[status], template: status => <StatusLabel status={status} />,
    });
    this.settings.addDropDownList('assigneeId', 'Přiřadit uživatele', {
      items: this.store.users(), itemValue: user => user.id, itemLabel: user => user.name, placeholder: 'Nepřiřazeno',
      template: user => <span class="hd-option"><Avatar user={user} size="small" />{user.name}</span>,
    });
    this.settings.addDropDownList('priority', 'Nastavit prioritu', {
      items: PRIORITIES, itemValue: priority => priority, itemLabel: priority => PRIORITY[priority],
      template: priority => <span class={`hd-option hd-priority-text hd-priority-${priority}`}><Icon name="alert" size={17} />{PRIORITY[priority]}</span>,
    });
    this.settings.addDate('due', 'Nastavit termín');
    this.settings.onSuccess = values => this.handleSave(values);
    // Saves every change: the form is changed against the values of the last save
    effect(() => {
      if (this.settings.isChanged()) void this.settings.submit();
    });

    this.composer.addTextArea('text', 'Komentář')
      .setRequired('Napište text komentáře.')
      .addRule(Form.MaxLength, 'Komentář může mít nejvýš %d znaků.', 2000);
    this.composer.onSuccess = values => this.handleComment(values.text);
  }

  override async startup() {
    // Four calls at once, one request to the server
    const id = this.props.taskId;
    const [task, comments, attachments, history] = await Promise.all([
      this.api.call('task.read', { id }),
      this.api.call('comment.list', { taskId: id }),
      this.api.call('attachment.list', { taskId: id }),
      this.api.call('history.list', { taskId: id }),
    ]);
    batch(() => {
      this.task.set(task);
      this.comments.set(comments);
      this.attachments.set(attachments);
      this.history.set(history);
    });
    this.settings.setDefaults({ status: task.status, priority: task.priority, assigneeId: task.assigneeId, due: task.due });
  }

  override pageTitle() {
    return this.task()?.title ?? null;
  }

  /** A comment being written would be lost. */
  override hasUnsavedChanges() {
    return this.composer.isChanged();
  }

  async handleSave(input: TaskSettings): Promise<void> {
    const task = await this.api.call('task.update', { id: this.props.taskId, input });
    this.task.set(task);
    this.history.set(await this.api.call('history.list', { taskId: task.id }));
    // The lists, the counts of tabs and of the menu load again, wherever they are
    this.app.invalidate('tasks');
  }

  async handleComment(text: string): Promise<void> {
    const comment = await this.api.call('comment.create', { taskId: this.props.taskId, text });
    this.comments.update(comments => [comment, ...comments]);
    this.composer.reset();
  }

  async handleLike(comment: CommentResource): Promise<void> {
    const liked = await this.api.call('comment.like', { id: comment.id });
    this.comments.update(comments => comments.map(other => (other.id === liked.id ? liked : other)));
  }

  async handleUpload(files: File[]): Promise<void> {
    if (!files.length) return;
    this.uploading.set(true);
    try {
      for (const file of files) {
        const uploadId = crypto.randomUUID();
        for await (const chunk of fileChunks(file, 256 * 1024)) {
          await this.api.call('attachment.chunk', {
            taskId: this.props.taskId, uploadId, name: file.name, type: file.type, index: chunk.index, total: chunk.total, data: chunk.data,
          });
        }
      }
    } finally {
      this.uploading.set(false);
    }
    const [attachments, history] = await Promise.all([
      this.api.call('attachment.list', { taskId: this.props.taskId }),
      this.api.call('history.list', { taskId: this.props.taskId }),
    ]);
    batch(() => {
      this.attachments.set(attachments);
      this.history.set(history);
      this.tab.set('attachments');
    });
    this.flashMessage(files.length === 1 ? `Soubor ${files[0]!.name} je přiložený.` : `Přiloženo souborů: ${files.length}.`, 'success');
  }

  private writeComment(): void {
    this.tab.set('comments');
    queueMicrotask(() => this.textArea?.focus());
  }

  private insertEmoji(emoji: string): void {
    const text = this.composer.get('text');
    text.setValue(`${text.getValue()}${emoji}`);
    this.textArea?.focus();
  }

  render() {
    return (
      <If when={this.task}>
        {task => <>
          <section class="hd-column hd-detail" aria-labelledby="hd-task-title">
            {this.renderHeader(task)}
            <p class="hd-description">{() => task().description}</p>
            {this.renderMeta(task)}
            {this.renderTabs()}
          </section>
          {this.renderActions()}
        </>}
      </If>
    );
  }

  private renderHeader(task: () => TaskDetail): Child {
    const status = this.settings.get('status');
    return <>
      <nav class="hd-breadcrumb" aria-label="Drobečková navigace">
        <a href={() => this.link(`/projects/${task().projectId}`)}>{() => task().projectName}</a>
        <Icon name="chevronRight" size={15} />
        <span aria-current="page">{() => task().title}</span>
      </nav>
      <div class="hd-badges">
        {() => <PriorityBadge priority={task().priority} large />}
        {/* A menu, not a native <select>: its list is drawn by the browser and cannot be styled */}
        <Dropdown class={() => `hd-status-pill hd-status-${status.value()}`} panelClass="hd-menu" title="Změnit stav"
          label={<>{() => <StatusLabel status={status.value() as Status} />}<Icon name="chevronDown" size={15} /></>}>
          <For each={() => STATUSES}>
            {value => (
              <button type="button" class={() => `dropdown-item hd-menu-item ${status.value() === value ? 'active' : ''}`}
                aria-pressed={() => String(status.value() === value)} onClick={() => status.setValue(value)}>
                <StatusLabel status={value} />
              </button>
            )}
          </For>
        </Dropdown>
      </div>
      <h1 id="hd-task-title">{() => task().title}</h1>
    </>;
  }

  private renderMeta(task: () => TaskDetail): Child {
    const row = (label: string, icon: IconName, value: Child) => (
      <div class="hd-meta-row"><dt>{label}</dt><dd><Icon name={icon} size={17} />{value}</dd></div>
    );
    const due = () => task().due;
    return (
      <dl class="hd-meta">
        {row('Projekt', 'folder', <a href={() => this.link(`/projects/${task().projectId}`)}>{() => task().projectName}</a>)}
        {row('Vytvořeno', 'calendar', () => dateTime(task().created))}
        {row('Kategorie', 'tag', () => task().category)}
        {row('Aktualizováno', 'refresh', () => dateTime(task().updated))}
        <div class="hd-meta-row">
          <dt>Přiřazeno</dt>
          <dd>{() => <Avatar user={this.store.user(task().assigneeId)} size="small" />}{() => this.store.user(task().assigneeId)?.name ?? 'Nepřiřazeno'}</dd>
        </div>
        {row('Stav', 'refresh', () => <StatusLabel status={task().status} />)}
        {row('Termín', 'calendar', <>
          {() => (due() ? longDate(due()!) : 'Bez termínu')}
          <If when={() => due() !== null && task().status !== 'closed' && daysFrom(due()!) <= 0}>
            <span class="hd-urgent hd-due-note"><Icon name="clock" size={14} />{() => (daysFrom(due()!) === 0 ? '(dnes)' : '(po termínu)')}</span>
          </If>
        </>)}
        {row('Priorita', 'alert', () => PRIORITY[task().priority])}
      </dl>
    );
  }

  private renderTabs(): Child {
    const tab = (name: Tab, text: string, count: () => number) => (
      <button type="button" role="tab" aria-selected={() => String(this.tab() === name)} onClick={() => this.tab.set(name)}>
        {text} ({count})
      </button>
    );
    return <>
      <div class="hd-detail-tabs" role="tablist">
        {tab('comments', 'Komentáře', () => this.comments().length)}
        {tab('attachments', 'Přílohy', () => this.attachments().length)}
        {tab('history', 'Historie', () => this.history().length)}
      </div>
      <div class="hd-tab-panel" role="tabpanel">
        <If when={() => this.tab() === 'comments'}>
          {this.renderComments()}
        <ElseIf when={() => this.tab() === 'attachments'} />
          {this.renderAttachments()}
        <Else />
          {this.renderHistory()}
        </If>
      </div>
    </>;
  }

  private renderComments(): Child {
    const text = this.composer.get('text');
    return <>
      <If when={() => this.comments().length > 0}>
        <ul class="hd-comments">
          <For each={this.comments} key={comment => comment.id}>
            {comment => (
              <li class="hd-comment">
                {() => <Avatar user={this.store.user(comment().authorId)} size="large" />}
                <div>
                  <p class="hd-comment-head">
                    <strong>{() => this.store.user(comment().authorId)?.name}</strong>
                    <small>{() => ago(comment().created)}</small>
                  </p>
                  <p class="hd-comment-text">{() => comment().text}</p>
                  <button type="button" class={() => `hd-like ${comment().liked ? 'hd-liked' : ''}`} aria-pressed={() => String(comment().liked)}
                    onClick={() => this.handleLike(comment())}>
                    <Icon name="thumbsUp" size={14} /> {() => comment().likes || ''}
                  </button>
                </div>
              </li>
            )}
          </For>
        </ul>
      <Else />
        <p class="hd-muted">Zatím žádné komentáře.</p>
      </If>
      <FormTag form={this.composer} class="hd-composer">
        {() => <Avatar user={this.store.user(Number(this.user.getId()))} size="large" />}
        <div class="hd-composer-main">
        <div class="hd-composer-box">
          <Label control={text}>Napsat komentář</Label>
          <Input control={text} rows={1} placeholder="Napsat komentář…" ref={(element: HTMLTextAreaElement) => { this.textArea = element; }}
            onKeydown={(event: KeyboardEvent) => {
              // Enter sends, Shift+Enter makes a new line
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void this.composer.submit();
              }
            }} />
          <Dropdown class="hd-icon-button" panelClass="hd-menu hd-emojis" placement="top-right" title="Vložit emoji" label={<Icon name="smile" size={19} />}>
            <For each={() => EMOJIS}>{emoji => <button type="button" onClick={() => this.insertEmoji(emoji)}>{emoji}</button>}</For>
          </Dropdown>
          <button type="button" class="hd-icon-button" title="Přiložit soubor" aria-label="Přiložit soubor" onClick={() => this.fileInput.click()}>
            <Icon name="paperclip" size={18} />
          </button>
        </div>
        <InputError control={text} />
        </div>
        <button type="submit" class="hd-send" title="Odeslat" aria-label="Odeslat komentář" disabled={this.composer.submitting}>
          <Icon name="send" size={19} />
        </button>
      </FormTag>
    </>;
  }

  private renderAttachments(): Child {
    return (
      <If when={() => this.attachments().length > 0}>
        <ul class="hd-attachments">
          <For each={this.attachments} key={attachment => attachment.id}>
            {attachment => (
              <li>
                <Icon name="file" size={22} />
                <span>
                  <a href={() => attachment().url} download={() => attachment().name}>{() => attachment().name}</a>
                  <small>{() => `${fileSize(attachment().size)} · ${this.store.user(attachment().authorId)?.name ?? ''} · ${ago(attachment().created)}`}</small>
                </span>
                <a href={() => attachment().url} download={() => attachment().name} class="hd-icon-button" title="Stáhnout"><Icon name="download" size={18} /></a>
              </li>
            )}
          </For>
        </ul>
      <Else />
        <p class="hd-muted">Žádné přílohy.</p>
      </If>
    );
  }

  private renderHistory(): Child {
    const describe = (change: HistoryResource): string => {
      const name = (value: string | null, names: Record<string, string>) => (value === null ? '–' : names[value] ?? value);
      switch (change.field) {
        case 'created': return 'založil(a) úkol';
        case 'status': return `změnil(a) stav: ${name(change.from, STATUS)} → ${name(change.to, STATUS)}`;
        case 'priority': return `změnil(a) prioritu: ${name(change.from, PRIORITY)} → ${name(change.to, PRIORITY)}`;
        case 'assignee': return `přiřadil(a) úkol: ${change.from ?? 'nikdo'} → ${change.to ?? 'nikdo'}`;
        case 'due': return `změnil(a) termín: ${change.from ? longDate(change.from) : 'bez termínu'} → ${change.to ? longDate(change.to) : 'bez termínu'}`;
        case 'attachment': return `přiložil(a) soubor ${change.to}`;
      }
    };
    return (
      <ul class="hd-history">
        <For each={this.history} key={change => change.id}>
          {change => (
            <li>
              <Icon name="history" size={16} />
              <span><strong>{() => this.store.user(change().authorId)?.name}</strong> {() => describe(change())}</span>
              <small>{() => ago(change().created)}</small>
            </li>
          )}
        </For>
      </ul>
    );
  }

  private renderActions(): Child {
    const control = (name: keyof TaskSettings) => {
      const item = this.settings.get(name);
      return <div class="hd-field"><Label control={item} /><Input control={item} /><InputError control={item} /></div>;
    };
    const status = this.settings.get('status');
    return (
      <aside class="hd-column hd-actions" aria-labelledby="hd-actions-title">
        <h2 id="hd-actions-title">Rychlé akce</h2>
        <Button primary class="hd-button-block" onClick={() => this.writeComment()}><Icon name="message" size={18} /> Přidat komentář</Button>
        <Button class="hd-button-block hd-button-soft" disabled={this.uploading} onClick={() => this.fileInput.click()}>
          <Icon name="paperclip" size={18} /> {() => (this.uploading() ? 'Nahrávám…' : 'Přiložit soubor')}
        </Button>
        <input type="file" multiple hidden ref={input => { this.fileInput = input; }}
          onChange={event => {
            const files = [...(event.currentTarget.files ?? [])];
            event.currentTarget.value = '';
            void this.handleUpload(files);
          }} />
        <FormTag form={this.settings} class="hd-settings">
          {control('status')}
          {control('assigneeId')}
          {control('priority')}
          {control('due')}
        </FormTag>
        <Button class="hd-button-block hd-button-outline" disabled={() => status.value() === 'closed'} onClick={() => status.setValue('closed')}>
          <Icon name="check" size={18} /> {() => (status.value() === 'closed' ? 'Vyřešeno' : 'Označit jako vyřešené')}
        </Button>
      </aside>
    );
  }
}
