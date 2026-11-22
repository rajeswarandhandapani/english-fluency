// Shared safe DOM builders, date formatting, modal confirm, toast, download, and clipboard helpers.

import { fromIso } from './dates.js';

/** Builds DOM safely: untrusted strings only ever become text nodes, never HTML. */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value' && v != null && (tag === 'textarea' || tag === 'input' || tag === 'select')) el.value = String(v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}

export function svgEl(tag, attrs = {}, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  el.append(...children);
  return el;
}

export function select(label, value, options, onchange, extra = {}) {
  const el = h('select', { 'aria-label': label, ...extra, onchange: () => onchange(el.value) },
    options.map(o => {
      const [v, text] = Array.isArray(o) ? o : [o, o];
      return h('option', { value: v, selected: String(v) === String(value) }, text);
    }));
  return el;
}

export function createDateFormatters(locale = 'en-US') {
  const fmt = opts => {
    const f = new Intl.DateTimeFormat(locale, opts);
    return iso => f.format(fromIso(iso));
  };
  return {
    longDate: fmt({ weekday: 'long', month: 'long', day: 'numeric' }),
    shortDate: fmt({ month: 'short', day: 'numeric' }),
    dayLetter: fmt({ weekday: 'narrow' }),
    dayName: fmt({ weekday: 'short', month: 'short', day: 'numeric' }),
  };
}

const defaults = createDateFormatters('en-US');
export const { longDate, shortDate, dayLetter, dayName } = defaults;

let toastTimer;
export function toast(message, action, selector = '#toast') {
  const box = document.querySelector(selector);
  if (!box) return;
  box.replaceChildren(h('span', {}, message));
  if (action) {
    box.append(h('button', { class: 'link', type: 'button', onclick: () => { box.classList.remove('show'); action.run(); } }, action.label));
  }
  box.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('show'), action ? 6000 : 3200);
}

export function confirmIt(title, body, yes = 'Confirm') {
  return new Promise(resolve => {
    const box = h('dialog', { class: 'confirm' },
      h('h2', {}, title),
      h('p', {}, body),
      h('div', { class: 'row end' },
        h('button', { class: 'ghost', type: 'button', onclick: () => close(false) }, 'Cancel'),
        h('button', { class: 'danger', type: 'button', onclick: () => close(true) }, yes)));
    function close(answer) {
      box.close();
      box.remove();
      resolve(answer);
    }
    box.addEventListener('cancel', e => { e.preventDefault(); close(false); });
    document.body.append(box);
    box.showModal();
  });
}

export function download(name, text, type = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { }
  try {
    const ta = h('textarea', { readonly: true });
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
