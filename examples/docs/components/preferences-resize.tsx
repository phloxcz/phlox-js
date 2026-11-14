import { Button, Component, ResizeHandle } from 'phlox-js';

/** Preferences remembered in the browser: the width of a column and a collapsed note. Reload the page, they stay. */
export default class Layout extends Component {
  readonly width = this.preference('docs.demo.width', 240);
  readonly collapsed = this.preference('docs.demo.collapsed', false);

  render() {
    return (
      <div style={{ display: 'flex', minHeight: '9rem', border: '1px solid #8886', borderRadius: '8px', overflow: 'hidden' }}>
        <section style={() => ({ width: `${this.width()}px`, padding: '.75rem', background: '#8881' })}>
          <strong>Seznam</strong>
          <p>Šířka {this.width} px. Táhněte za pravý okraj, nebo na něm použijte šipky.</p>
          <ResizeHandle size={this.width} min={160} max={420} initial={240} label="Šířka seznamu" />
        </section>
        <section style={{ flex: '1', padding: '.75rem' }}>
          <Button small onClick={() => this.collapsed.update(value => !value)}>
            {() => (this.collapsed() ? 'Rozbalit poznámku' : 'Sbalit poznámku')}
          </Button>
          <p hidden={this.collapsed}>Obě nastavení se uložila do localStorage a přežijí obnovení stránky.</p>
        </section>
      </div>
    );
  }
}
