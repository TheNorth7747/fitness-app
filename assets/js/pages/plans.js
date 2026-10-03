/* ============================================================
   页面：训练计划
   展示三分化 / 四分化 / 五分化 / PPL / 居家 / HIIT 等方案
   ============================================================ */
(function (global) {
  'use strict';
  const { h, $ } = UI;
  const S = global.Store;
  const PLANS = global.PLANS;

  const LEVEL_COLOR = { easy: 'green', hard: 'orange', pro: 'red' };

  function render(root) {
    root.innerHTML = '';
    const cur = S.state.currentPlanId;

    root.appendChild(
      h('div.pl-intro',
        h('div.pl-intro-t', '选择适合你的训练分化'),
        h('div.pl-intro-s', '分化决定「一周练几次、每次练什么」。新手建议从三分化起步，练满 2-3 个月再考虑更复杂的方案。')
      )
    );

    // 按难度分组，便于新手判断
    const groups = [
      { key: 'easy', label: '入门友好', desc: '新手、居家、时间有限' },
      { key: 'hard', label: '进阶推荐', desc: '已有基础，想稳定进步' },
      { key: 'pro', label: '高阶专项', desc: '训练一年以上，追求单部位突破' }
    ];

    groups.forEach(g => {
      const list = PLANS.filter(p => p.levelKey === g.key);
      if (!list.length) return;
      root.appendChild(
        h('div.section-title', h('span', g.label),
          h('span.more', g.desc))
      );
      list.forEach(p => root.appendChild(planCard(p, p.id === cur)));
    });

    // 对比提示
    root.appendChild(
      h('div.card', { style: { marginTop: '14px' } },
        h('div.card-pad',
          h('div.sect-row', h('div.sect-t', '怎么选？'), null),
          h('ul.tips',
            h('li', h('b', '每周 3 天'), '→ 新手三分化，均匀刺激全身'),
            h('li', h('b', '每周 4 天'), '→ 上下肢四分化，均衡且好恢复'),
            h('li', h('b', '每周 5-6 天'), '→ PPL 推拉腿或五分化，容量大、进步快'),
            h('li', h('b', '在家 / 无器械'), '→ 居家哑铃或 HIIT 循环'),
            h('li', h('b', '提示'), '分化只是框架，真正的进步来自持续加重量和吃够蛋白质')
          )
        )
      )
    );
  }

  function planCard(p, isCurrent) {
    const totalEx = p.days.reduce((a, d) => a + d.items.length, 0);
    return h('div.card.plan-card' + (isCurrent ? '.current' : ''), {
      onclick: () => App.go('planDetail', { planId: p.id })
    },
      h('div.plan-hd',
        h('div.plan-cover.' + p.cover, { html: coverArt(p) }),
        h('div.plan-hd-main',
          h('div.plan-name-row',
            h('div.plan-name', p.name),
            isCurrent ? h('span.tag.green', '进行中') : null
          ),
          h('div.plan-sub', p.sub),
          h('div.plan-metas',
            h('span.tag.' + (LEVEL_COLOR[p.levelKey] || ''), p.level),
            h('span.tag', p.daysPerWeek + ' 天/周'),
            h('span.tag.blue', p.duration + ' 分钟'),
            h('span.tag.orange', p.goal)
          )
        )
      ),
      h('div.plan-desc', p.desc),
      h('div.plan-foot',
        h('div.plan-foot-l', p.days.length + ' 个训练日 · ' + totalEx + ' 个动作'),
        h('div.plan-foot-r', '查看详情', UI.iconHTML('chevron', 13))
      )
    );
  }

  /** 计划封面：按部位生成抽象图形，避免依赖外部图片 */
  function coverArt(p) {
    const map = {
      chest: '<circle cx="24" cy="26" r="9"/><path d="M8 44c4-8 10-12 16-12s12 4 16 12"/>',
      back: '<path d="M32 8c-7 0-12 5-12 11v20c0 4 5 7 12 7s12-3 12-7V19c0-6-5-11-12-11z"/><path d="M32 12v30"/>',
      legs: '<circle cx="24" cy="14" r="7"/><path d="M24 22v10M24 32l-8 12M24 32l8 12"/>',
      shoulders: '<circle cx="24" cy="14" r="7"/><path d="M10 26c3-4 8-6 14-6s11 2 14 6"/><path d="M24 26v18"/>',
      abs: '<circle cx="24" cy="14" r="7"/><rect x="14" y="24" width="20" height="20" rx="5"/><path d="M24 28v12M18 33h12"/>',
      cardio: '<path d="M6 34h8l5-14 7 22 5-12h8"/>'
    };
    return `<svg viewBox="0 0 48 48" width="42" height="42" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round"
      stroke-linejoin="round" opacity=".92">${map[p.cover] || map.chest}</svg>`;
  }

  // ---------------------------------------------------- 计划详情页
  function renderDetail(root, params) {
    const p = PLANS.find(x => x.id === params.planId);
    if (!p) { root.innerHTML = '<div class="empty">计划不存在</div>'; return; }
    const isCurrent = S.state.currentPlanId === p.id;
    root.innerHTML = '';

    // 头部
    root.appendChild(
      h('div.pd-hero.' + p.cover,
        h('div.pd-hero-in',
          h('div.pd-cover', { html: coverArt(p) }),
          h('div', { style: { flex: '1', minWidth: '0' } },
            h('div.pd-name', p.name),
            h('div.pd-sub', p.sub),
            h('div.pd-tags',
              h('span.tag.' + (LEVEL_COLOR[p.levelKey] || ''), p.level),
              h('span.tag', p.daysPerWeek + ' 天/周'),
              h('span.tag.blue', p.duration + ' 分钟')
            )
          )
        ),
        h('div.pd-desc', p.desc)
      )
    );

    // 适合人群
    root.appendChild(
      h('div.card',
        h('div.card-pad',
          h('div.sect-row', h('div.sect-t', '适合人群'), null),
          h('div.pd-fit', ...p.fit.map(f => h('span.pd-fit-item', { html: UI.iconHTML('check', 13) }, f)))
        )
      )
    );

    // 标签
    root.appendChild(
      h('div.card',
        h('div.card-pad',
          h('div.sect-row', h('div.sect-t', '计划特点'), null),
          h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' } },
            ...p.tags.map((t, i) =>
              h('span.tag.' + ['green', 'blue', 'orange', 'purple'][i % 4], t)))
        )
      )
    );

    // 每日编排
    p.days.forEach((d, di) => {
      const card = h('div.card',
        h('div.card-pad', { style: { paddingBottom: '6px' } },
          h('div.pd-day-hd',
            h('div.pd-day-badge', 'D' + (di + 1)),
            h('div', { style: { flex: '1', minWidth: '0' } },
              h('div.pd-day-n', d.name),
              h('div.pd-day-f', d.focus)
            ),
            h('div.pd-day-c', d.items.length + ' 动作')
          )
        )
      );
      const list = h('div.pd-items');
      d.items.forEach((it, ii) => {
        const ex = UI.EX_INDEX[it.eid];
        if (!ex) return;
        list.appendChild(
          h('div.pd-item', { onclick: () => global.PageExercises.openDetail(ex) },
            UI.img(ex.img, ex.n),
            h('div.pd-item-m',
              h('div.pd-item-n', ex.n),
              h('div.pd-item-s',
                h('span', it.sets + ' 组 × ' + it.reps),
                h('span.pd-dot', '·'),
                h('span', '休息 ' + it.rest + 's')
              )
            ),
            h('div.pd-item-c', { html: UI.iconHTML('chevron', 14) })
          )
        );
      });
      card.appendChild(list);
      root.appendChild(card);
    });

    // 应用按钮
    const foot = h('div.pd-foot');
    if (isCurrent) {
      foot.appendChild(
        h('button.btn.block', { onclick: () => {
          const idx = S.todayDayIndex(p.id);
          App.go('workout', { planId: p.id, dayIndex: idx < 0 ? 0 : idx });
        } }, '开始今天的训练')
      );
      foot.appendChild(h('div.pd-hint', '这是你当前的训练计划'));
    } else {
      foot.appendChild(
        h('button.btn.block', { onclick: () => {
          S.applyPlan(p.id);
          UI.toast('已切换到「' + p.name + '」');
          App.back();
        } }, '使用这个计划')
      );
    }
    root.appendChild(foot);
  }

  global.PagePlans = { render, title: '训练计划' };
  global.PagePlanDetail = { render: renderDetail, title: '计划详情' };
})(window);
