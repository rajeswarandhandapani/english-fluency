// Shared responsive SVG chart primitives: ResizeObserver plot, tooltips, scale math, and bar paths.

import { h, svgEl } from './ui.js';

export function svgLabel(attrs, value) {
  const t = svgEl('text', attrs);
  t.textContent = value;
  return t;
}

/** Rounded at the far end only so bars sit flush on their baseline. */
export function barPath(x, from, to, w, radius = 4) {
  const dir = to < from ? -1 : 1;
  const r = Math.min(radius, w / 2, Math.abs(from - to));
  return `M${x},${from}V${to - dir * r}Q${x},${to} ${x + r},${to}H${x + w - r}Q${x + w},${to} ${x + w},${to - dir * r}V${from}Z`;
}

export function niceScale(peak) {
  const pow = 10 ** Math.floor(Math.log10(Math.max(peak, 10)));
  const step = [0.5, 1, 2, 2.5, 5, 10].map(m => m * pow).find(s => peak / s <= 4) || pow * 10;
  return { step, top: Math.ceil(peak / step) * step || step };
}

export function plot(height, draw) {
  const box = h('div', { class: 'chart-plot' });
  box.style.minHeight = `${height}px`;
  let last = 0;
  new ResizeObserver(([entry]) => {
    const width = Math.round(entry.contentRect.width);
    if (width && width !== last) {
      last = width;
      box.replaceChildren();
      draw(box, width);
    }
  }).observe(box);
  return box;
}

export function tooltip(box) {
  const tip = h('div', { class: 'chart-tip', hidden: true });
  box.append(tip);
  return {
    show(x, y, lines) {
      tip.replaceChildren(...lines);
      tip.hidden = false;
      tip.style.left = `${Math.max(2, Math.min(x + 12, box.clientWidth - tip.offsetWidth - 2))}px`;
      tip.style.top = `${Math.max(0, y - tip.offsetHeight - 8)}px`;
    },
    hide() { tip.hidden = true; },
  };
}

export function pointerIn(svg, e) {
  const r = svg.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

export const legend = items => h('div', { class: 'legend' }, items.map(item => {
  const swatch = h('i', { class: item.dashed ? 'swatch dashed' : 'swatch' });
  swatch.style.setProperty('--swatch', item.color);
  return h('span', {}, swatch, item.name);
}));
