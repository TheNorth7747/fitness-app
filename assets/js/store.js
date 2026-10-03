/* ============================================================
   Store — 全局状态 + localStorage 持久化
   模拟小程序 globalData，页面通过 Store.get() 读取
   ============================================================ */
(function (global) {
  'use strict';

  const KEY = 'fitness_mvp_v1';

  /** 默认状态：首次进入的初始画像 */
  function defaults() {
    return {
      // 身体数据
      profile: {
        name: '健身新手',
        age: 26,
        height: 175, // cm
        weight: 72.5, // kg
        bodyFat: 21.5, // %
        gender: 'male',
        goal: '增肌塑形',
        updatedAt: null
      },
      // 身体数据历史（用于趋势图）
      bodyHistory: [],

      // 当前训练计划
      currentPlanId: 'beginner-full',
      planStartDate: null, // ISO date string
      // 计划里每个训练日的完成进度： { 'planId': { dayIndex: {doneSets,totalSets,done} } }
      planProgress: {},

      // 训练记录
      // { date:'2026-10-03', planId, dayIndex, dayName, focus, sets:[{eid,done}], volume, minutes }
      records: [],

      // 收藏的动作 id
      favorites: [],

      // 动作库筛选记忆
      lastFilter: { q: '', bp: '', eq: '', t: '' }
    };
  }

  // 注意：state 的初始化必须延后到文件末尾。
  // seed() 会用到 EX_INDEX（部位分布统计），而 EX_INDEX 依赖 EXERCISES，
  // 若在声明前调用会触发 TDZ 错误：Cannot access 'EX_INDEX' before initialization。
  let state = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return seed(defaults());
      const parsed = JSON.parse(raw);
      // 浅合并，保证新增字段有默认值
      const d = defaults();
      return Object.assign(d, parsed, {
        profile: Object.assign(d.profile, parsed.profile || {}),
        lastFilter: Object.assign(d.lastFilter, parsed.lastFilter || {})
      });
    } catch (e) {
      console.warn('[Store] 读取本地数据失败，使用默认值', e);
      return seed(defaults());
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[Store] 保存失败', e);
    }
  }

  /** 首次进入：给一份看起来像真实用户的历史记录，便于展示统计 */
  function seed(s) {
    const today = new Date();
    s.planStartDate = isoDay(addDays(today, -23));
    s.bodyHistory = [];
    // 体重从 74.2 逐步降到 72.5，体脂从 23.4 降到 21.5
    const wStart = 74.2, wEnd = 72.5;
    const fStart = 23.4, fEnd = 21.5;
    for (let i = 8; i >= 0; i--) {
      const t = (8 - i) / 8;
      const d = addDays(today, -i * 6);
      s.bodyHistory.push({
        date: isoDay(d),
        weight: +(wStart + (wEnd - wStart) * t).toFixed(1),
        bodyFat: +(fStart + (fEnd - fStart) * t).toFixed(1)
      });
    }
    s.profile.weight = wEnd;
    s.profile.bodyFat = fEnd;
    s.profile.updatedAt = isoDay(addDays(today, -2));

    // 过去 3 周的已完成训练。
    // 注意从「昨天」开始而不是今天：今天要留给用户自己练，
    // 否则首页会显示 0% 但训练页又提示「今日已完成」，自相矛盾。
    const plan = global.PLANS.find(p => p.id === s.currentPlanId);
    if (plan) {
      const pattern = [1, 2, 4, 7, 9, 11, 14, 16, 18, 20]; // 距今天数
      pattern.forEach((ago, idx) => {
        const dayIdx = idx % plan.days.length;
        const day = plan.days[dayIdx];
        const date = addDays(today, -ago);
        if (date > today) return;
        const totalSets = day.items.reduce((a, b) => a + b.sets, 0);
        s.records.push({
          date: isoDay(date),
          planId: plan.id,
          dayIndex: dayIdx,
          dayName: day.name,
          focus: day.focus,
          sets: totalSets,
          setsDone: totalSets,
          volume: estimateVolume(day, idx),
          minutes: plan.duration,
          parts: partsOfDay(day),
          done: true
        });
      });
      s.records.sort((a, b) => (a.date < b.date ? 1 : -1));
    }
    save();
    return s;
  }

  /** 动作 id → 动作数据 索引 */
  const EX_INDEX = {};
  (global.EXERCISES || []).forEach(e => { EX_INDEX[e.id] = e; });

  /** 某个训练日涉及哪些身体部位 */
  function partsOfDay(day) {
    const map = {};
    day.items.forEach(it => {
      const ex = EX_INDEX[it.eid];
      if (ex) map[ex.bp] = true;
    });
    return Object.keys(map);
  }

  function estimateVolume(day, idx) {
    // 用一个随时间小幅递增的估算容量，让统计图看起来有训练痕迹
    let v = 0;
    day.items.forEach((it, i) => {
      v += it.sets * (28 + ((idx * 7 + i * 11) % 26));
    });
    return v;
  }

  // ------------------------------------------------------ 日期工具
  function isoDay(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  }
  function addDays(d, n) {
    const x = new Date(d.getTime());
    x.setDate(x.getDate() + n);
    return x;
  }
  function parseDay(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  // ------------------------------------------------------ 计划进度
  function dayKey(planId, dayIndex) {
    return planId + '#' + dayIndex;
  }

  /** 今天的训练日索引：按计划开始日循环分配 */
  function todayDayIndex(planId) {
    const plan = global.PLANS.find(p => p.id === planId);
    if (!plan) return 0;
    const start = state.planStartDate ? parseDay(state.planStartDate) : new Date();
    const today = new Date();
    const diff = Math.floor(
      (new Date(today.getFullYear(), today.getMonth(), today.getDate()) -
        new Date(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000
    );
    const cycle = Math.floor(diff / plan.daysPerWeek);
    const restDayInCycle = diff - cycle * plan.daysPerWeek;
    if (restDayInCycle >= plan.days.length) return -1; // 休息日
    return restDayInCycle;
  }

  function getDayProgress(planId, dayIndex) {
    const p = state.planProgress[dayKey(planId, dayIndex)];
    if (p) return p;
    const plan = global.PLANS.find(x => x.id === planId);
    const day = plan && plan.days[dayIndex];
    return {
      done: false,
      doneSets: 0,
      totalSets: day ? day.items.reduce((a, b) => a + b.sets, 0) : 0
    };
  }

  function setDayProgress(planId, dayIndex, patch) {
    const cur = getDayProgress(planId, dayIndex);
    state.planProgress[dayKey(planId, dayIndex)] = Object.assign(cur, patch);
    save();
  }

  /** 切换某个动作的一组完成状态 */
  function toggleSet(planId, dayIndex, itemIndex) {
    const plan = global.PLANS.find(p => p.id === planId);
    const day = plan.days[dayIndex];
    const item = day.items[itemIndex];
    const k = dayKey(planId, dayIndex);
    if (!state.planProgress[k]) {
      state.planProgress[k] = {
        done: false,
        doneSets: 0,
        totalSets: day.items.reduce((a, b) => a + b.sets, 0),
        items: {}
      };
    }
    const st = state.planProgress[k];
    if (!st.items) st.items = {};
    const key = String(itemIndex);
    // 每个动作有 sets 组，展开成 itemIndex-setIndex 计数
    if (!st.sets_) st.sets_ = {};
    const sk = key;
    st.sets_[sk] = st.sets_[sk] || 0;
    if (st.sets_[sk] >= item.sets) st.sets_[sk] = 0;
    else st.sets_[sk] += 1;
    st.doneSets = Object.values(st.sets_).reduce((a, b) => a + b, 0);
    st.done = st.doneSets >= st.totalSets;
    save();
    return st;
  }

  function getSetDone(planId, dayIndex, itemIndex) {
    const k = dayKey(planId, dayIndex);
    const st = state.planProgress[k];
    if (!st || !st.sets_) return 0;
    return st.sets_[String(itemIndex)] || 0;
  }

  /** 完成整日训练 → 写入训练记录 */
  function completeDay(planId, dayIndex) {
    const plan = global.PLANS.find(p => p.id === planId);
    const day = plan.days[dayIndex];
    const today = isoDay(new Date());
    // 同一天同一训练日只记一次
    const exist = state.records.find(
      r => r.date === today && r.planId === planId && r.dayIndex === dayIndex
    );
    const rec = {
      date: today,
      planId,
      dayIndex,
      dayName: day.name,
      focus: day.focus,
      sets: day.items.reduce((a, b) => a + b.sets, 0),
      volume: Math.round(day.items.reduce((a, b) => a + b.sets * 42, 0)),
      minutes: plan.duration,
      parts: partsOfDay(day),
      done: true
    };
    if (exist) Object.assign(exist, rec);
    else state.records.unshift(rec);
    setDayProgress(planId, dayIndex, { done: true, doneSets: rec.sets });
    save();
    return rec;
  }

  function undoDay(planId, dayIndex) {
    const today = isoDay(new Date());
    state.records = state.records.filter(
      r => !(r.date === today && r.planId === planId && r.dayIndex === dayIndex)
    );
    const k = dayKey(planId, dayIndex);
    if (state.planProgress[k]) {
      state.planProgress[k] = { done: false, doneSets: 0, sets_: {} };
      const plan = global.PLANS.find(p => p.id === planId);
      state.planProgress[k].totalSets =
        plan.days[dayIndex].items.reduce((a, b) => a + b.sets, 0);
    }
    save();
  }

  // ------------------------------------------------------ 身体数据
  function saveProfile(patch) {
    Object.assign(state.profile, patch, { updatedAt: isoDay(new Date()) });
    const t = isoDay(new Date());
    const last = state.bodyHistory[state.bodyHistory.length - 1];
    if (!last || last.date !== t) {
      state.bodyHistory.push({
        date: t,
        weight: state.profile.weight,
        bodyFat: state.profile.bodyFat
      });
      if (state.bodyHistory.length > 30) state.bodyHistory.shift();
    } else {
      last.weight = state.profile.weight;
      last.bodyFat = state.profile.bodyFat;
    }
    save();
  }

  /** BMI */
  function bmi() {
    const h = state.profile.height / 100;
    return +(state.profile.weight / (h * h)).toFixed(1);
  }

  function bmiLabel(v) {
    if (v < 18.5) return { t: '偏瘦', c: 'blue' };
    if (v < 24) return { t: '正常', c: 'green' };
    if (v < 28) return { t: '超重', c: 'orange' };
    return { t: '肥胖', c: 'red' };
  }

  /** 体脂率评价（按性别） */
  function fatLabel(v, gender) {
    const t = [
      { m: 18, f: 25 },
      { m: 13, f: 20 },
      { m: 18, f: 25 },
      { m: 25, f: 32 }
    ];
    const i = v < t[0].m || v < t[0].f ? 0 : v < t[1].m || v < t[1].f ? 1 : v < t[2].m || v < t[2].f ? 2 : 3;
    return ['很低', '正常', '偏高', '过高'][i];
  }

  // ------------------------------------------------------ 统计
  function stats() {
    const recs = state.records;
    const now = new Date();
    // 本周（周一起）
    const dow = (now.getDay() + 6) % 7;
    const monday = addDays(now, -dow);
    const week = recs.filter(r => parseDay(r.date) >= new Date(monday.getFullYear(), monday.getMonth(), monday.getDate()));
    const plan = global.PLANS.find(p => p.id === state.currentPlanId);
    const weekTarget = plan ? plan.daysPerWeek : 3;

    // 连续打卡：从今天（或昨天）往回数连续训练天数
    let streak = 0;
    const set = new Set(recs.map(r => r.date));
    let cursor = 0;
    if (!set.has(isoDay(now))) cursor = 1; // 今天还没练，从昨天开始数
    for (let i = cursor; i < 400; i++) {
      if (set.has(isoDay(addDays(now, -i)))) streak++;
      else break;
    }

    const last30 = recs.filter(r => parseDay(r.date) >= addDays(now, -30));

    return {
      totalSessions: recs.length,
      totalVolume: recs.reduce((a, b) => a + (b.volume || 0), 0),
      totalMinutes: recs.reduce((a, b) => a + (b.minutes || 0), 0),
      weekSessions: week.length,
      weekTarget,
      weekDoneRate: weekTarget ? Math.min(100, Math.round((week.length / weekTarget) * 100)) : 0,
      streak,
      monthSessions: last30.length,
      monthVolume: last30.reduce((a, b) => a + (b.volume || 0), 0)
    };
  }

  /** 最近 n 天的训练热力（用于「我的」页打卡日历） */
  function heatmap(days) {
    const out = [];
    const now = new Date();
    const recs = state.records;
    for (let i = days - 1; i >= 0; i--) {
      const d = addDays(now, -i);
      const key = isoDay(d);
      const r = recs.find(x => x.date === key);
      out.push({
        date: key,
        day: d.getDate(),
        dow: (d.getDay() + 6) % 7, // 0=周一
        done: !!r,
        volume: r ? r.volume : 0
      });
    }
    return out;
  }

  /** 部位训练分布（统计记录里各动作所属部位） */
  function partDistribution() {
    const map = {};
    state.records.forEach(r => {
      (r.parts || []).forEach(p => {
        map[p] = (map[p] || 0) + 1;
      });
    });
    return map;
  }

  // ------------------------------------------------------ 收藏
  function toggleFav(id) {
    const i = state.favorites.indexOf(id);
    if (i >= 0) state.favorites.splice(i, 1);
    else state.favorites.push(id);
    save();
    return state.favorites.includes(id);
  }
  function isFav(id) {
    return state.favorites.includes(id);
  }

  // ------------------------------------------------------ 计划切换
  function applyPlan(id) {
    state.currentPlanId = id;
    state.planStartDate = isoDay(new Date());
    state.planProgress = {};
    save();
  }

  function reset() {
    localStorage.removeItem(KEY);
    state = seed(defaults());
  }

  // ------------------------------------------------------ 初始化（放在所有声明之后）
  state = load();

  global.Store = {
    get state() { return state; },
    get profile() { return state.profile; },
    get plans() { return global.PLANS; },
    get records() { return state.records; },
    save, defaults,
    todayDayIndex, getDayProgress, setDayProgress, toggleSet, getSetDone,
    completeDay, undoDay,
    saveProfile, bmi, bmiLabel, fatLabel,
    stats, heatmap, partDistribution, toggleFav, isFav, applyPlan, reset,
    isoDay, addDays, parseDay
  };
})(window);
