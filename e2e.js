// 2プレイヤーをAPI経由でフル対戦させるE2Eテスト
const B = 'http://127.0.0.1:3000';
const j = (r) => r.json();
const post = (p, body) => fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(p + ': ' + d.error); return d; });
const get = (p) => fetch(B + p).then(j);

(async () => {
  const c = await post('/api/rooms');
  const roomId = c.roomId, tokens = [c.token];
  const jn = await post(`/api/rooms/${roomId}/join`);
  tokens.push(jn.token);
  // 満員テスト
  const full = await fetch(B + `/api/rooms/${roomId}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (full.status !== 403) throw new Error('full room should be 403');
  await post(`/api/rooms/${roomId}/start`, { token: tokens[0] });

  let moves = 0;
  for (let step = 0; step < 600; step++) {
    const s0 = await get(`/api/rooms/${roomId}/state?token=${tokens[0]}`);
    if (s0.phase === 'finished') { console.log('finished after', moves, 'moves. winner seat:', s0.game.winner, s0.game.winReason); break; }
    const g = s0.game;
    const seat = g.turn;
    const s = seat === 0 ? s0 : await get(`/api/rooms/${roomId}/state?token=${tokens[1]}`);
    const me = s.game;
    // 相手の手札は枚数のみ見えることを確認
    if (!('troop' in me.oppHand)) throw new Error('oppHand missing');
    if (JSON.stringify(me).match(/"hands"/)) throw new Error('leak!');
    let move = null;
    if (me.pendingScout === me.seat) move = { type: 'scoutReturn', handIdxs: [0, 1] };
    else {
      const openMine = me.flags.map((f, i) => ({ f, i })).filter(x => x.f.winner == null && x.f.mine.length < x.f.need);
      const hi = me.hand.findIndex(cd => cd.type === 'troop');
      if (hi >= 0 && openMine.length) move = { type: 'troop', handIdx: hi, flag: openMine[Math.floor(Math.random() * openMine.length)].i, draw: Math.random() < 0.25 ? 'tactic' : 'troop' };
      else {
        // 戦術を雑にトライ、ダメならパス
        const ti = me.hand.findIndex(cd => cd.type === 'tactic' && ['fog', 'mud'].includes(cd.key));
        const open = me.flags.map((f, i) => ({ f, i })).filter(x => x.f.winner == null);
        if (ti >= 0 && open.length && me.tacticsPlayed[me.seat] <= me.tacticsPlayed[1 - me.seat]) move = { type: 'tactic', handIdx: ti, flag: open[0].i, draw: 'troop' };
        else move = { type: 'pass', draw: 'troop' };
      }
    }
    const r = await fetch(B + `/api/rooms/${roomId}/move`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tokens[seat], move }) });
    const d = await r.json();
    if (!r.ok) throw new Error('move failed: ' + d.error + ' ' + JSON.stringify(move));
    moves++;
  }
  // 再戦
  await post(`/api/rooms/${roomId}/start`, { token: tokens[1] });
  const rs = await get(`/api/rooms/${roomId}/state?token=${tokens[0]}`);
  if (rs.phase !== 'playing') throw new Error('rematch failed');
  console.log('rematch OK. E2E all green.');
})().catch(e => { console.error('E2E FAIL:', e.message); process.exit(1); });
