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
const DOW = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

let S = load();
let ui = { tab: 'games', cat: 'all', status: 'all', q: '', range: '7', actId: null, newStatus: 'done', newColor: '#b3543f' };

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

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const catById = id => S.categories.find(c => c.id === id);
const actById = id => S.activities.find(a => a.id === id);
const uid = p => p + Math.random().toString(36).slice(2, 9);

function todayKey(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDate(key){
  const [y,m,d] = key.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  return `${d} ${MONTHS[m-1]}, ${DOW[dt.getDay()]}`;
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

/* ---------- render: games ---------- */
function renderGames(){
  const q = ui.q.trim().toLowerCase();
  const list = S.activities.filter(a => {
    if(ui.cat !== 'all' && a.cat !== ui.cat) return false;
    if(ui.status !== 'all' && a.status !== ui.status) return false;
    if(q){
      const c = catById(a.cat);
      if(!a.name.toLowerCase().includes(q) && !(c && c.name.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const tk = todayKey();
  const playedToday = new Set((S.days[tk] || []).map(x => x.id));

  const groups = new Map();
  list.forEach(a => {
    if(!groups.has(a.cat)) groups.set(a.cat, []);
    groups.get(a.cat).push(a);
  });

  const ordered = S.categories.filter(c => groups.has(c.id));

  $('#gameList').innerHTML = ordered.map(c => {
    const acts = groups.get(c.id);
    return `<div class="cat-head">
        <span class="cat-head__bar" style="background:${c.color}"></span>
        <span>${esc(c.name)}</span>
        <span class="cat-head__count">${acts.length}</span>
      </div>` + acts.map(a => {
        const st = STATUS[a.status] || STATUS.wip;
        const played = playedToday.has(a.id);
        return `<button class="game" data-id="${a.id}" type="button">
          <span class="game__body">
            <span class="game__name">${esc(a.name)}</span>
            <span class="game__meta">
              <span class="badge badge--${st.cls}">${esc(st.label)}</span>
              ${played ? '<span class="played"><span class="played__dot"></span>играли сегодня</span>' : ''}
            </span>
          </span>
          <span class="game__check ${played ? 'is-played' : (a.status==='done' ? 'is-done' : '')}" aria-hidden="true"></span>
        </button>`;
      }).join('');
  }).join('');

  $('#gameEmpty').hidden = list.length > 0;
}

function renderCatChips(){
  const counts = {};
  S.activities.forEach(a => counts[a.cat] = (counts[a.cat] || 0) + 1);
  $('#catChips').innerHTML =
    `<button class="chip ${ui.cat==='all'?'is-on':''}" data-cat="all" type="button">Все · ${S.activities.length}</button>` +
    S.categories.map(c =>
      `<button class="chip ${ui.cat===c.id?'is-on':''}" data-cat="${c.id}" type="button">
         <span class="chip__dot" style="background:${c.color}"></span>${esc(c.name)} · ${counts[c.id]||0}
       </button>`).join('');
}

function renderStatusChips(){
  const counts = {};
  S.activities.forEach(a => counts[a.status] = (counts[a.status] || 0) + 1);
  $('#statusChips').innerHTML =
    `<button class="chip ${ui.status==='all'?'is-on':''}" data-st="all" type="button">Любой статус</button>` +
    STATUS_ORDER.map(k => {
      const st = STATUS[k];
      return `<button class="chip ${ui.status===k?'is-on':''}" data-st="${k}" type="button">${esc(st.label)} · ${counts[k]||0}</button>`;
    }).join('');
}

/* ---------- render: journal ---------- */
function renderJournal(){
  let keys = Object.keys(S.days).filter(k => (S.days[k] || []).length).sort().reverse();
  if(ui.range !== 'all'){
    const allow = new Set(daysAgo(parseInt(ui.range, 10)));
    keys = keys.filter(k => allow.has(k));
  }
  const tk = todayKey();
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
    const rel = k === tk ? ' · сегодня' : '';
    return `<div class="day">
      <div class="day__head"><span class="day__date">${esc(fmtDate(k))}${esc(rel)}</span></div>
      <div class="day__items">${items}</div>
    </div>`;
  }).join('');
  $('#journalList').innerHTML = html;
  $('#journalEmpty').hidden = keys.length > 0;
}

/* ---------- render: stats ---------- */
function renderStats(){
  const tk = todayKey();
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
  renderCatChips();
  renderStatusChips();
  renderGames();
  renderJournal();
  renderStats();
  const d = new Date();
  $('#todayLine').textContent = `${d.getDate()} ${MONTHS[d.getMonth()]} · ${DOW[d.getDay()]}`;
}

/* ---------- sheets ---------- */
function openSheet(id){ $(id).hidden = false; document.body.style.overflow = 'hidden'; }
function closeAllSheets(){ $$('.sheet').forEach(s => s.hidden = true); document.body.style.overflow = ''; }

function openActSheet(id){
  const a = actById(id);
  if(!a) return;
  ui.actId = id;
  const c = catById(a.cat);
  const tk = todayKey();
  const day = S.days[tk] || [];
  const rec = day.find(x => x.id === id);

  $('#sheetTitle').textContent = a.name;
  $('#sheetCat').textContent = c ? c.name : '';
  $('#btnMarkPlayed').textContent = rec ? '✓ Убрать отметку' : 'Отметить как сыгранное';
  $('#btnMarkPlayed').classList.toggle('btn--primary', !rec);
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
  const tk = todayKey();
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
  save(); render();
  toast('Добавлено');
}

function addCategory(name, color){
  S.categories.push({ id: uid('c'), name: name.trim(), color });
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

  const chip = e.target.closest('.chip[data-cat]');
  if(chip){ ui.cat = chip.dataset.cat; renderGames(); renderCatChips(); return; }

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

  const game = e.target.closest('.game');
  if(game){ openActSheet(game.dataset.id); return; }

  const seg = e.target.closest('.seg-btn');
  if(seg){
    $$('.seg-btn').forEach(s => s.classList.remove('is-active'));
    seg.classList.add('is-active');
    ui.range = seg.dataset.range;
    renderJournal();
    return;
  }

  if(e.target.closest('[data-close]')){ closeAllSheets(); return; }
});

document.addEventListener('input', e => {
  if(e.target.id === 'search'){ ui.q = e.target.value; renderGames(); }
  if(e.target.id === 'noteInput'){
    const tk = todayKey();
    const rec = (S.days[tk] || []).find(x => x.id === ui.actId);
    if(rec){ rec.note = e.target.value; save(); renderJournal(); renderStats(); }
  }
});

$('#btnMarkPlayed').addEventListener('click', () => {
  togglePlayed(ui.actId);
  const tk = todayKey();
  const rec = (S.days[tk] || []).find(x => x.id === ui.actId);
  $('#btnMarkPlayed').textContent = rec ? '✓ Убрать отметку' : 'Отметить как сыгранное';
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

$('#btnReset').addEventListener('click', () => {
  if(!confirm('Удалить все данные и вернуть исходный список из 54 занятий?')) return;
  localStorage.removeItem(KEY);
  S = JSON.parse(JSON.stringify(window.SEED));
  S.days = {};
  save(); render();
  toast('Сброшено');
});

/* ---------- boot ---------- */
render();

if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW failed', err));
  });
}
