// Tiny runtime for the MeQuest design templates.
// Supports {{ path }} bindings, <sc-if value>, <sc-for list as>, and
// onClick / onChange / onSubmit handlers. Re-renders with morphdom.
(function () {
  const RE = /\{\{\s*([\w.$]+)\s*\}\}/g;
  const ONLY = /^\{\{\s*([\w.$]+)\s*\}\}$/;
  const EVENTS = { onclick: 'click', onchange: 'change', onsubmit: 'submit', oninput: 'input' };

  function lookup(scope, path) {
    const parts = path.split('.');
    let v;
    for (let i = scope.length - 1; i >= 0; i--) {
      if (scope[i] && Object.prototype.hasOwnProperty.call(scope[i], parts[0])) { v = scope[i][parts[0]]; break; }
    }
    for (let j = 1; j < parts.length && v != null; j++) v = v[parts[j]];
    return v;
  }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const VOID = { area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, link: 1, meta: 1, source: 1, track: 1, wbr: 1, path: 0 };

  function renderNodes(nodes, scope, ctx) {
    let out = '';
    for (const n of nodes) out += renderNode(n, scope, ctx);
    return out;
  }

  function renderNode(n, scope, ctx) {
    if (n.nodeType === 3) return esc(n.nodeValue.replace(RE, (_, p) => { const v = lookup(scope, p); return v == null ? '' : v; })).replace(/&amp;(#?\w+;)/g, '&$1');
    if (n.nodeType !== 1) return '';
    const tag = n.tagName.toLowerCase();
    if (tag === 'sc-if') {
      const m = (n.getAttribute('value') || '').match(ONLY);
      return m && lookup(scope, m[1]) ? renderNodes(n.childNodes, scope, ctx) : '';
    }
    if (tag === 'sc-for') {
      const m = (n.getAttribute('list') || '').match(ONLY);
      const list = (m && lookup(scope, m[1])) || [];
      const as = n.getAttribute('as') || 'item';
      let out = '';
      list.forEach((item, i) => { out += renderNodes(n.childNodes, scope.concat([{ [as]: item, $index: i }]), ctx); });
      return out;
    }
    let attrs = '';
    for (const a of Array.from(n.attributes)) {
      const name = a.name.toLowerCase();
      if (name.startsWith('hint-')) continue;
      if (EVENTS[name]) {
        const m = a.value.match(ONLY);
        const fn = m && lookup(scope, m[1]);
        if (typeof fn === 'function') {
          const id = ctx.handlers.push(fn) - 1;
          attrs += ' data-mq-' + EVENTS[name] + '="' + id + '"';
        }
        continue;
      }
      const full = a.value.match(ONLY);
      if (full) {
        const v = lookup(scope, full[1]);
        if (v === false || v == null) continue; // drop false booleans
        attrs += ' ' + a.name + '="' + esc(v === true ? '' : v) + '"';
      } else {
        attrs += ' ' + a.name + '="' + esc(a.value.replace(RE, (_, p) => { const v = lookup(scope, p); return v == null ? '' : v; })) + '"';
      }
    }
    if (VOID[tag]) return '<' + n.tagName + attrs + '>';
    const kids = tag === 'template' ? n.content.childNodes : n.childNodes;
    return '<' + n.tagName + attrs + '>' + renderNodes(kids, scope, ctx) + '</' + n.tagName + '>';
  }

  // Minimal React-like base the design's logic class extends.
  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(u) {
      const patch = typeof u === 'function' ? u(this.state) : u;
      this.state = Object.assign({}, this.state, patch);
      if (this.__render) this.__schedule();
    }
  }

  function mount(root, templateEl, Logic) {
    const app = new Logic({});
    const nodes = Array.from(templateEl.content.childNodes);
    let handlers = [];
    let queued = false;
    const render = () => {
      queued = false;
      const ctx = { handlers: [] };
      const html = renderNodes(nodes, [app.renderVals()], ctx);
      handlers = ctx.handlers;
      const next = document.createElement('div');
      next.id = root.id;
      next.innerHTML = html;
      morphdom(root, next, {
        onBeforeElUpdated: (from, to) => {
          // keep what the user is typing
          if (from === document.activeElement && (from.tagName === 'INPUT' || from.tagName === 'TEXTAREA')) {
            to.value = from.value;
          }
          return !from.isEqualNode(to);
        }
      });
    };
    app.__schedule = () => { if (!queued) { queued = true; requestAnimationFrame(render); } };
    app.__render = render;
    ['click', 'change', 'submit', 'input'].forEach((type) => {
      root.addEventListener(type, (e) => {
        let el = e.target;
        while (el && el !== root) {
          const id = el.getAttribute && el.getAttribute('data-mq-' + type);
          if (id != null) { handlers[+id] && handlers[+id](e); return; }
          el = el.parentNode;
        }
      });
    });
    render();
    if (app.componentDidMount) app.componentDidMount();
    return app;
  }

  window.MQ = { DCLogic: DCLogic, mount: mount };
  window.DCLogic = DCLogic;
})();
