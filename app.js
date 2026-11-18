/* Трекер развивающих игр — PWA. Данные в localStorage, синхронизации с сервером нет. */

const STATUS = {
  done:    { label: 'Готово',         cls: 'done'    },
  wip:     { label: 'Доделать',       cls: 'wip'     },
  prep:    { label: 'Подготовить',    cls: 'prep'    },
  rare:    { label: 'Играет редко',   cls: 'rare'    },
  mastered:{ label: 'Освоено, легко', cls: 'mastered'}
};
const STATUS_ORDER = ['done', 'wip', 'prep', 'rare', 'mastered'];

const KEY = 'kid-games-v1';
const OPEN_KEY = 'kid-games-open-v1';
const DOW = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

let S = load();
let ui = {
  tab: 'games',
  status: 'all',
  q: '',
  range: '7',
  actId: null,
  newStatus: 'done',
  newColor: '#b3543f',
  date: todayKey(),
  editMode: false,
  dragId: null
};
let openCats = loadOpen();

/* ---------- storage ---------- */
function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(raw){
      const d = JSON.parse(raw);
      if(d && d.activities && d.categories) return d;
    }
  }catch(e){ console.warn('load failed', e); }
  const seed = JSON.parse(JSON.stringify(window.SEED));
  seed.days = seed.days || {};
  return seed;
}
function save(){
  try{ localStorage.setItem(KEY, JSON.stringify(S)); }
  catch(e){ toast('Не удалось сохранить'); }
}
function loadOpen(){
  try{
    const raw = localStorage.getItem(OPEN_KEY);
    if(raw) return new Set(JSON.parse(raw));
  }catch(e){}
  return new Set();
}
function saveOpen(){
  try{ localStorage.setItem(OPEN_KEY, JSON.stringify(Array.from(openCats))); }catch(e){}
}

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const catById = id => S.categories.find(c => c.id === id);
const actById = id => S.activities.find(a => a.id === id);
const uid = p => p + Math.random().toString(36).slice(2, 9);

function plural(n, one, few, many){
  const m10 = n % 10, m100 = n % 100;
  if(m10 === 1 && m100 !== 11) return one;
  if(m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
function actWord(n){ return plural(n, 'занятие', 'занятия', 'занятий'); }

function todayKey(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function shiftDate(key, n){
  const [y,m,d] = key.split('-').map(Number);
  const dt = new Date(y, m-1, d+n);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
function isFuture(key){ return key > todayKey(); }
function dayLabel(key){
  const t = todayKey();
  if(key === t) return 'Сегодня';
  if(key === shiftDate(t,-1)) return 'Вчера';
  if(key === shiftDate(t,1)) return 'Завтра';
  if(key === shiftDate(t,-2)) return 'Позавчера';
  if(key === shiftDate(t,2)) return 'Послезавтра';
  return null;
}
function dateFullLabel(key){
  const dl = dayLabel(key);
  const [y,m,d] = key.split('-').map(Number);
  const wd = DOW[new Date(y, m-1, d).getDay()];
  return dl ? `${dl}, ${d} ${MONTHS[m-1]}` : `${d} ${MONTHS[m-1]}, ${wd}`;
}
function fmtDate(key){
  const [y,m,d] = key.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  return `${d} ${MONTHS[m-1]}, ${DOW[dt.getDay()]}`;
}
function shortDate(key){
  const [y,m,d] = key.split('-').map(Number);
  return `${d} ${MONTHS[m-1]}`;
}
function daysAgo(n){
  const out = [];
  const d = new Date();
  for(let i=0;i<n;i++){
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()-i);
    out.push(`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`);
  }
  return out;
}

/* ---------- render: аккордеон категорий ---------- */
function renderGames(){
  const q = ui.q.trim().toLowerCase();
  const list = S.activities.filter(a => {
    if(ui.status !== 'all' && a.status !== ui.status) return false;
    if(q){
      const c = catById(a.cat);
      if(!a.name.toLowerCase().includes(q) && !(c && c.name.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const tk = ui.date;
  const playedToday = new Set((S.days[tk] || []).map(x => x.id));
  const future = isFuture(tk);

  const groups = new Map();
  list.forEach(a => {
    if(!groups.has(a.cat)) groups.set(a.cat, []);
    groups.get(a.cat).push(a);
  });

  // поиск всегда раскрывает все подходящие категории
  const searching = q.length > 0;
  const ordered = S.categories.filter(c => groups.has(c.id));

  $('#gameList').innerHTML = ordered.map(c => {
    const acts = groups.get(c.id);
    const isOpen = searching || openCats.has(c.id) || ui.editMode;
    const totalInCat = S.activities.filter(a => a.cat === c.id).length;
    const playedCount = acts.filter(a => playedToday.has(a.id)).length;
    const badgeText = future ? 'в плане' : 'сегодня';

    const head =
      `<button class="acc__head" data-toggle="${c.id}" type="button" aria-expanded="${isOpen}">
        <span class="acc__chevron" aria-hidden="true"></span>
        <span class="acc__bar" style="background:${c.color}"></span>
        <span class="acc__name">${esc(c.name)}</span>
        ${playedCount ? `<span class="acc__today">${playedCount} ${badgeText}</span>` : ''}
        <span class="acc__count">${ui.editMode ? totalInCat : acts.length}</span>
      </button>` +
      (ui.editMode
        ? `<div class="acc__catmanage">
             <button class="row__move" data-catmove="${c.id}" type="button" aria-label="Перенести занятия категории">⇅</button>
             <button class="row__del" data-catdel="${c.id}" type="button" aria-label="Удалить категорию">✕</button>
           </div>`
        : '');

    const body = acts.map(a => {
      const st = STATUS[a.status] || STATUS.wip;
      const played = playedToday.has(a.id);
      const draggable = ui.editMode ? ' draggable="true"' : '';
      const moveBtns = ui.editMode
        ? `<button class="row__move" data-move="${a.id}" type="button" aria-label="Переместить">⇅</button>`
        : '';
      const delBtn = ui.editMode
        ? `<button class="row__del" data-del="${a.id}" type="button" aria-label="Удалить занятие">✕</button>`
        : '';
      return `<div class="row" data-row="${a.id}"${draggable}>
        <button class="row__mark ${played ? 'is-on' : ''}" data-mark="${a.id}" type="button"
          aria-pressed="${played}" aria-label="${played ? 'Убрать отметку' : (future ? 'Добавить в план' : 'Отметить как сыгранное')}">
          <span class="row__tick" aria-hidden="true"></span>
        </button>
        <button class="row__main" data-open="${a.id}" type="button">
          <span class="row__name">${esc(a.name)}</span>
          <span class="row__status badge badge--${st.cls}">${esc(st.label)}</span>
        </button>
        ${moveBtns}${delBtn}
      </div>`;
    }).join('');

    return `<section class="acc__group ${isOpen ? 'is-open' : ''}" data-group="${c.id}">
      ${head}
      <div class="acc__body">${body}</div>
    </section>`;
  }).join('');

  $('#gameEmpty').hidden = list.length > 0;
  $('#btnExpandAll').textContent = searching ? 'Свернуть' : (ordered.length && ordered.every(c => openCats.has(c.id)) ? 'Свернуть' : 'Развернуть');
}

function renderStatusChips(){
  const counts = {};
  S.activities.forEach(a => counts[a.status] = (counts[a.status] || 0) + 1);
  $('#statusChips').innerHTML =
    `<button class="chip ${ui.status==='all'?'is-on':''}" data-st="all" type="button">Все</button>` +
    STATUS_ORDER.map(k =>
      `<button class="chip ${ui.status===k?'is-on':''}" data-st="${k}" type="button">${esc(STATUS[k].label)} · ${counts[k]||0}</button>`
    ).join('');
}

/* ---------- render: последние дни ---------- */
function renderRecent(){
  const today = todayKey();
  // «в последние дни» — прошлое до сегодня, без будущих планов
  const past = [];
  for(let i=1;i<=14;i++) past.push(shiftDate(today, -i));
  const keys = past.filter(k => (S.days[k] || []).length).reverse();

  if(!keys.length){
    $('#recentList').innerHTML = '';
    $('#recentEmpty').hidden = false;
    $('#recentBlock').classList.add('is-empty');
    return;
  }
  $('#recentEmpty').hidden = true;
  $('#recentBlock').classList.remove('is-empty');

  $('#recentList').innerHTML = keys.map(k => {
    const items = S.days[k].map(it => {
      const a = actById(it.id);
      const c = a ? catById(a.cat) : null;
      const name = a ? a.name : '(удалённое занятие)';
      const dot = c ? `<span class="rday__dot" style="background:${c.color}"></span>` : '';
      const note = it.note ? `<span class="rday__note">${esc(it.note)}</span>` : '';
      return `<li class="rday__item">${dot}<span class="rday__name">${esc(name)}</span>${note}</li>`;
    }).join('');
    const rel = shortDate(k);
    const wd = DOW[new Date(...k.split('-').map((v,i)=> i===1 ? +v-1 : +v)).getDay()];
    return `<div class="rday">
      <div class="rday__date">${esc(rel)}${wd ? ' · ' + esc(wd) : ''}</div>
      <ul class="rday__items">${items}</ul>
    </div>`;
  }).join('');
}

/* ---------- render: план на будущее ---------- */
function renderPlan(){
  const today = todayKey();
  const futureKeys = Object.keys(S.days)
    .filter(k => k > today && (S.days[k]||[]).length)
    .sort();

  if(!futureKeys.length){
    $('#planBlock').hidden = true;
    return;
  }
  $('#planBlock').hidden = false;

  $('#planList').innerHTML = futureKeys.map(k => {
    const items = S.days[k].map(it => {
      const a = actById(it.id);
      const c = a ? catById(a.cat) : null;
      const name = a ? a.name : '(удалённое занятие)';
      const dot = c ? `<span class="rday__dot" style="background:${c.color}"></span>` : '';
      const note = it.note ? `<span class="rday__note">${esc(it.note)}</span>` : '';
      return `<li class="rday__item">${dot}<span class="rday__name">${esc(name)}</span>${note}</li>`;
    }).join('');
    const dl = dayLabel(k);
    const wd = DOW[new Date(...k.split('-').map((v,i)=> i===1 ? +v-1 : +v)).getDay()];
    return `<div class="rday">
      <div class="rday__date">${esc(dl || shortDate(k))}${dl ? ' · ' + esc(wd) : ''}</div>
      <ul class="rday__items">${items}</ul>
    </div>`;
  }).join('');
}

/* ---------- render: журнал ---------- */
function renderJournal(){
  let keys = Object.keys(S.days).filter(k => (S.days[k] || []).length).sort().reverse();
  if(ui.range !== 'all'){
    const n = parseInt(ui.range, 10);
    const allow = new Set(daysAgo(n));
    // планы на ближайшие дни тоже показываем
    const today = todayKey();
    for(let i=1;i<=n;i++) allow.add(shiftDate(today, i));
    keys = keys.filter(k => allow.has(k));
  }
  const today = todayKey();
  const html = keys.map(k => {
    const items = S.days[k].map(it => {
      const a = actById(it.id);
      const c = a ? catById(a.cat) : null;
      const name = a ? a.name : '(удалённое занятие)';
      const cat = c ? esc(c.name) : '';
      const note = it.note ? `<div class="day__item__note">${esc(it.note)}</div>` : '';
      return `<div class="day__item">
          <div class="day__item__name">${esc(name)}${note}</div>
          ${cat ? `<div class="day__item__cat">${cat}</div>` : ''}
        </div>`;
    }).join('');
    const dl = dayLabel(k);
    const rel = k === today ? ' · сегодня' : (k > today ? ' · план' : '');
    const full = fmtDate(k);
    const wd = full.split(', ').slice(1).join(', ');
    const head = dl ? `${dl}, ${full.split(', ')[0]}, ${wd}` : full;
    return `<div class="day ${k > today ? 'day--future' : ''}">
      <div class="day__head"><span class="day__date">${esc(head)}${esc(rel)}</span></div>
      <div class="day__items">${items}</div>
    </div>`;
  }).join('');
  $('#journalList').innerHTML = html;
  $('#journalEmpty').hidden = keys.length > 0;
}

/* ---------- render: сводка ---------- */
function renderStats(){
  const allDays = Object.keys(S.days).filter(k => (S.days[k]||[]).length);
  const playedIds = new Set();
  allDays.forEach(k => S.days[k].forEach(i => playedIds.add(i.id)));

  const in7 = new Set(daysAgo(7));
  let plays7 = 0;
  allDays.forEach(k => { if(in7.has(k)) plays7 += S.days[k].length; });

  $('#statRow').innerHTML = `
    <div class="stat"><div class="stat__num">${S.activities.length}</div><div class="stat__lbl">занятий в списке</div></div>
    <div class="stat"><div class="stat__num">${S.categories.length}</div><div class="stat__lbl">категорий</div></div>
    <div class="stat"><div class="stat__num">${plays7}</div><div class="stat__lbl">игр за 7 дней</div></div>
    <div class="stat"><div class="stat__num">${playedIds.size}</div><div class="stat__lbl">разных игр сыграно</div></div>`;

  const catPlay = {};
  S.activities.forEach(a => catPlay[a.cat] = 0);
  allDays.forEach(k => S.days[k].forEach(i => {
    const a = actById(i.id);
    if(a) catPlay[a.cat]++;
  }));
  const counts = {};
  S.activities.forEach(a => counts[a.cat] = (counts[a.cat]||0)+1);
  const max = Math.max(1, ...Object.values(catPlay));

  $('#catStats').innerHTML = S.categories.map(c => {
    const n = catPlay[c.id] || 0;
    const total = counts[c.id] || 0;
    return `<div class="catstat">
      <span class="cat-head__bar" style="background:${c.color};height:26px;flex:0 0 3px"></span>
      <span class="catstat__name">${esc(c.name)}</span>
      <span class="catstat__bar"><span class="catstat__fill" style="display:block;width:${(n/max*100).toFixed(1)}%;background:${c.color}"></span></span>
      <span class="catstat__num">${n}/${total}</span>
    </div>`;
  }).join('');
}

/* ---------- render all ---------- */
function render(){
  renderStatusChips();
  renderGames();
  renderRecent();
  renderPlan();
  renderJournal();
  renderStats();
  renderDateBar();
  const d = new Date();
  $('#todayLine').textContent = `${d.getDate()} ${MONTHS[d.getMonth()]} · ${DOW[d.getDay()]}`;
}

function renderDateBar(){
  const k = ui.date;
  const today = todayKey();
  const [y,m,d] = k.split('-').map(Number);
  const wd = DOW[new Date(y, m-1, d).getDay()];
  const dl = dayLabel(k);
  $('#dateMain').textContent = dl || `${d} ${MONTHS[m-1]}`;
  $('#dateSub').textContent = dl ? wd : `${d} ${MONTHS[m-1]}, ${wd}`;
  $('#datePick').value = k;

  const mark = document.querySelector('#datePick');
  if(mark){
    mark.max = shiftDate(today, 365);
    mark.min = shiftDate(today, -365);
  }

  // подсветка активной быстрой кнопки
  $$('#dateQuick .chip').forEach(ch => {
    const q = ch.dataset.qd;
    let target = null;
    if(q === 'today') target = today;
    else if(q === 'yesterday') target = shiftDate(today,-1);
    else if(q === 'tomorrow') target = shiftDate(today,1);
    else if(q === 'week') target = shiftDate(today,7);
    ch.classList.toggle('is-on', target === k);
  });
}

function setDate(k){
  ui.date = k;
  render();
}

/* ---------- sheets ---------- */
function openSheet(id){ $(id).hidden = false; document.body.style.overflow = 'hidden'; }
function closeAllSheets(){ $$('.sheet').forEach(s => s.hidden = true); document.body.style.overflow = ''; ui.moveFromCat = null; }

function openActSheet(id){
  const a = actById(id);
  if(!a) return;
  ui.actId = id;
  const c = catById(a.cat);
  const tk = ui.date;
  const rec = (S.days[tk] || []).find(x => x.id === id);
  const future = isFuture(tk);

  $('#sheetTitle').textContent = a.name;
  $('#sheetCat').textContent = (c ? c.name : '') + ' · ' + dateFullLabel(tk);
  $('#lblPlayed').textContent = future ? 'План на эту дату' : 'Отметка';
  $('#btnMarkPlayed').textContent = rec
    ? (future ? '✓ Убрать из плана' : '✓ Убрать отметку')
    : (future ? 'Запланировать' : 'Отметить как сыгранное');
  $('#btnMarkPlayed').classList.toggle('btn--primary', !rec);
  $('#lblNote').textContent = future ? 'Заметка к плану' : 'Что получилось';
  $('#noteBlock').hidden = !rec;
  $('#noteInput').value = rec ? (rec.note || '') : '';
  renderSheetStatuses(a.status);
  openSheet('#sheet');
}

function renderSheetStatuses(current){
  $('#sheetStatuses').innerHTML = STATUS_ORDER.map(k =>
    `<button class="chip ${current===k?'is-on':''}" data-setst="${k}" type="button">${esc(STATUS[k].label)}</button>`
  ).join('');
}

/* ---------- actions ---------- */
function togglePlayed(id){
  const tk = ui.date;
  if(!S.days[tk]) S.days[tk] = [];
  const arr = S.days[tk];
  const i = arr.findIndex(x => x.id === id);
  if(i >= 0) arr.splice(i, 1);
  else arr.push({ id, note: '' });
  if(!arr.length) delete S.days[tk];
  save(); render();
}

function setStatus(id, st){
  const a = actById(id);
  if(!a) return;
  a.status = st;
  save(); render();
}

function addActivity(name, catId, status){
  S.activities.push({ id: uid('a'), cat: catId, name: name.trim(), status, note: '' });
  openCats.add(catId);
  saveOpen();
  save(); render();
  toast('Добавлено');
}

function addCategory(name, color){
  const id = uid('c');
  S.categories.push({ id, name: name.trim(), color });
  openCats.add(id);
  saveOpen();
  save(); render();
  toast('Категория добавлена');
}

function deleteActivity(id){
  S.activities = S.activities.filter(a => a.id !== id);
  Object.keys(S.days).forEach(k => { S.days[k] = S.days[k].filter(x => x.id !== id); });
  save(); render();
  toast('Удалено');
}

function renameActivity(id, name){
  const a = actById(id);
  if(!a || !name.trim()) return;
  a.name = name.trim();
  save(); render();
}

let toastTimer = null;
function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2000);
}

/* ---------- управление списком ---------- */
function setEditMode(on){
  ui.editMode = on;
  if(on) S.categories.forEach(c => openCats.add(c.id));
  saveOpen();
  render();
  const btn = $('#btnEditMode');
  btn.classList.toggle('is-on', on);
  btn.setAttribute('aria-pressed', String(on));
  btn.innerHTML = on
    ? '<span class="editbtn__ico" aria-hidden="true">✓</span> Готово'
    : '<span class="editbtn__ico" aria-hidden="true">✎</span> Управлять списком';
}

function moveActivity(id, catId){
  const a = actById(id);
  if(!a || a.cat === catId) return;
  a.cat = catId;
  save(); render();
  toast('Перенесено');
}

function openCatDelete(catId){
  const c = catById(catId);
  if(!c) return;
  const n = S.activities.filter(a => a.cat === catId).length;
  const others = S.categories.filter(x => x.id !== catId);
  $('#sheet4Title').textContent = `Категория «${c.name}»`;
  $('#sheet4Sub').textContent = n
    ? `В ней ${n} ${actWord(n)}. Выберите, куда их перенести, или удалите вместе с ними.`
    : 'Категория пустая — её можно просто удалить.';
  $('#catMoveTo').innerHTML = others.length
    ? others.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')
    : '<option value="">— нет других категорий —</option>';
  $('#btnCatMove').disabled = !others.length;
  $('#btnCatDeleteAll').textContent = n ? `Удалить категорию и ${n} ${actWord(n)}` : 'Удалить категорию';
  ui.delCatId = catId;
  openSheet('#sheet4');
}

function deleteCategory(catId){
  S.activities = S.activities.filter(a => a.cat !== catId);
  S.categories = S.categories.filter(c => c.id !== catId);
  Object.keys(S.days).forEach(k => {
    const ids = S.activities.map(a => a.id);
    S.days[k] = S.days[k].filter(x => ids.includes(x.id));
  });
  openCats.delete(catId);
  saveOpen(); save(); render();
}

/* перетаскивание: меняем порядок внутри категории */
function reorder(dragId, targetId, catId){
  const list = S.activities.filter(a => a.cat === catId);
  const from = list.findIndex(a => a.id === dragId);
  const to = list.findIndex(a => a.id === targetId);
  if(from < 0 || to < 0 || from === to) return;
  const moved = list.splice(from, 1)[0];
  list.splice(to, 0, moved);
  // пересобираем порядок массива activities по новому порядку внутри категории
  const others = S.activities.filter(a => a.cat !== catId);
  S.activities = others.concat(list);
  save(); render();
}

function openMoveSheet(ids){
  const arr = Array.isArray(ids) ? ids : [ids];
  const first = actById(arr[0]);
  const isMany = arr.length > 1;
  const curCat = first ? first.cat : null;
  $('#sheet5Title').textContent = isMany ? 'Перенести занятия' : 'Перенести в категорию';
  $('#sheet5Sub').textContent = isMany
    ? `${arr.length} ${actWord(arr.length)} — выберите новую категорию`
    : (first ? first.name : '');

  const targets = S.categories.filter(c => c.id !== curCat);
  if(!targets.length){
    $('#moveTargets').innerHTML = '<p class="sheet-cat">Нет других категорий. Сначала создайте категорию в разделе «Сводка».</p>';
  }else{
    $('#moveTargets').innerHTML = targets.map(c => {
      const n = S.activities.filter(a => a.cat === c.id).length;
      return `<button class="movetarget" data-target="${c.id}" type="button">
        <span class="movetarget__bar" style="background:${c.color}"></span>
        <span class="movetarget__name">${esc(c.name)}</span>
        <span class="movetarget__n">${n}</span>
      </button>`;
    }).join('');
  }
  ui.moveIds = arr;
  ui.moveSingle = isMany ? null : arr[0];
  $('#moveOrder').hidden = isMany;
  openSheet('#sheet5');
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if(tab){
    $$('.tab').forEach(t => { t.classList.remove('is-active'); t.setAttribute('aria-selected','false'); });
    tab.classList.add('is-active'); tab.setAttribute('aria-selected','true');
    ui.tab = tab.dataset.tab;
    $$('.view').forEach(v => v.classList.remove('is-active'));
    $('#view-' + ui.tab).classList.add('is-active');
    window.scrollTo(0,0);
    return;
  }

  // режим редактирования
  if(e.target.closest('#btnEditMode')){ setEditMode(!ui.editMode); return; }

  // удалить занятие
  const del = e.target.closest('[data-del]');
  if(del){
    e.stopPropagation();
    const a = actById(del.dataset.del);
    if(a && confirm(`Удалить занятие «${a.name}»?`)) deleteActivity(a.id);
    return;
  }

  // перенести занятие
  const move = e.target.closest('[data-move]');
  if(move){
    e.stopPropagation();
    ui.moveFromCat = null;
    openMoveSheet(move.dataset.move);
    return;
  }

  // удалить категорию
  const catDel = e.target.closest('[data-catdel]');
  if(catDel){
    e.stopPropagation();
    openCatDelete(catDel.dataset.catdel);
    return;
  }

  // перенести все занятия категории
  const catMove = e.target.closest('[data-catmove]');
  if(catMove){
    e.stopPropagation();
    const catId = catMove.dataset.catmove;
    const ids = S.activities.filter(a => a.cat === catId).map(a => a.id);
    if(!ids.length){ toast('Категория пустая'); return; }
    ui.moveFromCat = catId;
    openMoveSheet(ids);
    return;
  }

  // раскрыть/свернуть категорию
  const head = e.target.closest('.acc__head');
  if(head){
    const id = head.dataset.toggle;
    if(openCats.has(id)) openCats.delete(id); else openCats.add(id);
    saveOpen();
    renderGames();
    return;
  }

  // отметить игру — одним тапом по кружку
  const mark = e.target.closest('[data-mark]');
  if(mark){
    e.stopPropagation();
    togglePlayed(mark.dataset.mark);
    return;
  }

  // открыть карточку занятия (заметка, статус)
  const open = e.target.closest('[data-open]');
  if(open){ openActSheet(open.dataset.open); return; }

  const stChip = e.target.closest('.chip[data-st]');
  if(stChip){ ui.status = stChip.dataset.st; renderGames(); renderStatusChips(); return; }

  const setSt = e.target.closest('.chip[data-setst]');
  if(setSt){
    const k = setSt.dataset.setst;
    setStatus(ui.actId, k);
    renderSheetStatuses(k);
    return;
  }

  const newSt = e.target.closest('.chip[data-newst]');
  if(newSt){ ui.newStatus = newSt.dataset.newst; renderNewStatuses(); return; }

  const dot = e.target.closest('.color-dot');
  if(dot){ ui.newColor = dot.dataset.color; renderColorPick(); return; }

  const seg = e.target.closest('.seg-btn');
  if(seg){
    $$('.seg-btn').forEach(s => s.classList.remove('is-active'));
    seg.classList.add('is-active');
    ui.range = seg.dataset.range;
    renderJournal();
    return;
  }

  const target = e.target.closest('[data-target]');
  if(target){
    const ids = ui.moveIds || [];
    ids.forEach(id => { const a = actById(id); if(a) a.cat = target.dataset.target; });
    // если переносили всю категорию — убираем пустую исходную
    if(ui.moveFromCat){
      const left = S.activities.filter(a => a.cat === ui.moveFromCat).length;
      if(!left){
        S.categories = S.categories.filter(c => c.id !== ui.moveFromCat);
        openCats.delete(ui.moveFromCat);
        saveOpen();
      }
      ui.moveFromCat = null;
    }
    save(); render(); closeAllSheets();
    toast('Перенесено');
    return;
  }

  if(e.target.closest('[data-close]')){ closeAllSheets(); return; }
});

document.addEventListener('input', e => {
  if(e.target.id === 'search'){ ui.q = e.target.value; renderGames(); }
  if(e.target.id === 'noteInput'){
    const tk = ui.date;
    const rec = (S.days[tk] || []).find(x => x.id === ui.actId);
    if(rec){ rec.note = e.target.value; save(); renderJournal(); renderStats(); renderRecent(); renderPlan(); }
  }
});

$('#datePrev').addEventListener('click', () => setDate(shiftDate(ui.date, -1)));
$('#dateNext').addEventListener('click', () => setDate(shiftDate(ui.date, 1)));
$('#datePick').addEventListener('change', e => {
  if(e.target.value) setDate(e.target.value);
});
$('#dateLabel').addEventListener('click', () => {
  const pick = $('#datePick');
  if(typeof pick.showPicker === 'function'){
    try{ pick.showPicker(); return; }catch(e){}
  }
  pick.focus();
  pick.click();
});
document.addEventListener('click', e => {
  const q = e.target.closest('[data-qd]');
  if(!q) return;
  const today = todayKey();
  const map = { today, yesterday: shiftDate(today,-1), tomorrow: shiftDate(today,1), week: shiftDate(today,7) };
  if(map[q.dataset.qd]) setDate(map[q.dataset.qd]);
});

$('#btnExpandAll').addEventListener('click', () => {
  const all = S.categories.map(c => c.id);
  const allOpen = all.every(id => openCats.has(id));
  if(allOpen) all.forEach(id => openCats.delete(id));
  else all.forEach(id => openCats.add(id));
  saveOpen();
  renderGames();
});

$('#btnMarkPlayed').addEventListener('click', () => {
  togglePlayed(ui.actId);
  const tk = ui.date;
  const rec = (S.days[tk] || []).find(x => x.id === ui.actId);
  const future = isFuture(tk);
  $('#btnMarkPlayed').textContent = rec
    ? (future ? '✓ Убрать из плана' : '✓ Убрать отметку')
    : (future ? 'Запланировать' : 'Отметить как сыгранное');
  $('#btnMarkPlayed').classList.toggle('btn--primary', !rec);
  $('#noteBlock').hidden = !rec;
  if(rec) $('#noteInput').value = rec.note || '';
});

$('#btnEditAct').addEventListener('click', () => {
  const a = actById(ui.actId);
  if(!a) return;
  const name = prompt('Новое название занятия:', a.name);
  if(name !== null && name.trim()){ renameActivity(a.id, name); $('#sheetTitle').textContent = name.trim(); }
});

$('#btnDelAct').addEventListener('click', () => {
  if(confirm('Удалить занятие?')){ deleteActivity(ui.actId); closeAllSheets(); }
});

$('#btnAdd').addEventListener('click', () => {
  $('#newName').value = '';
  $('#newCat').innerHTML = S.categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  ui.newStatus = 'done';
  renderNewStatuses();
  openSheet('#sheet2');
  setTimeout(() => $('#newName').focus(), 120);
});

function renderNewStatuses(){
  $('#newStatuses').innerHTML = STATUS_ORDER.map(k =>
    `<button class="chip ${ui.newStatus===k?'is-on':''}" data-newst="${k}" type="button">${esc(STATUS[k].label)}</button>`
  ).join('');
}

$('#formNew').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#newName').value.trim();
  const cat = $('#newCat').value;
  if(!name){ toast('Введите название'); return; }
  addActivity(name, cat, ui.newStatus);
  closeAllSheets();
});

$('#btnAddCat').addEventListener('click', () => {
  $('#catName').value = '';
  ui.newColor = '#b3543f';
  renderColorPick();
  openSheet('#sheet3');
  setTimeout(() => $('#catName').focus(), 120);
});

function renderColorPick(){
  const palette = ['#b3543f','#5b7fa6','#7a6bab','#3f8f6b','#c98a3a','#4a8f9c','#a85a8f','#6b8f3f','#b06a3f','#8f6b4a','#3d6b9c','#a35d5d'];
  $('#colorPick').innerHTML = palette.map(c =>
    `<button class="color-dot ${ui.newColor===c?'is-on':''}" style="background:${c}" data-color="${c}" type="button" aria-label="Цвет ${c}"></button>`
  ).join('');
}

$('#formCat').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#catName').value.trim();
  if(!name){ toast('Введите название'); return; }
  addCategory(name, ui.newColor);
  closeAllSheets();
});

$('#btnExport').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(S, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `igry-igr-${todayKey()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Файл сохранён');
});

$('#btnImport').addEventListener('click', () => $('#fileImport').click());

$('#fileImport').addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const d = JSON.parse(reader.result);
      if(!d.activities || !d.categories) throw new Error('bad format');
      if(!confirm('Заменить текущие данные импортированными?')) return;
      S = d; S.days = S.days || {};
      save(); render(); closeAllSheets();
      toast('Импортировано');
    }catch(err){ toast('Не удалось прочитать файл'); }
  };
  reader.readAsText(f);
  e.target.value = '';
});

function shiftInCat(id, dir){
  const a = actById(id);
  if(!a) return;
  const list = S.activities.filter(x => x.cat === a.cat);
  const i = list.findIndex(x => x.id === id);
  const j = i + dir;
  if(j < 0 || j >= list.length){ toast(dir < 0 ? 'Уже первое' : 'Уже последнее'); return; }
  const moved = list.splice(i, 1)[0];
  list.splice(j, 0, moved);
  const others = S.activities.filter(x => x.cat !== a.cat);
  S.activities = others.concat(list);
  save(); render();
  toast(dir < 0 ? 'Выше' : 'Ниже');
}

$('#btnMoveUp').addEventListener('click', () => {
  if(ui.moveSingle) shiftInCat(ui.moveSingle, -1);
});
$('#btnMoveDown').addEventListener('click', () => {
  if(ui.moveSingle) shiftInCat(ui.moveSingle, 1);
});

$('#btnCatMove').addEventListener('click', () => {
  const to = $('#catMoveTo').value;
  if(!to) return;
  const from = ui.delCatId;
  S.activities.forEach(a => { if(a.cat === from) a.cat = to; });
  S.categories = S.categories.filter(c => c.id !== from);
  openCats.delete(from);
  saveOpen(); save(); render(); closeAllSheets();
  toast('Занятия перенесены');
});

$('#btnCatDeleteAll').addEventListener('click', () => {
  const from = ui.delCatId;
  const c = catById(from);
  const n = S.activities.filter(a => a.cat === from).length;
  if(!confirm(`Удалить категорию «${c ? c.name : ''}»${n ? ` и ${n} ${actWord(n)}` : ''}? Это необратимо.`)) return;
  deleteCategory(from);
  closeAllSheets();
  toast('Удалено');
});

$('#btnReset').addEventListener('click', () => {
  if(!confirm('Удалить все данные и вернуть исходный список из 54 занятий?')) return;
  localStorage.removeItem(KEY);
  S = JSON.parse(JSON.stringify(window.SEED));
  S.days = {};
  save(); render();
  toast('Сброшено');
});

/* ---------- drag & drop (сортировка) ---------- */
document.addEventListener('dragstart', e => {
  const row = e.target.closest('[data-row]');
  if(!row || !ui.editMode) return;
  ui.dragId = row.dataset.row;
  row.classList.add('is-dragging');
  e.dataTransfer.effectAllowed = 'move';
  try{ e.dataTransfer.setData('text/plain', ui.dragId); }catch(err){}
});

document.addEventListener('dragend', e => {
  document.querySelectorAll('.is-dragging').forEach(el => el.classList.remove('is-dragging'));
  document.querySelectorAll('.row--over').forEach(el => el.classList.remove('row--over'));
  ui.dragId = null;
});

document.addEventListener('dragover', e => {
  if(!ui.editMode || !ui.dragId) return;
  const row = e.target.closest('[data-row]');
  if(!row || row.dataset.row === ui.dragId) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.row--over').forEach(el => el.classList.remove('row--over'));
  row.classList.add('row--over');
});

document.addEventListener('drop', e => {
  if(!ui.editMode || !ui.dragId) return;
  const row = e.target.closest('[data-row]');
  if(!row) return;
  e.preventDefault();
  const dragId = ui.dragId;
  const targetId = row.dataset.row;
  const dragAct = actById(dragId);
  const targetAct = actById(targetId);
  if(dragAct && targetAct){
    if(dragAct.cat === targetAct.cat) reorder(dragId, targetId, dragAct.cat);
    else moveActivity(dragId, targetAct.cat);
  }
  document.querySelectorAll('.row--over').forEach(el => el.classList.remove('row--over'));
});

/* ---------- boot ---------- */
render();

if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW failed', err));
  });
}
