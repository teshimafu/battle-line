'use strict';
/* バトルライン クライアント */

const TACTICS = {
  alexander: { name: 'アレキサンダー', mark: 'A', kind: 'morale', desc: '好きな色・数字のワイルド(リーダーは1ゲーム1枚)' },
  darius:    { name: 'ダリウス',       mark: 'D', kind: 'morale', desc: '好きな色・数字のワイルド(リーダーは1ゲーム1枚)' },
  cavalry:   { name: '援軍騎兵',       mark: 'C', kind: 'morale', desc: '好きな色の8として扱う' },
  shield:    { name: '盾兵',           mark: 'S', kind: 'morale', desc: '好きな色の1〜3として扱う' },
  fog:       { name: '霧',             mark: 'F', kind: 'env',    desc: '対象フラッグは合計値のみで判定' },
  mud:       { name: '泥沼',           mark: 'M', kind: 'env',    desc: '対象フラッグは4枚編成になる' },
  scout:     { name: '偵察',           mark: 'Sc', kind: 'guile', desc: '山札から計3枚引き、2枚戻す' },
  redeploy:  { name: '再配置',         mark: 'R', kind: 'guile',  desc: '自分の場のカード1枚を移動/除外' },
  deserter:  { name: '脱走',           mark: 'De', kind: 'guile', desc: '相手の場のカード1枚を除外' },
  traitor:   { name: '裏切り',         mark: 'T', kind: 'guile',  desc: '相手の部隊1枚を自軍に寝返らせる' },
};
const COLOR_VARS = ['--c0', '--c1', '--c2', '--c3', '--c4', '--c5'];

const $ = id => document.getElementById(id);
const api = async (path, opts = {}) => {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `通信エラー (${res.status})`);
  return data;
};

let roomId = null;
let token = null;
let state = null;        // 最新のサーバー状態
let pollTimer = null;
let drawPref = 'troop';
// 操作ステート: {mode:'idle'|'placeCard'|'pickEnemyCard'|'pickMyCard'|'pickDest'|'scoutReturn', ...}
let action = { mode: 'idle' };

/* ---------- 画面遷移 ---------- */

function show(view) {
  for (const v of ['view-home', 'view-waiting', 'view-game']) $(v).hidden = v !== view;
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 2600);
}

function tokenKey(id) { return `bl_token_${id}`; }

async function enterRoom(id) {
  roomId = id.toUpperCase();
  token = localStorage.getItem(tokenKey(roomId));
  try {
    const res = await api(`/api/rooms/${roomId}/join`, { method: 'POST', body: { token } });
    token = res.token;
    localStorage.setItem(tokenKey(roomId), token);
    if (location.pathname !== `/room/${roomId}`) history.pushState({}, '', `/room/${roomId}`);
    startPolling();
  } catch (e) {
    history.replaceState({}, '', '/');
    show('view-home');
    $('home-error').textContent = e.message;
    $('home-error').hidden = false;
  }
}

function startPolling() {
  clearInterval(pollTimer);
  const tick = async () => {
    try {
      const s = await api(`/api/rooms/${roomId}/state?token=${token}`);
      onState(s);
    } catch (e) { /* 一時的な通信断は無視 */ }
  };
  tick();
  pollTimer = setInterval(tick, 1500);
}

function onState(s) {
  state = s;
  if (s.phase === 'waiting') {
    show('view-waiting');
    $('waiting-code').textContent = s.roomId;
    const ready = s.playerCount >= 2;
    $('waiting-status').innerHTML = ready
      ? '対戦相手が参加しました。'
      : '<span class="pulse"></span>対戦相手の参加を待っています…';
    $('btn-start').hidden = !ready;
  } else {
    show('view-game');
    renderGame(s);
  }
}

/* ---------- ゲーム描画 ---------- */

function cardEl(card, { size = 'board' } = {}) {
  const el = document.createElement('div');
  if (card.type === 'troop') {
    el.className = 'card';
    el.style.background = `var(${COLOR_VARS[card.color]})`;
    el.textContent = card.value;
  } else {
    const t = TACTICS[card.key];
    el.className = 'card tactic';
    el.innerHTML = `<span class="t-mark">${t.mark}</span>${t.name}`;
    el.title = t.desc;
  }
  return el;
}

function renderGame(s) {
  const g = s.game;
  if (!g) return;
  const myTurn = g.turn === g.seat && g.winner == null;

  $('opp-troop').textContent = g.oppHand.troop;
  $('opp-tactic').textContent = g.oppHand.tactic;
  $('opp-used').textContent = g.tacticsPlayed[1 - g.seat];
  $('deck-troop').textContent = g.decks.troop;
  $('deck-tactic').textContent = g.decks.tactic;

  const banner = $('turn-banner');
  if (g.winner != null) banner.textContent = 'ゲーム終了';
  else if (g.pendingScout === g.seat) banner.textContent = '偵察:2枚戻してください';
  else banner.textContent = myTurn ? 'あなたの手番' : '相手の手番…';
  banner.classList.toggle('mine', myTurn);

  // 相手手札(裏面): 戦術と部隊で裏面が異なる
  const oppRow = $('opp-hand-row');
  oppRow.innerHTML = '';
  for (let i = 0; i < g.oppHand.tactic; i++) {
    const b = document.createElement('div'); b.className = 'card-back tactic-back'; b.title = '戦術カード'; oppRow.appendChild(b);
  }
  for (let i = 0; i < g.oppHand.troop; i++) {
    const b = document.createElement('div'); b.className = 'card-back'; b.title = '部隊カード'; oppRow.appendChild(b);
  }

  renderBoard(g, myTurn);
  renderHand(g, myTurn);
  renderHint(g, myTurn);

  $('btn-pass').hidden = !(myTurn && g.canPass && g.pendingScout == null && action.mode === 'idle');
  $('btn-cancel-action').hidden = action.mode === 'idle' || action.mode === 'scoutReturn';

  const logs = $('log-panel');
  logs.innerHTML = g.log.map(l => `<div>${escapeHtml(l)}</div>`).join('');
  logs.scrollTop = logs.scrollHeight;

  const over = $('result-overlay');
  if (g.winner != null) {
    over.hidden = false;
    const won = g.winner === g.seat;
    $('result-title').textContent = won ? '勝利!' : '敗北…';
    $('result-reason').textContent = `${won ? 'あなた' : '相手'}が${g.winReason}しました。`;
  } else over.hidden = true;
}

function renderBoard(g, myTurn) {
  const board = $('board');
  board.innerHTML = '';
  g.flags.forEach((f, fi) => {
    const lane = document.createElement('div');
    lane.className = 'lane';

    // 相手側(上)
    const theirs = document.createElement('div');
    theirs.className = 'slot-col theirs';
    f.theirs.forEach((c, ci) => {
      const el = cardEl(c);
      if (myTurn && f.winner == null && isEnemyCardPickable(c)) {
        el.classList.add('selectable-target');
        el.addEventListener('click', () => pickEnemyCard(fi, ci, c));
      }
      theirs.appendChild(el);
    });
    if (action.mode === 'pickEnemyCard' && f.winner == null && f.theirs.length) theirs.classList.add('droppable-enemy');

    // 中央: フラッグ + 環境
    const mid = document.createElement('div');
    const flag = document.createElement('div');
    flag.className = 'flag-marker' + (f.winner === 'you' ? ' flag-you' : f.winner === 'opp' ? ' flag-opp' : '');
    flag.innerHTML = `⚑<span class="flag-num">${fi + 1}</span>`;
    mid.appendChild(flag);
    const env = document.createElement('div');
    env.className = 'env-row';
    f.env.forEach(k => {
      const chip = document.createElement('span');
      chip.className = 'env-chip';
      chip.textContent = TACTICS[k].name;
      env.appendChild(chip);
    });
    mid.appendChild(env);

    // 自分側(下)
    const mine = document.createElement('div');
    mine.className = 'slot-col';
    f.mine.forEach((c, ci) => {
      const el = cardEl(c);
      if (myTurn && f.winner == null && action.mode === 'pickMyCard') {
        el.classList.add('selectable-target');
        el.addEventListener('click', () => pickMyCard(fi, ci));
      }
      mine.appendChild(el);
    });

    // 配置先ハイライト
    const canDrop = myTurn && f.winner == null && dropTargetOk(g, f);
    if (canDrop) {
      mine.classList.add('droppable');
      mine.addEventListener('click', () => dropOnFlag(fi));
      flag.style.cursor = 'pointer';
      flag.addEventListener('click', () => dropOnFlag(fi));
    }

    lane.append(theirs, mid, mine);
    board.appendChild(lane);
  });
}

function dropTargetOk(g, f) {
  if (action.mode === 'placeCard') {
    const card = g.hand[action.handIdx];
    if (!card) return false;
    if (card.type === 'tactic' && TACTICS[card.key].kind === 'env') return true; // 霧/泥沼はどこでも
    return f.mine.length < f.need;
  }
  if (action.mode === 'pickDest') return f.mine.length < f.need;
  return false;
}

function isEnemyCardPickable(c) {
  if (action.mode !== 'pickEnemyCard') return false;
  if (action.tactic === 'traitor') return c.type === 'troop';
  return true; // deserter
}

/* ---------- 手札とアクション ---------- */

function renderHand(g, myTurn) {
  const wrap = $('my-hand');
  wrap.innerHTML = '';
  const scoutMode = g.pendingScout === g.seat;
  if (scoutMode && action.mode !== 'scoutReturn') action = { mode: 'scoutReturn', picks: [] };
  if (!scoutMode && action.mode === 'scoutReturn') action = { mode: 'idle' };

  const tacticBlocked = g.tacticsPlayed[g.seat] > g.tacticsPlayed[1 - g.seat];

  g.hand.forEach((c, i) => {
    const el = cardEl(c, { size: 'hand' });
    if (action.mode === 'scoutReturn') {
      if (action.picks.includes(i)) el.classList.add('return-selected');
      el.addEventListener('click', () => toggleReturnPick(i));
    } else if (myTurn) {
      const blocked = c.type === 'tactic' && (tacticBlocked ||
        ((c.key === 'alexander' || c.key === 'darius') && g.leaderUsed));
      if (blocked) {
        el.classList.add('disabled');
        el.title = tacticBlocked ? '相手より多く戦術を使用済みのため使えません' : 'リーダーは1ゲーム1枚まで';
      } else {
        if (action.mode === 'placeCard' && action.handIdx === i) el.classList.add('selected');
        el.addEventListener('click', () => selectHandCard(g, i));
      }
    } else {
      el.classList.add('disabled');
    }
    wrap.appendChild(el);
  });

  if (action.mode === 'scoutReturn' && action.picks.length === 2) {
    sendMove({ type: 'scoutReturn', handIdxs: action.picks });
    action = { mode: 'idle' };
  }
}

function selectHandCard(g, i) {
  const c = g.hand[i];
  if (action.mode !== 'idle' && action.handIdx === i) { action = { mode: 'idle' }; renderGame(state); return; }

  if (c.type === 'troop' || (c.type === 'tactic' && ['morale', 'env'].includes(TACTICS[c.key].kind))) {
    action = { mode: 'placeCard', handIdx: i };
  } else if (c.key === 'scout') {
    if (!confirm('【偵察】を使用しますか?\n山札から3枚引き、そのあと手札から2枚を山札に戻します。')) return;
    const draws = [];
    for (let n = 1; n <= 3; n++) {
      const t = state.game.decks.tactic > 0 && confirm(`${n}枚目: 戦術山札から引きますか?\n(キャンセル = 部隊山札)`);
      draws.push(t ? 'tactic' : 'troop');
    }
    sendMove({ type: 'tactic', handIdx: i, draws });
    return;
  } else if (c.key === 'deserter' || c.key === 'traitor') {
    action = { mode: 'pickEnemyCard', handIdx: i, tactic: c.key };
  } else if (c.key === 'redeploy') {
    action = { mode: 'pickMyCard', handIdx: i, tactic: c.key };
  }
  renderGame(state);
}

function dropOnFlag(fi) {
  if (action.mode === 'placeCard') {
    const card = state.game.hand[action.handIdx];
    const type = card.type === 'troop' ? 'troop' : 'tactic';
    sendMove({ type, handIdx: action.handIdx, flag: fi });
  } else if (action.mode === 'pickDest') {
    if (action.tactic === 'traitor') {
      sendMove({ type: 'tactic', handIdx: action.handIdx, flag: action.srcFlag, idx: action.srcIdx, destFlag: fi });
    } else { // redeploy
      sendMove({ type: 'tactic', handIdx: action.handIdx, flag: action.srcFlag, idx: action.srcIdx, destFlag: fi });
    }
  }
}

function pickEnemyCard(fi, ci, card) {
  if (action.tactic === 'deserter') {
    if (!confirm(`【脱走】でこのカードを除外しますか?`)) return;
    sendMove({ type: 'tactic', handIdx: action.handIdx, flag: fi, idx: ci });
  } else { // traitor
    action = { ...action, mode: 'pickDest', srcFlag: fi, srcIdx: ci };
    renderGame(state);
  }
}

function pickMyCard(fi, ci) {
  if (confirm('このカードを別のフラッグへ移動しますか?\n(キャンセル = ゲームから除外)')) {
    action = { ...action, mode: 'pickDest', srcFlag: fi, srcIdx: ci };
    renderGame(state);
  } else {
    sendMove({ type: 'tactic', handIdx: action.handIdx, flag: fi, idx: ci, destFlag: -1 });
  }
}

function toggleReturnPick(i) {
  const p = action.picks;
  const at = p.indexOf(i);
  if (at >= 0) p.splice(at, 1); else if (p.length < 2) p.push(i);
  renderGame(state);
}

function renderHint(g, myTurn) {
  const bar = $('hint-bar');
  const msgs = {
    placeCard: '配置するフラッグを選んでください',
    pickEnemyCard: action.tactic === 'traitor' ? '寝返らせる相手の部隊カードを選んでください' : '除外する相手のカードを選んでください',
    pickMyCard: '移動する自分のカードを選んでください',
    pickDest: '移動先のフラッグ(自分側)を選んでください',
    scoutReturn: '山札に戻すカードを手札から2枚選んでください',
  };
  const m = msgs[action.mode];
  bar.hidden = !m;
  if (m) bar.textContent = m;
}

async function sendMove(move) {
  try {
    action = { mode: 'idle' };
    const res = await api(`/api/rooms/${roomId}/move`, {
      method: 'POST',
      body: { token, move: { ...move, draw: drawPref } },
    });
    onState({ ...state, phase: res.game.winner != null ? 'finished' : 'playing', game: res.game });
  } catch (e) {
    toast(e.message);
    renderGame(state);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

/* ---------- イベント ---------- */

$('btn-create').addEventListener('click', () => createRoom(false));
$('btn-vs-com').addEventListener('click', () => createRoom(true));

async function createRoom(vsCom) {
  try {
    const res = await api('/api/rooms', { method: 'POST', body: { vsCom } });
    roomId = res.roomId;
    token = res.token;
    localStorage.setItem(tokenKey(roomId), token);
    history.pushState({}, '', `/room/${roomId}`);
    startPolling();
    if (vsCom) await api(`/api/rooms/${roomId}/start`, { method: 'POST', body: { token } });
  } catch (e) { toast(e.message); }
}

$('btn-join').addEventListener('click', () => {
  $('join-modal').hidden = false;
  $('join-error').hidden = true;
  $('join-input').value = '';
  $('join-input').focus();
});
$('join-cancel').addEventListener('click', () => { $('join-modal').hidden = true; });
$('join-submit').addEventListener('click', submitJoin);
$('join-input').addEventListener('keydown', e => { if (e.key === 'Enter') submitJoin(); });

async function submitJoin() {
  const id = $('join-input').value.trim().toUpperCase();
  if (id.length !== 6) {
    $('join-error').textContent = '6文字の部屋IDを入力してください';
    $('join-error').hidden = false;
    return;
  }
  $('join-modal').hidden = true;
  enterRoom(id);
}

$('btn-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(roomId); toast('部屋IDをコピーしました'); }
  catch { toast('コピーできませんでした'); }
});

$('btn-start').addEventListener('click', async () => {
  try { await api(`/api/rooms/${roomId}/start`, { method: 'POST', body: { token } }); }
  catch (e) { toast(e.message); }
});
$('btn-rematch').addEventListener('click', async () => {
  try { await api(`/api/rooms/${roomId}/start`, { method: 'POST', body: { token } }); $('result-overlay').hidden = true; }
  catch (e) { toast(e.message); }
});

$('btn-pass').addEventListener('click', () => sendMove({ type: 'pass' }));
$('btn-cancel-action').addEventListener('click', () => { action = { mode: 'idle' }; renderGame(state); });

function renderTacticList() {
  const wrap = $('tactic-list');
  wrap.innerHTML = '';
  for (const key of Object.keys(TACTICS)) {
    const t = TACTICS[key];
    const item = document.createElement('div');
    item.className = 'tactic-item';
    item.innerHTML = `<span class="t-mark">${t.mark}</span><div class="tactic-body"><b>${t.name}</b><span>${t.desc}</span></div>`;
    wrap.appendChild(item);
  }
}
$('btn-help').addEventListener('click', () => { renderTacticList(); $('help-overlay').hidden = false; });
$('btn-help-close').addEventListener('click', () => { $('help-overlay').hidden = true; });

$('draw-troop').addEventListener('click', () => setDraw('troop'));
$('draw-tactic').addEventListener('click', () => setDraw('tactic'));
function setDraw(v) {
  drawPref = v;
  $('draw-troop').classList.toggle('active', v === 'troop');
  $('draw-tactic').classList.toggle('active', v === 'tactic');
}

/* ---------- 起動 ---------- */

const m = location.pathname.match(/^\/room\/([A-Za-z0-9]{4,8})$/);
if (m) enterRoom(m[1]);
else show('view-home');
