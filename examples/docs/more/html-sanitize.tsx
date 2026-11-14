import { Component, Html, computed, sanitizeHtml, state } from '@phloxcz/phlox-js';

const SAMPLE = '<p onclick="steal()">Ahoj <strong>světe</strong>, <a href="javascript:alert(1)">klikni</a>.</p>\n'
  + '<img src="x" onerror="alert(2)">\n<script>alert(3)</script>\n<p style="color: crimson; position: fixed; top: 0">Červený text</p>';

/** HTML written by a user, cleaned: what stays and what is dropped. */
export default class Sanitize extends Component {
  readonly html = state(SAMPLE);
  readonly clean = computed(() => sanitizeHtml(this.html()));

  render() {
    return (
      <div style={{ display: 'grid', gap: '.75rem' }}>
        <label>
          HTML od uživatele
          <textarea rows={5} style={{ display: 'block', width: '100%', fontFamily: 'monospace' }} value={this.html}
            onInput={event => this.html.set(event.currentTarget.value)} />
        </label>
        <div>
          <small>sanitizeHtml():</small>
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{this.clean}</pre>
        </div>
        <div>
          <small>&lt;Html html=…&gt;:</small>
          <Html html={this.html} />
        </div>
      </div>
    );
  }
}
