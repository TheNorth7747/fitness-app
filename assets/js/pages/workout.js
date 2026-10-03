/* ============================================================
   页面：训练执行页
   逐个动作打卡（按组数递增），全部完成 → 写入训练记录
   ============================================================ */
(function (global) {
  'use strict';
  const { h, $ } = UI;
  const S = global.Store;

  let planId = null, dayIndex = 0;

  function render(root, params) {
    planId = params.planId;
    dayIndex = params.dayIndex;
    const plan = S.plans.find(p => p.id === planId);
    if (!plan || !plan.days[dayIndex]) {
      root.innerHTML = '<div class="empty">训练日不存在</div>';
      return;
    }
    const day = plan.days[dayIndex];
    const doneToday = S.records.some(
      r => r.date === S.isoDay(new Date()) && r.planId === planId && r.dayIndex === dayIndex
    );
    root.innerHTML = '';

    // ---------------------------------------------- 头部进度
    const head = h('div.wk-hd');
    const bar = h('div.wk-bar-fill');
    const txt = h('div.wk-hd-n', '0/' + day.items.reduce((a, b) => a + b.sets, 0) + ' 组');

    function paintHead() {
      const prog = S.getDayProgress(planId, dayIndex);
      const pct = prog.totalSets ? (prog.doneSets / prog.totalSets) * 100 : 0;
      bar.style.width = pct + '%';
      txt.textContent = prog.doneSets + '/' + prog.totalSets + ' 组';
    }
    paintHead();

    head.appendChild(h('div.wk-hd-row',
      h('div',
        h('div.wk-hd-day', day.name),
        h('div.wk-hd-focus', day.focus)
      ),
      h('div.wk-hd-right', txt)
    ));
    head.appendChild(h('div.wk-bar', bar));

    root.appendChild(head);

    if (doneToday) {
      root.appendChild(
        h('div.wk-done-banner',
          h('span', { html: UI.iconHTML('check', 15) }),
          h('div', { style: { flex: '1' } },
            h('div', '今日训练已完成'),
            h('div.wk-done-s', '可在「我的」查看累计数据')
          )
        )
      );
    }

    // ---------------------------------------------- 动作列表
    const listWrap = h('div.wk-list');
    day.items.forEach((it, i) => {
      const ex = UI.EX_INDEX[it.eid];
      if (!ex) return;
      const doneN = S.getSetDone(planId, dayIndex, i);
      const full = doneN >= it.sets;

      const setDots = h('div.wk-sets');
      for (let s = 0; s < it.sets; s++) {
        setDots.appendChild(h('span.wk-set-dot' + (s < doneN ? '.on' : ''), String(s + 1)));
      }

      const row = h('div.wk-item' + (full ? '.full' : ''),
        h('div.wk-item-main', { onclick: () => global.PageExercises.openDetail(ex) },
          UI.img(ex.img, ex.n),
          h('div.wk-item-m',
            h('div.wk-item-n', ex.n),
            h('div.wk-item-s',
              h('span', it.sets + ' 组 × ' + it.reps + ' 次'),
              h('span.wk-item-rest', '休息 ' + it.rest + 's')
            ),
            h('div.wk-item-tags',
              h('span.tag', ex.t),
              h('span.tag.blue', ex.eq)
            )
          ),
          h('div.wk-item-c', { html: UI.iconHTML('chevron', 14) })
        ),
        h('div.wk-item-foot',
          h('div.wk-sets', ...Array.from(setDots.children)),
          h('button.wk-check' + (full ? '.on' : ''), {
            onclick: function () {
              S.toggleSet(planId, dayIndex, i);
              const n = S.getSetDone(planId, dayIndex, i);
              const isFull = n >= it.sets;
              this.classList.toggle('on', isFull);
              this.textContent = isFull ? '已完成' : n + '/' + it.sets;
              // 更新组点
              const dots = this.parentElement.querySelectorAll('.wk-set-dot');
              dots.forEach((d, di) => d.classList.toggle('on', di < n));
              row.classList.toggle('full', isFull);
              paintHead();
              checkFinish();
            }
          }, full ? '已完成' : doneN + '/' + it.sets)
        )
      );
      listWrap.appendChild(row);
    });
    root.appendChild(listWrap);

    // ---------------------------------------------- 底部完成按钮
    const foot = h('div.wk-foot');
    const btn = h('button.btn.block', {
      onclick: () => {
        const prog = S.getDayProgress(planId, dayIndex);
        if (!prog.done || prog.doneSets < prog.totalSets) {
          // 还有未完成的组
          if (confirm('还有动作没有完成全部组数，确定要提前结束这次训练吗？')) {
            finish(false);
          }
          return;
        }
        finish(true);
      }
    }, '完成训练');
    foot.appendChild(btn);
    if (doneToday) {
      foot.appendChild(
        h('button.wk-undo', { onclick: () => {
          if (confirm('撤销今天这条训练记录？')) {
            S.undoDay(planId, dayIndex);
            UI.toast('已撤销');
            render(root, params);
          }
        } }, '撤销今日记录')
      );
    }
    root.appendChild(foot);

    function finish(allDone) {
      S.completeDay(planId, dayIndex);
      UI.toast(allDone ? '训练完成！已记录本次训练 🎉' : '已记录本次训练');
      render(root, params);
    }

    function checkFinish() {
      const prog = S.getDayProgress(planId, dayIndex);
      btn.textContent = prog.doneSets >= prog.totalSets
        ? '完成训练 🎉'
        : `完成训练（还剩 ${prog.totalSets - prog.doneSets} 组）`;
    }
    checkFinish();
  }

  global.PageWorkout = { render, title: '训练执行' };
})(window);
