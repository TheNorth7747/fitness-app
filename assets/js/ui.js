/* ============================================================
   UI — 通用工具：DOM 构建、Toast、动作卡片、弹层
   ============================================================ */
(function (global) {
  'use strict';

  const EX_INDEX = {};
  (global.EXERCISES || []).forEach(e => { EX_INDEX[e.id] = e; });

  /** 极简 hyperscript：h('div.card', {onclick}, child1, child2) */
  function h(spec, props, ...children) {
    const m = /^([a-zA-Z0-9]+)?((?:[.#][\w-]+)*)$/.exec(spec) || [];
    const tag = m[1] || 'div';
    const el = document.createElement(tag);
    if (m[2]) {
      m[2].match(/[.#][\w-]+/g).forEach(t => {
        if (t[0] === '.') el.classList.add(t.slice(1));
        else el.id = t.slice(1);
      });
    }
    if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
      // 数组一律视为子节点（例如 h('span.chip', [iconHTML(..), '文本'])），
      // 展开后与普通 children 一同处理
      children.unshift(...(Array.isArray(props) ? props : [props]));
      props = null;
    }
    if (props) {
      Object.keys(props).forEach(k => {
        const v = props[k];
        if (v == null || v === false) return;
        if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') {
          el.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (k === 'dataset') {
          Object.assign(el.dataset, v);
        } else if (k === 'class') {
          // 追加而非覆盖：spec 里的 .foo 与 props.class 需要共存
          String(v).split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c));
        } else el.setAttribute(k, v === true ? '' : v);
      });
    }
    children.flat(Infinity).forEach(c => {
      if (c == null || c === false) return;
      if (c instanceof Node) { el.appendChild(c); return; }
      const s = String(c);
      // iconHTML() 返回的是 SVG 字符串，必须当作标记解析，
      // 否则会退化成可见文本节点（页面上会直接冒出 "<svg ...>"）
      if (s.trimStart().startsWith('<svg')) {
        const tpl = document.createElement('div');
        tpl.innerHTML = s;
        while (tpl.firstChild) el.appendChild(tpl.firstChild);
        return;
      }
      el.appendChild(document.createTextNode(s));
    });
    return el;
  }

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  // ---------------------------------------------------- Toast
  let toastTimer = null;
  function toast(msg) {
    let t = $('.toast');
    if (!t) {
      t = h('div.toast');
      $('.screen').appendChild(t);
    }
    t.textContent = msg;
    // 强制重排以重启动画
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1700);
  }

  // ---------------------------------------------------- 图片懒加载 + 降级
  const FALLBACK_SVG =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">
        <rect width="180" height="180" fill="#f2f3f5"/>
        <text x="90" y="86" font-size="13" fill="#b2b2b2" text-anchor="middle"
          font-family="sans-serif">暂无图</text>
      </svg>`
    );

  /** 加载图片，失败时降级为占位图 */
  function img(src, alt, cls) {
    const el = h('img' + (cls ? '.' + cls : ''), { alt: alt || '', loading: 'lazy' });
    el.addEventListener('error', function () {
      if (this.dataset.failed) return;
      this.dataset.failed = '1';
      this.src = FALLBACK_SVG;
    });
    el.src = src;
    return el;
  }

  // ---------------------------------------------------- 图标
  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.5 20v-6h5v6"/>',
    book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v18H5.5A1.5 1.5 0 0 1 4 19.5z"/><path d="M8 3v18"/><path d="M12 8h4M12 12h4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4M16 3v4"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5"/>',
    play: '<path d="M7 4.8v14.4L19 12z" fill="currentColor" stroke-linejoin="round"/>',
    check: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>',
    chevron: '<path d="M9 5l7 7-7 7"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    flame: '<path d="M12 3s5 4.2 5 8.5A5 5 0 0 1 7 12c0-1.6.7-3 1.5-4 .2 1.2 1 2 2 2 0-3.5 1.5-5.5 1.5-7z"/><path d="M12 21a5 5 0 0 0 5-5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5H5.5A2.5 2.5 0 0 0 8 9.5M16 5h2.5A2.5 2.5 0 0 1 16 9.5"/><path d="M12 13v4M8.5 20h7"/>',
    heart: '<path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4h-4"/>',
    edit: '<path d="M4 20h4L20 8l-4-4L4 16z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.4"/>',
    fire: '<path d="M12 22c4 0 6.5-2.6 6.5-6 0-4.5-4.5-6.5-4-11-2 1-3 2.6-3 4.5-1-.6-1.6-1.6-1.8-2.8C8 8 5.5 10 5.5 16c0 3.4 2.5 6 6.5 6z"/>'
  };

  function icon(name, size) {
    const s = size || 24;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', s);
    svg.setAttribute('height', s);
    svg.innerHTML = ICONS[name] || '';
    return svg;
  }

  function iconHTML(name, size) {
    return `<svg viewBox="0 0 24 24" width="${size || 24}" height="${size || 24}"
      fill="none" stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  }

  // ---------------------------------------------------- 环形进度
  function ring(percent, size, stroke, color, trackColor) {
    size = size || 96;
    stroke = stroke || 8;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const off = c * (1 - Math.min(100, Math.max(0, percent)) / 100);
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('width', size);
    el.setAttribute('height', size);
    el.setAttribute('viewBox', `0 0 ${size} ${size}`);
    el.style.transform = 'rotate(-90deg)';
    el.innerHTML = `
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
        stroke="${trackColor || 'rgba(255,255,255,.28)'}" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
        stroke="${color || '#fff'}" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${c}" stroke-dashoffset="${off}"
        style="transition:stroke-dashoffset .6s cubic-bezier(.3,.8,.4,1)"/>`;
    return el;
  }

  // ---------------------------------------------------- 迷你折线图（纯 SVG）
  function sparkline(values, w, hgt, color, fill) {
    w = w || 300; hgt = hgt || 60;
    if (!values.length) return h('div.spark-empty', '暂无数据');
    const max = Math.max.apply(null, values);
    const min = Math.min.apply(null, values);
    const span = max - min || 1;
    const step = values.length > 1 ? w / (values.length - 1) : w;
    const pts = values.map((v, i) => [
      i * step,
      hgt - ((v - min) / span) * (hgt - 10) - 5
    ]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = d + ` L${w} ${hgt} L0 ${hgt} Z`;
    const dots = pts
      .map((p, i) =>
        `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === pts.length - 1 ? 3.4 : 2.2}"
          fill="${i === pts.length - 1 ? color : '#fff'}" stroke="${color}" stroke-width="1.6"/>`
      )
      .join('');
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('viewBox', `0 0 ${w} ${hgt}`);
    el.setAttribute('width', '100%');
    el.setAttribute('height', hgt);
    el.setAttribute('preserveAspectRatio', 'none');
    el.innerHTML =
      (fill ? `<path d="${area}" fill="${color}" opacity=".1"/>` : '') +
      `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.2"
        stroke-linecap="round" stroke-linejoin="round"/>${dots}`;
    return el;
  }

  // ---------------------------------------------------- 动作小卡（网格用）
  function exThumb(ex, onClick) {
    const card = h('div.ex-card', { onclick: onClick || null },
      h('div.ex-thumb', img(ex.img, ex.n)),
      h('div.ex-info', { title: ex.n },
        h('div.ex-name', ex.n),
        h('div.ex-tags', h('span.tag', ex.t), h('span.tag', ex.eq))
      )
    );
    return card;
  }

  global.UI = {
    h, $, $$, toast, img, icon, iconHTML, ring, sparkline, exThumb,
    ICONS, EX_INDEX, FALLBACK_SVG
  };
})(window);
