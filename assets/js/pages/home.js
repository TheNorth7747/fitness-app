/* ============================================================
   页面：首页
   核心诉求 —— 一眼看清「今天练什么、练到什么程度、还差多少」
   ============================================================ */
(function (global) {
  'use strict';
  const { h, iconHTML, ring, toast } = UI;
  const S = global.Store;

  const WEEK_CN = ['一', '二', '三', '四', '五', '六', '日'];

  function render(root) {
    root.innerHTML = '';
    const st = S.stats();
    const plan = S.plans.find(p => p.id === S.state.currentPlanId) || S.plans[0];
    const dayIdx = S.todayDayIndex(plan.id);
    const body = h('div.page-body');

    // ---------------------------------------------- 今日主卡
    const day = dayIdx >= 0 ? plan.days[dayIdx] : null;
    const prog = day ? S.getDayProgress(plan.id, dayIdx) : null;
    const pct = prog && prog.totalSets ? Math.round((prog.doneSets / prog.totalSets) * 100) : 0;
    const doneToday = S.records.some(
      r => r.date === S.isoDay(new Date()) && r.planId === plan.id && r.dayIndex === dayIdx
    );

    const hero = h('div.hero');

    if (day) {
      hero.appendChild(
        h('div.hero-top', { style: { display: 'flex', alignItems: 'center', gap: '16px' } },
          h('div.hero-ring', ring(pct, 88, 8, '#fff', 'rgba(255,255,255,.25)'),
            h('div.hero-ring-txt', h('b', pct + '%'), h('i', `${prog.doneSets}/${prog.totalSets} 组`))
          ),
          h('div.hero-meta', { style: { flex: '1', minWidth: '0' } },
            h('div.hero-label', '今日训练目标'),
            h('div.hero-day', `${day.name} · ${day.focus}`),
            h('div.hero-chips',
              h('span.chip', iconHTML('clock', 12), plan.duration + ' 分钟'),
              h('span.chip', iconHTML('target', 12), day.items.length + ' 个动作'),
              h('span.chip', iconHTML('chart', 12), (prog.totalSets) + ' 组')
            )
          )
        )
      );

      const btnText = doneToday
        ? '今日已完成 · 查看记录'
        : prog.doneSets > 0
          ? `继续训练 (${prog.doneSets}/${prog.totalSets})`
          : '开始训练';
      hero.appendChild(
        h('button.btn.hero-btn', {
          onclick: () => App.go('workout', { planId: plan.id, dayIndex: dayIdx })
        }, btnText)
      );
    } else {
      hero.appendChild(
        h('div.hero-rest', { style: { textAlign: 'center', padding: '10px 0 4px' } },
          h('div.hero-rest-ic', iconHTML('trophy', 34)),
          h('div.hero-rest-t', '今天是休息日'),
          h('div.hero-rest-s', '肌肉在休息时才会增长，安排一次拉伸或散步吧')
        )
      );
    }

    // ---------------------------------------------- 计划切换入口
    hero.appendChild(
      h('div.hero-plan', { onclick: () => App.tab('plans') },
        h('div', { style: { flex: '1', minWidth: '0' } },
          h('div.hero-plan-l', '当前计划'),
          h('div.hero-plan-n', plan.name)
        ),
        h('div.hero-plan-c', '更换', iconHTML('chevron', 14))
      )
    );

    body.appendChild(h('div.card', { style: { margin: '12px 12px 0', borderRadius: '14px' } }, hero));

    // ---------------------------------------------- 四个数据格
    body.appendChild(
      h('div.stat-row',
        statCell('本周训练', st.weekSessions + '/' + st.weekTarget, '次', 'green'),
        statCell('连续打卡', st.streak, '天', 'orange'),
        statCell('累计容量', (st.totalVolume / 1000).toFixed(1), '吨', 'blue'),
        statCell('累计时长', Math.round(st.totalMinutes / 60), '小时', 'purple')
      )
    );

    // ---------------------------------------------- 本周日程
    const weekRow = h('div.week-row');
    const start = S.addDays(new Date(), -((new Date().getDay() + 6) % 7));
    for (let i = 0; i < 7; i++) {
      const d = S.addDays(start, i);
      const key = S.isoDay(d);
      const rec = S.records.find(r => r.date === key);
      const isToday = key === S.isoDay(new Date());
      const dow = (d.getDay() + 6) % 7;
      // 计划里这天是否该练
      let planned = null;
      const diff = Math.floor(
        (d - S.parseDay(S.state.planStartDate || S.isoDay(start))) / 86400000
      );
      if (diff >= 0) {
        const c = Math.floor(diff / plan.daysPerWeek);
        const r = diff - c * plan.daysPerWeek;
        if (r < plan.days.length) planned = r;
      }
      weekRow.appendChild(
        h('div.week-cell' + (isToday ? '.today' : '') + (rec ? '.done' : ''),
          h('div.week-dow', WEEK_CN[dow]),
          h('div.week-day', d.getDate()),
          h('div.week-dot', rec ? '✓' : planned != null ? '' : '')
        )
      );
    }
    body.appendChild(
      h('div.card', { style: { marginTop: '12px' } },
        h('div.card-pad', { style: { paddingBottom: '4px' } },
          h('div.sect-row',
            h('div.sect-t', '本周日程'),
            h('div.sect-x', `完成 ${st.weekSessions}/${st.weekTarget} 次`)
          )
        ),
        h('div', { style: { padding: '4px 10px 12px' } }, weekRow)
      )
    );

    // ---------------------------------------------- 今日动作清单
    if (day) {
      const list = h('div.exe-list');
      day.items.forEach((it, i) => {
        const ex = UI.EX_INDEX[it.eid];
        if (!ex) return;
        const doneSets = S.getSetDone(plan.id, dayIdx, i);
        const full = doneSets >= it.sets;
        list.appendChild(
          h('div.exe-row', {
            class: full ? 'full' : '',
            onclick: () => App.go('workout', { planId: plan.id, dayIndex: dayIdx, focus: i })
          },
            h('div.exe-thumb', UI.img(ex.img, ex.n)),
            h('div.exe-main',
              h('div.exe-name', ex.n),
              h('div.exe-spec',
                h('span.tag.green', it.sets + ' 组'),
                h('span.tag', it.reps + ' 次'),
                h('span.tag.orange', '休息 ' + it.rest + 's')
              )
            ),
            h('div.exe-check' + (full ? '.on' : ''), full ? '✓' : doneSets + '/' + it.sets)
          )
        );
      });

      body.appendChild(
        h('div.card',
          h('div.card-pad', { style: { paddingBottom: '8px' } },
            h('div.sect-row',
              h('div.sect-t', '今日动作清单'),
              h('div.sect-x.more', { onclick: () => App.go('workout', { planId: plan.id, dayIndex: dayIdx }) }, '全部', iconHTML('chevron', 12))
            )
          ),
          list
        )
      );
    }

    // ---------------------------------------------- 快捷入口
    const quick = h('div.quick-row',
      quickCell('动作库', '查标准动作', 'book', 'blue', () => App.tab('exercises')),
      quickCell('选计划', '换训练分化', 'calendar', 'green', () => App.tab('plans')),
      quickCell('我的数据', '看身体变化', 'user', 'purple', () => App.tab('profile'))
    );
    body.appendChild(quick);

    body.appendChild(
      h('div.foot-tip', '数据存于本机浏览器 · 演示用')
    );

    root.appendChild(body);
  }

  function statCell(label, val, unit, color) {
    return h('div.stat-cell',
      h('div.stat-v.' + color, val, h('i', unit)),
      h('div.stat-l', label)
    );
  }

  function quickCell(title, sub, ic, color, onclick) {
    return h('div.quick-cell', { onclick },
      h('div.quick-ic.' + color, { html: iconHTML(ic, 20) }),
      h('div.quick-t', title),
      h('div.quick-s', sub)
    );
  }

  global.PageHome = { render, title: '健身助手' };
})(window);
