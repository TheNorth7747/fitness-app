/* ============================================================
   App — 页面栈路由 + 底部 TabBar + 状态栏时钟
   模拟小程序 navigateTo / switchTab / navigateBack
   ============================================================ */
(function (global) {
  'use strict';
  const { h, $, $$ } = UI;

  // Tab 页（常驻，显示 TabBar）
  const TABS = [
    { key: 'home', title: '首页', icon: 'home', page: 'PageHome' },
    { key: 'exercises', title: '动作库', icon: 'book', page: 'PageExercises' },
    { key: 'plans', title: '计划', icon: 'calendar', page: 'PagePlans' },
    { key: 'profile', title: '我的', icon: 'user', page: 'PageProfile' }
  ];

  // 栈页（从右侧推入，有返回按钮，隐藏 TabBar）
  const STACK = {
    workout: { mod: 'PageWorkout', title: '训练执行' },
    planDetail: { mod: 'PagePlanDetail', title: '计划详情' }
  };

  let stack = []; // 栈页栈
  let currentTab = 'home';

  // ---------------------------------------------------- 初始化
  function init() {
    buildStatusBar();
    buildTabbar();
    switchTab('home', true);

    // 支持返回键关闭弹层
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const ov = $('.sheet-ov');
        if (ov) { ov.remove(); return; }
        if (stack.length) back();
      }
    });
  }

  // ---------------------------------------------------- 状态栏
  function buildStatusBar() {
    const sb = $('.statusbar-time');
    const tick = () => {
      const d = new Date();
      sb.textContent =
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    };
    tick();
    setInterval(tick, 20000);
  }

  // ---------------------------------------------------- TabBar
  function buildTabbar() {
    const bar = $('.tabbar');
    bar.innerHTML = '';
    TABS.forEach(t => {
      const btn = h('button.tab', { dataset: { tab: t.key }, onclick: () => switchTab(t.key) },
        (() => {
          const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          s.setAttribute('viewBox', '0 0 24 24');
          s.setAttribute('fill', 'none');
          s.setAttribute('stroke', 'currentColor');
          s.setAttribute('stroke-width', '1.8');
          s.setAttribute('stroke-linecap', 'round');
          s.setAttribute('stroke-linejoin', 'round');
          s.innerHTML = UI.ICONS[t.icon];
          return s;
        })(),
        h('span', t.title)
      );
      bar.appendChild(btn);
    });
  }

  // ---------------------------------------------------- 路由
  function switchTab(key, first) {
    // 从栈页切 tab：清空栈
    if (stack.length) {
      stack.slice().forEach(s => removePage(s.el, false));
      stack = [];
    }
    currentTab = key;
    const t = TABS.find(x => x.key === key);
    if (!t) return;

    let el = $('#page-' + key);
    if (!el) {
      el = h('div.page', { id: 'page-' + key });
      $('.pages').appendChild(el);
    }
    $$('.page').forEach(p => p.classList.remove('active', 'from-right', 'to-left'));
    el.classList.add('active');

    $('.navbar').classList.remove('transparent');
    $('.nav-title').textContent = t.title;
    $('.nav-back').style.display = 'none';
    $('.tabbar').classList.remove('hide');
    setStatusDark(false);
    setCapsuleDark(false);

    $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === key));

    const mod = global[t.page];
    if (mod && mod.render) mod.render(el);
    el.scrollTop = 0;
  }

  /** 推入栈页 */
  function go(name, params) {
    const cfg = STACK[name];
    if (!cfg) return;
    const el = h('div.page', { id: 'page-' + name + '-' + Date.now() });
    $('.pages').appendChild(el);
    stack.push({ name, el, params });

    $('.navbar').classList.remove('transparent');
    $('.nav-title').textContent = cfg.title;
    $('.nav-back').style.display = 'flex';
    $('.tabbar').classList.add('hide');
    setStatusDark(false);
    setCapsuleDark(false);

    const mod = global[cfg.mod];
    if (mod && mod.render) mod.render(el, params || {});
    // 强制重启动画
    void el.offsetWidth;
    el.classList.add('active', 'from-right');
    el.scrollTop = 0;
  }

  /** 返回上一层 */
  function back() {
    if (!stack.length) return;
    const top = stack.pop();
    removePage(top.el, true);
    if (!stack.length) switchTab(currentTab);
    else {
      const cfg = STACK[stack[stack.length - 1].name];
      $('.nav-title').textContent = cfg.title;
    }
  }

  function removePage(el, animate) {
    if (animate) {
      el.classList.remove('from-right');
      el.classList.add('to-left');
      setTimeout(() => el.remove(), 280);
    } else {
      el.remove();
    }
  }

  function setStatusDark(dark) {
    $('.statusbar').classList.toggle('on-dark', dark);
  }
  function setCapsuleDark(dark) {
    $('.capsule').classList.toggle('on-dark', dark);
  }

  function renderAll() {
    switchTab(currentTab);
  }

  global.App = { init, go, back, tab: switchTab, renderAll, stack: () => stack };

  document.addEventListener('DOMContentLoaded', init);
})(window);
