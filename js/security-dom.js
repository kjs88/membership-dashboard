// HTML never contains executable code. Each rendered action holds a real callback
// behind a one-use random token; text from storage cannot register its own actions.
const dashboardDom = (() => {
  // Static hosting cannot set frame-ancestors. Fail closed in foreign frames,
  // including the project page; same-origin embedding remains supported.
  if (window.top !== window.self) {
    try {
      if (window.top.location.origin !== window.location.origin) throw new Error('Foreign frame');
    } catch (_) {
      window.stop();
      document.documentElement.replaceChildren();
      throw new Error('Cross-origin framing is blocked.');
    }
  }
  const actions = new Map();
  let cleanupQueued = false;
  const events = new Set(['click', 'change', 'input', 'keydown', 'keyup', 'keypress',
    'mousedown', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave', 'blur', 'focus',
    'dragstart', 'dragend', 'dragover', 'dragleave', 'drop', 'submit']);
  const purifier = window.DOMPurify;
  if (!purifier?.isSupported) throw new Error('HTML security filter could not be loaded.');

  purifier.addHook('uponSanitizeAttribute', (node, data) => {
    const name = data.attrName.toLowerCase();
    if (name.startsWith('data-ui-static-') || name === 'srcdoc') data.keepAttr = false;
    if (name.startsWith('data-ui-action-') && !actions.has(data.attrValue)) data.keepAttr = false;
    if (['href', 'src', 'xlink:href', 'action', 'formaction'].includes(name)) {
      const value = data.attrValue.trim();
      if (/^data:/i.test(value) && !(node.nodeName === 'IMG' && /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(value))) data.keepAttr = false;
    }
  });
  purifier.addHook('afterSanitizeAttributes', node => {
    if (node.nodeName === 'A' && node.getAttribute('target') === '_blank') node.setAttribute('rel', 'noopener noreferrer');
  });

  function action(type, callback, args = []) {
    if (!events.has(type) || typeof callback !== 'function') throw new TypeError('Invalid UI action');
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const token = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    actions.set(token, { type, callback, args });
    // All templates are inserted synchronously. Unused templates must not retain data.
    if (!cleanupQueued) {
      cleanupQueued = true;
      queueMicrotask(() => { actions.clear(); cleanupQueued = false; });
    }
    return `data-ui-action-${type}="${token}"`;
  }

  function bindActions(root) {
    for (const node of root.querySelectorAll('*')) {
      for (const attr of Array.from(node.attributes)) {
        if (!attr.name.startsWith('data-ui-action-')) continue;
        const action = actions.get(attr.value);
        node.removeAttribute(attr.name);
        if (!action || attr.name !== `data-ui-action-${action.type}`) continue;
        actions.delete(attr.value);
        node.addEventListener(action.type, function (event) {
          if (action.callback.call(this, event, action.args) === false) event.preventDefault();
        });
      }
    }
  }

  function setHtml(target, html) {
    if (!target) throw new TypeError('Missing HTML target');
    // Preserve the parser context of table fragments (tr/td/thead/tbody).
    const wrappers = {
      TABLE: ['<table>', '</table>', 'table'],
      THEAD: ['<table><thead>', '</thead></table>', 'thead'],
      TBODY: ['<table><tbody>', '</tbody></table>', 'tbody'],
      TFOOT: ['<table><tfoot>', '</tfoot></table>', 'tfoot'],
      TR: ['<table><tbody><tr>', '</tr></tbody></table>', 'tr'],
      COLGROUP: ['<table><colgroup>', '</colgroup></table>', 'colgroup'],
    };
    const wrapper = wrappers[target.tagName];
    const text = String(html ?? '');
    const fragment = purifier.sanitize(wrapper ? wrapper[0] + text + wrapper[1] : text, {
      RETURN_DOM_FRAGMENT: true,
      USE_PROFILES: { html: true, svg: true },
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'base', 'link', 'meta', 'form', 'foreignObject', 'animate', 'set'],
      FORBID_ATTR: ['srcdoc', 'is', 'formaction', 'form', 'autofocus'],
      ALLOW_UNKNOWN_PROTOCOLS: false,
      SANITIZE_DOM: true,
    });
    bindActions(fragment);
    const content = wrapper ? fragment.querySelector(wrapper[2]) : fragment;
    target.replaceChildren(...(content ? Array.from(content.childNodes) : []));
    target.querySelectorAll('details.su-more').forEach(node => { node.open = true; });
  }

  function bindStatic(bindings) {
    for (const [type, key, callback] of bindings) {
      if (!events.has(type) || typeof callback !== 'function') throw new TypeError('Invalid static UI action');
      const attr = `data-ui-static-${type}`;
      for (const node of document.querySelectorAll(`[${attr}="${key}"]`)) {
        node.removeAttribute(attr);
        node.addEventListener(type, function (event) {
          if (callback.call(this, event, []) === false) event.preventDefault();
        });
      }
    }
  }
  return Object.freeze({ action, setHtml, bindStatic });
})();

function uiAction(type, callback, args) { return dashboardDom.action(type, callback, args); }
function uiSetHtml(target, html) { dashboardDom.setHtml(target, html); }
function uiBindStatic(bindings) { dashboardDom.bindStatic(bindings); }
