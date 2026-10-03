/* ============================================================
   页面：动作库
   数据源：hasaneyldrm/exercises-dataset（1,324 条，含 GIF 演示）
   ============================================================ */
(function (global) {
  'use strict';
  const { h, $, toast, img } = UI;
  const S = global.Store;
  const ALL = global.EXERCISES;

  const OPS = { bp: '训练部位', eq: '所需器械', t: '目标肌群' };
  let filter = { q: '', bp: '', eq: '', t: '' };
  let limit = 60;

  function uniqBy(arr) {
    const c = {};
    arr.forEach(x => { c[x] = (c[x] || 0) + 1; });
    return Object.keys(c).sort((a, b) => c[b] - c[a]);
  }
  const OPTIONS = {
    bp: uniqBy(ALL.map(e => e.bp)),
    eq: uniqBy(ALL.map(e => e.eq)),
    t: uniqBy(ALL.map(e => e.t))
  };

  function matches(e) {
    if (filter.bp && e.bp !== filter.bp) return false;
    if (filter.eq && e.eq !== filter.eq) return false;
    if (filter.t && e.t !== filter.t) return false;
    if (filter.q) {
      const q = filter.q.toLowerCase();
      return (
        e.n.toLowerCase().includes(q) ||
        e.ne.toLowerCase().includes(q) ||
        e.t.toLowerCase().includes(q) ||
        e.bp.toLowerCase().includes(q) ||
        e.eq.toLowerCase().includes(q)
      );
    }
    return true;
  }

  function persist() {
    S.state.lastFilter = Object.assign({}, filter);
    S.save();
  }

  function render(root) {
    filter = Object.assign({ q: '', bp: '', eq: '', t: '' }, S.state.lastFilter || {});
    limit = 60;
    root.innerHTML = '';

    // ---------------------------------------------- 搜索栏
    const input = h('input.ex-search-in', {
      type: 'search',
      placeholder: '搜索动作，如「卧推」「深蹲」',
      value: filter.q
    });
    let tmr = null;
    input.addEventListener('input', function () {
      const v = this.value;
      clearTimeout(tmr);
      tmr = setTimeout(() => {
        filter.q = v.trim();
        limit = 60;
        persist();
        paint();
      }, 180);
    });

    const countEl = h('div.ex-count');
    const clearQ = h('span.ex-search-clear', {
      onclick: () => { filter.q = ''; input.value = ''; limit = 60; persist(); paint(); }
    }, '×');

    const chips = ['bp', 'eq', 't'].map(k =>
      h('span.ex-fchip', { dataset: { k }, onclick: () => openSheet(k) })
    );
    const clearAllBtn = h('span.ex-fchip.clear', {
      onclick: () => {
        filter = { q: filter.q, bp: '', eq: '', t: '' };
        limit = 60;
        persist();
        paint();
      }
    }, '清空筛选');

    const grid = h('div.ex-grid');

    root.appendChild(
      h('div.ex-bar',
        h('div.ex-search',
          h('span.ex-search-ic', { html: UI.iconHTML('search', 16) }),
          input,
          clearQ
        ),
        h('div.ex-filters', ...chips, clearAllBtn)
      )
    );
    root.appendChild(h('div.card.ex-count-card', countEl));
    root.appendChild(h('div.ex-grid-wrap', grid));

    /** 统一刷新：筛选 chips 文案 + 计数 + 列表 */
    function paint() {
      // chips
      chips.forEach((c, i) => {
        const k = ['bp', 'eq', 't'][i];
        const v = filter[k];
        c.className = 'ex-fchip' + (v ? ' on' : '');
        c.textContent = v || OPS[k];
        if (v) c.appendChild(h('i', '×'));
      });
      const anyFilter = filter.bp || filter.eq || filter.t || filter.q;
      clearAllBtn.style.display = anyFilter ? '' : 'none';
      clearQ.style.display = filter.q ? '' : 'none';

      const res = ALL.filter(matches);
      countEl.textContent =
        '共 ' + res.length + ' 个动作' +
        (filter.bp || filter.eq || filter.t ? '（已筛选）' : '');

      grid.innerHTML = '';
      if (!res.length) {
        grid.appendChild(
          h('div.empty', {
            html: UI.iconHTML('search', 56) +
              '<div>没有找到匹配的动作</div>' +
              '<div style="margin-top:8px;font-size:12px">试试更换筛选条件或清空搜索</div>'
          })
        );
        return;
      }
      res.sort((a, b) => (S.isFav(b.id) ? 1 : 0) - (S.isFav(a.id) ? 1 : 0));
      res.slice(0, limit).forEach(e => grid.appendChild(exCard(e)));
      if (res.length > limit) {
        grid.appendChild(
          h('button.btn.gray.block.ex-more', {
            onclick: function () {
              limit += 60;
              const more = grid.querySelector('.ex-more');
              res.slice(limit - 60, limit).forEach(e => more.before(exCard(e)));
              if (limit >= res.length) more.remove();
              else more.textContent = `加载更多（还有 ${res.length - limit} 个）`;
            }
          }, `加载更多（还有 ${res.length - limit} 个）`)
        );
      }
    }

    function exCard(e) {
      return h('div.ex-card', { onclick: () => openDetail(e) },
        h('div.ex-thumb',
          img(e.img, e.n),
          S.isFav(e.id) ? h('div.ex-fav', { html: UI.iconHTML('heart', 13) }) : null
        ),
        h('div.ex-info',
          h('div.ex-name', { title: e.n }, e.n),
          h('div.ex-tags', h('span.tag', e.t), h('span.tag.blue', e.eq))
        )
      );
    }

    paint();
  }

  // ---------------------------------------------------- 动作详情弹层
  function openDetail(e) {
    const ov = h('div.sheet-ov');
    const favBtn = h('button.ex-fav-btn' + (S.isFav(e.id) ? '.on' : ''), {
      onclick: function () {
        const on = S.toggleFav(e.id);
        this.classList.toggle('on', on);
        toast(on ? '已收藏该动作' : '已取消收藏');
      }
    }, UI.iconHTML('heart', 18));

    const panel = h('div.sheet-panel.ex-detail',
      h('div.sheet-grip'),
      h('div.ex-detail-hd',
        h('div', { style: { flex: '1', minWidth: '0' } },
          h('div.ex-detail-t', e.n),
          h('div.ex-detail-en', e.ne)
        ),
        favBtn,
        h('button.sheet-x', { onclick: close }, '×')
      ),
      h('div.ex-detail-media', img(e.gif, e.n)),
      h('div.ex-detail-metas',
        h('span.tag.green', e.bp),
        h('span.tag.blue', e.eq),
        h('span.tag.orange', e.t)
      ),
      h('div.ex-detail-muscle',
        h('div.kv', h('span.kv-k', '主要肌群'), h('span.kv-v', e.mg)),
        e.sm && e.sm.length
          ? h('div.kv', h('span.kv-k', '协同肌群'), h('span.kv-v', e.sm.join('、')))
          : null
      ),
      h('div.ex-detail-sec', '动作要领'),
      h('ol.ex-steps', e.s.map((s, i) => h('li', h('b', i + 1), h('span', s)))),
      h('div.ex-attr',
        '数据来自开源项目 exercises-dataset（MIT）· 图片与动画版权归 © Gym visual 所有')
    );

    ov.appendChild(panel);
    ov.addEventListener('click', ev => { if (ev.target === ov) close(); });
    $('.screen').appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('show'));

    function close() {
      ov.classList.remove('show');
      setTimeout(() => ov.remove(), 240);
    }
  }

  // ---------------------------------------------------- 筛选底部面板
  function openSheet(kind) {
    const old = $('.sheet-ov');
    if (old) old.remove();

    const grid = h('div.chip-grid');
    OPTIONS[kind].forEach(v => {
      const chip = h('span.chip-opt' + (filter[kind] === v ? '.on' : ''), v);
      chip.addEventListener('click', function () {
        const on = filter[kind] === v;
        filter[kind] = on ? '' : v;
        this.classList.toggle('on', on);
        persist();
        limit = 60;
        const page = $('.page.active');
        if (page && page.id === 'page-exercises') paintInPlace(page);
      });
      grid.appendChild(chip);
    });

    const ov = h('div.sheet-ov',
      h('div.sheet-panel.sheet-half',
        h('div.sheet-grip'),
        h('div.sheet-hd', OPS[kind], h('button.sheet-x', { onclick: close }, '×')),
        grid,
        h('div.divider'),
        h('div', { style: { display: 'flex', gap: '10px', padding: '14px' } },
          h('button.btn.gray', { style: { flex: '1' }, onclick: () => {
            filter[kind] = '';
            persist();
            limit = 60;
            const page = $('.page.active');
            if (page && page.id === 'page-exercises') render(page);
            close();
          } }, '重置'),
          h('button.btn', { style: { flex: '2' }, onclick: close }, '确定')
        )
      )
    );
    ov.addEventListener('click', ev => { if (ev.target === ov) close(); });
    $('.screen').appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('show'));

    function close() {
      ov.classList.remove('show');
      setTimeout(() => ov.remove(), 240);
    }
  }

  /** 面板内改动筛选后，只刷新列表区（不重建搜索框，避免输入失焦） */
  function paintInPlace(page) {
    const grid = $('.ex-grid', page);
    const countEl = $('.ex-count', page);
    const chips = page.querySelectorAll('.ex-filters .ex-fchip:not(.clear)');
    const keys = ['bp', 'eq', 't'];
    chips.forEach((c, i) => {
      const k = keys[i];
      const v = filter[k];
      c.className = 'ex-fchip' + (v ? ' on' : '');
      c.textContent = v || OPS[k];
      if (v) c.appendChild(h('i', '×'));
    });

    const res = ALL.filter(matches);
    if (countEl) {
      countEl.textContent = '共 ' + res.length + ' 个动作' +
        (filter.bp || filter.eq || filter.t ? '（已筛选）' : '');
    }
    if (!grid) return;
    grid.innerHTML = '';
    if (!res.length) {
      grid.appendChild(
        h('div.empty', {
          html: UI.iconHTML('search', 56) + '<div>没有找到匹配的动作</div>'
        })
      );
      return;
    }
    res.sort((a, b) => (S.isFav(b.id) ? 1 : 0) - (S.isFav(a.id) ? 1 : 0));
    res.slice(0, limit).forEach(e => {
      grid.appendChild(
        h('div.ex-card', { onclick: () => openDetail(e) },
          h('div.ex-thumb', img(e.img, e.n),
            S.isFav(e.id) ? h('div.ex-fav', { html: UI.iconHTML('heart', 13) }) : null),
          h('div.ex-info',
            h('div.ex-name', { title: e.n }, e.n),
            h('div.ex-tags', h('span.tag', e.t), h('span.tag.blue', e.eq)))
        )
      );
    });
    if (res.length > limit) {
      grid.appendChild(
        h('div.ex-more-tip', `仅显示前 ${limit} 个，继续搜索或筛选以缩小范围`)
      );
    }
  }

  global.PageExercises = { render, title: '动作库', openDetail };
})(window);
