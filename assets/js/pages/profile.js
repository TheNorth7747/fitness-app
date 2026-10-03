/* ============================================================
   页面：我的
   身体数据（体重/身高/体脂/年龄/BMI）+ 计划执行情况 + 训练历史
   ============================================================ */
(function (global) {
  'use strict';
  const { h, $, toast, sparkline } = UI;
  const S = global.Store;

  function render(root) {
    root.innerHTML = '';
    const st = S.stats();
    const p = S.profile;
    const bmiV = S.bmi();
    const bl = S.bmiLabel(bmiV);

    // ---------------------------------------------- 个人信息头
    root.appendChild(
      h('div.me-hero',
        h('div.me-avatar', { html: avatarArt(p.gender) }),
        h('div.me-id',
          h('div.me-name', p.name),
          h('div.me-meta',
            h('span', p.gender === 'female' ? '女' : '男'),
            h('span.i', '·'),
            h('span', p.age + ' 岁'),
            h('span.i', '·'),
            h('span', p.goal)
          )
        ),
        h('button.me-edit', { onclick: () => openEdit(), html: UI.iconHTML('edit', 15) })
      )
    );

    // ---------------------------------------------- 身体数据
    const body = h('div.me-grid',
      bodyCell('体重', p.weight, 'kg'),
      bodyCell('身高', p.height, 'cm'),
      bodyCell('体脂率', p.bodyFat, '%', S.fatLabel(p.bodyFat, p.gender)),
      bodyCell('BMI', bmiV, '', bl.t, bl.c)
    );
    root.appendChild(
      h('div.card',
        h('div.card-pad', { style: { paddingBottom: '8px' } },
          h('div.sect-row',
            h('div.sect-t', '身体数据'),
            h('div.sect-x.more', { onclick: () => openEdit() }, '编辑', UI.iconHTML('chevron', 12))
          )
        ),
        h('div', { style: { padding: '0 8px 12px' } }, body)
      )
    );

    // ---------------------------------------------- 身体趋势
    const hist = S.state.bodyHistory;
    if (hist.length >= 2) {
      const wVals = hist.map(x => x.weight);
      const fVals = hist.map(x => x.bodyFat);
      const first = hist[0], last = hist[hist.length - 1];
      const dw = (last.weight - first.weight).toFixed(1);
      const df = (last.bodyFat - first.bodyFat).toFixed(1);

      root.appendChild(
        h('div.card',
          h('div.card-pad', { style: { paddingBottom: '2px' } },
            h('div.sect-row', h('div.sect-t', '身体趋势'), h('div.sect-x', `近 ${hist.length} 次记录`)),
            h('div.me-trend',
              trendRow('体重', wVals, first.weight, last.weight, dw, '#07c160', 'kg'),
              trendRow('体脂率', fVals, first.bodyFat, last.bodyFat, df, '#fa9d3b', '%')
            )
          )
        )
      );
    }

    // ---------------------------------------------- 计划执行情况
    const plan = S.plans.find(x => x.id === S.state.currentPlanId) || S.plans[0];
    const dayIdx = S.todayDayIndex(plan.id);

    root.appendChild(
      h('div.card',
        h('div.card-pad', { style: { paddingBottom: '10px' } },
          h('div.sect-row',
            h('div.sect-t', '计划执行情况'),
            h('div.sect-x.more', { onclick: () => App.tab('plans') }, '更换计划', UI.iconHTML('chevron', 12))
          ),
          h('div.me-plan',
            h('div.me-plan-l',
              h('div.me-plan-n', plan.name),
              h('div.me-plan-s', `${plan.daysPerWeek} 天/周 · 开始于 ${S.state.planStartDate || '—'}`)
            ),
            h('div.me-plan-badge',
              h('div.me-plan-pct', st.weekDoneRate + '%'),
              h('div.me-plan-pct-l', '本周完成')
            )
          ),
          h('div.me-week-bar',
            ...weekBars(plan)
          ),
          h('div.me-week-legend',
            h('span', h('i.dot.done'), '已完成'),
            h('span', h('i.dot.today'), '今天'),
            h('span', h('i.dot.plan'), '计划内'),
            h('span', h('i.dot.rest'), '休息')
          )
        )
      )
    );

    // ---------------------------------------------- 累计数据
    root.appendChild(
      h('div.card',
        h('div.card-pad', { style: { paddingBottom: '10px' } },
          h('div.sect-row', h('div.sect-t', '训练数据'), null),
          h('div.me-stats',
            h('div.me-stat', h('b', st.totalSessions), h('span', '累计训练')),
            h('div.me-stat', h('b', (st.totalVolume / 1000).toFixed(1)), h('span', '累计容量(吨)')),
            h('div.me-stat', h('b', Math.round(st.totalMinutes / 60)), h('span', '累计时长(时)')),
            h('div.me-stat', h('b', st.streak), h('span', '连续打卡(天)'))
          )
        )
      )
    );

    // ---------------------------------------------- 近 4 周训练频率
    const weeks = last4Weeks();
    root.appendChild(
      h('div.card',
        h('div.card-pad', { style: { paddingBottom: '4px' } },
          h('div.sect-row', h('div.sect-t', '近 4 周训练频率'), null),
          h('div.me-bars',
            ...weeks.map((w, i) =>
              h('div.me-bar-col',
                h('div.me-bar-wrap',
                  h('div.me-bar-fill', {
                    style: {
                      height: Math.min(100, (w.count / Math.max(1, w.target)) * 100) + '%',
                      background: i === weeks.length - 1 ? '#07c160' : '#a8e6c4'
                    }
                  })
                ),
                h('div.me-bar-l', w.count + ''),
                h('div.me-bar-x', w.label)
              )
            )
          )
        )
      )
    );

    // ---------------------------------------------- 部位分布
    const dist = S.partDistribution();
    const distArr = Object.keys(dist).map(k => ({ k, v: dist[k] })).sort((a, b) => b.v - a.v);
    if (distArr.length) {
      const max = distArr[0].v;
      root.appendChild(
        h('div.card',
          h('div.card-pad', { style: { paddingBottom: '12px' } },
            h('div.sect-row', h('div.sect-t', '部位训练分布'), h('div.sect-x', '累计次数')),
            h('div.me-dist',
              ...distArr.map(d =>
                h('div.me-dist-row',
                  h('div.me-dist-n', d.k),
                  h('div.me-dist-bar',
                    h('div.me-dist-fill', { style: { width: (d.v / max * 100) + '%' } })
                  ),
                  h('div.me-dist-v', d.v)
                )
              )
            )
          )
        )
      );
    }

    // ---------------------------------------------- 训练历史
    const recs = S.records.slice(0, 12);
    root.appendChild(
      h('div.card',
        h('div.card-pad', { style: { paddingBottom: '6px' } },
          h('div.sect-row', h('div.sect-t', '训练历史'), h('div.sect-x', `共 ${S.records.length} 条`))
        ),
        recs.length
          ? h('div.me-hist',
              ...recs.map(r => historyRow(r))
            )
          : h('div.empty', { style: { padding: '30px' } }, '还没有训练记录')
      )
    );

    // ---------------------------------------------- 其他
    root.appendChild(
      h('div.card.me-tools',
        toolRow('重置演示数据', '恢复到初始的示例记录', () => {
          if (confirm('确定要重置所有演示数据吗？此操作不可撤销。')) {
            S.reset();
            UI.toast('已重置');
            App.renderAll();
          }
        })
      )
    );

    root.appendChild(h('div.foot-tip', '健身小程序 MVP · 演示原型'));

    // ---------------------------------------------- 编辑身体数据
    function openEdit() {
      const fields = {
        name: { label: '昵称', unit: '', step: '1', min: '', max: '', v: p.name, type: 'text' },
        age: { label: '年龄', unit: '岁', step: '1', min: '10', max: '90', v: p.age, type: 'number' },
        height: { label: '身高', unit: 'cm', step: '0.5', min: '120', max: '230', v: p.height, type: 'number' },
        weight: { label: '体重', unit: 'kg', step: '0.1', min: '30', max: '200', v: p.weight, type: 'number' },
        bodyFat: { label: '体脂率', unit: '%', step: '0.1', min: '3', max: '60', v: p.bodyFat, type: 'number' }
      };
      const inputs = {};
      const rows = Object.keys(fields).map(k => {
        const f = fields[k];
        const inp = h('input.me-in', {
          type: f.type, value: f.v, step: f.step, inputmode: f.type === 'number' ? 'decimal' : 'text'
        });
        inputs[k] = inp;
        return h('div.me-field',
          h('label.me-field-l', f.label),
          h('div.me-field-wrap', inp, f.unit ? h('span.me-field-u', f.unit) : null)
        );
      });

      // 目标选择
      const goals = ['增肌塑形', '减脂', '力量', '塑形', '健康维持'];
      let goal = p.goal;
      const goalRow = h('div.me-goals',
        ...goals.map(g => {
          const c = h('span.chip-opt' + (g === goal ? '.on' : ''), g);
          c.addEventListener('click', function () {
            goal = g;
            goalRow.querySelectorAll('.chip-opt').forEach(x => x.classList.remove('on'));
            this.classList.add('on');
          });
          return c;
        })
      );

      // 性别
      let gender = p.gender;
      const genderRow = h('div.me-goals',
        ...[['male', '男'], ['female', '女']].map(([v, t]) => {
          const c = h('span.chip-opt' + (v === gender ? '.on' : ''), t);
          c.addEventListener('click', function () {
            gender = v;
            genderRow.querySelectorAll('.chip-opt').forEach(x => x.classList.remove('on'));
            this.classList.add('on');
          });
          return c;
        })
      );

      const ov = h('div.sheet-ov',
        h('div.sheet-panel.sheet-half',
          h('div.sheet-grip'),
          h('div.sheet-hd', '编辑身体数据', h('button.sheet-x', { onclick: close }, '×')),
          h('div.me-form', ...rows,
            h('div.me-field', h('label.me-field-l', '性别'), genderRow),
            h('div.me-field', h('label.me-field-l', '训练目标'), goalRow)
          ),
          h('div.divider'),
          h('div', { style: { display: 'flex', gap: '10px', padding: '14px' } },
            h('button.btn.gray', { style: { flex: '1' }, onclick: close }, '取消'),
            h('button.btn', { style: { flex: '2' }, onclick: save }, '保存')
          )
        )
      );
      ov.addEventListener('click', ev => { if (ev.target === ov) close(); });
      $('.screen').appendChild(ov);
      requestAnimationFrame(() => ov.classList.add('show'));

      function save() {
        const patch = { goal, gender };
        Object.keys(fields).forEach(k => {
          if (fields[k].type === 'number') {
            let v = parseFloat(inputs[k].value);
            if (isNaN(v)) { UI.toast('请输入有效的' + fields[k].label); return; }
            if (fields[k].min !== '' && v < +fields[k].min) v = +fields[k].min;
            if (fields[k].max !== '' && v > +fields[k].max) v = +fields[k].max;
            patch[k] = v;
          } else {
            patch[k] = inputs[k].value.trim() || p.name;
          }
        });
        S.saveProfile(patch);
        UI.toast('已保存');
        close();
        render(root);
      }

      function close() {
        ov.classList.remove('show');
        setTimeout(() => ov.remove(), 240);
      }
    }
  }

  // ---------------------------------------------------- 子组件
  function bodyCell(label, val, unit, note, color) {
    return h('div.me-cell',
      h('div.me-cell-l', label),
      h('div.me-cell-v' + (color ? '.' + color : ''), val, unit ? h('i', unit) : null),
      note ? h('div.me-cell-n', note) : null
    );
  }

  function trendRow(label, vals, first, last, delta, color, unit) {
    const up = parseFloat(delta) > 0;
    const good = label === '体重' ? !up : up; // 减脂期体重降、体脂降都算「向好」
    return h('div.me-trend-row',
      h('div.me-trend-l', label),
      h('div.me-trend-c', sparkline(vals, 300, 46, color, true)),
      h('div.me-trend-r',
        h('div.me-trend-v', last, h('i', unit)),
        h('div.me-trend-d' + (good ? '.good' : '.warn'),
          (up ? '+' : '') + delta + unit + (good ? ' ↓' : ' ↑'))
      )
    );
  }

  function historyRow(r) {
    const d = S.parseDay(r.date);
    const wk = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    return h('div.me-hist-row',
      h('div.me-hist-date',
        h('b', (d.getMonth() + 1) + '/' + d.getDate()),
        h('span', wk)
      ),
      h('div.me-hist-m',
        h('div.me-hist-t', r.dayName + ' · ' + r.focus),
        h('div.me-hist-s', r.setsDone || r.sets + ' 组 · ' + r.minutes + ' 分钟 · 容量 ' + (r.volume || 0) + 'kg')
      ),
      h('div.me-hist-c', '✓')
    );
  }

  function toolRow(title, sub, onclick) {
    return h('div.me-tool', { onclick },
      h('div', { style: { flex: '1' } },
        h('div.me-tool-t', title),
        h('div.me-tool-s', sub)
      ),
      h('div.me-tool-c', { html: UI.iconHTML('chevron', 14) })
    );
  }

  /** 本周 7 天格子状态 */
  function weekBars(plan) {
    const start = S.addDays(new Date(), -((new Date().getDay() + 6) % 7));
    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = S.addDays(start, i);
      const key = S.isoDay(d);
      const rec = S.records.find(r => r.date === key);
      const isToday = key === S.isoDay(new Date());
      const diff = Math.floor(
        (new Date(d.getFullYear(), d.getMonth(), d.getDate()) -
          new Date(S.parseDay(S.state.planStartDate || S.isoDay(start)))) / 86400000
      );
      let planned = false;
      if (diff >= 0) {
        const c = Math.floor(diff / plan.daysPerWeek);
        planned = (diff - c * plan.daysPerWeek) < plan.days.length;
      }
      const cls = rec ? '.done' : isToday ? '.today' : planned ? '.plan' : '.rest';
      out.push(h('div.me-wb' + cls, { title: key }, String(d.getDate())));
    }
    return out;
  }

  function last4Weeks() {
    const now = new Date();
    const out = [];
    for (let i = 3; i >= 0; i--) {
      const end = S.addDays(now, -i * 7);
      const start = S.addDays(end, -6);
      const count = S.records.filter(r => {
        const d = S.parseDay(r.date);
        return d >= start && d <= end;
      }).length;
      out.push({
        label: i === 0 ? '本周' : i === 1 ? '上周' : i === 2 ? '前周' : `${4 - i}周前`,
        count,
        target: 4
      });
    }
    return out;
  }

  function avatarArt(gender) {
    return `<svg viewBox="0 0 48 48" width="52" height="52" fill="none" stroke="#fff"
      stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="24" cy="17" r="8.5"/>
      <path d="M9 42c2.5-8.5 8.5-12.5 15-12.5S36.5 33.5 39 42"/>
    </svg>`;
  }

  global.PageProfile = { render, title: '我的' };
})(window);
