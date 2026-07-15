const { newGame, applyMove, sanitize } = require('./game');
const names = ['P1','P2'];

// ランダムプレイで100ゲーム走らせ、決着とエラー耐性を確認
let finished = 0, maxTurns = 0;
for (let n = 0; n < 100; n++) {
  const g = newGame();
  let turns = 0;
  while (g.winner == null && turns < 500) {
    const seat = g.turn;
    const hand = g.hands[seat];
    // 偵察返却待ち
    if (g.pendingScout === seat) {
      applyMove(g, seat, { type: 'scoutReturn', handIdxs: [0, 1] }, names);
      turns++; continue;
    }
    // ランダムに合法手を探す
    let played = false;
    const order = [...hand.keys()].sort(() => Math.random() - 0.5);
    for (const hi of order) {
      const c = hand[hi];
      if (c.type === 'troop') {
        const fs = g.flags.map((f,i)=>i).filter(i => g.flags[i].winner == null && g.flags[i].cards[seat].length < (g.flags[i].env.includes('mud')?4:3));
        if (fs.length) {
          const r = applyMove(g, seat, { type:'troop', handIdx: hi, flag: fs[Math.floor(Math.random()*fs.length)], draw: Math.random()<0.3?'tactic':'troop' }, names);
          if (r.error) throw new Error('troop: '+r.error);
          played = true; break;
        }
      } else {
        const open = g.flags.map((f,i)=>i).filter(i => g.flags[i].winner == null);
        const openMine = open.filter(i => g.flags[i].cards[seat].length < (g.flags[i].env.includes('mud')?4:3));
        const oppSide = open.filter(i => g.flags[i].cards[1-seat].length > 0);
        let mv = null;
        if (['alexander','darius','cavalry','shield'].includes(c.key) && openMine.length) mv = { flag: openMine[0] };
        else if (['fog','mud'].includes(c.key) && open.length) mv = { flag: open[0] };
        else if (c.key === 'scout') mv = { draws: ['troop','troop','tactic'] };
        else if (c.key === 'deserter' && oppSide.length) mv = { flag: oppSide[0], idx: 0 };
        else if (c.key === 'traitor') {
          const src = open.find(i => g.flags[i].cards[1-seat].some(x=>x.type==='troop'));
          if (src != null && openMine.length) mv = { flag: src, idx: g.flags[src].cards[1-seat].findIndex(x=>x.type==='troop'), destFlag: openMine[0] };
        }
        else if (c.key === 'redeploy') {
          const src = open.find(i => g.flags[i].cards[seat].length > 0);
          if (src != null) mv = { flag: src, idx: 0, destFlag: -1 };
        }
        if (mv) {
          const r = applyMove(g, seat, { type:'tactic', handIdx: hi, draw:'troop', ...mv }, names);
          if (!r.error) { played = true; break; }
        }
      }
    }
    if (!played) {
      const r = applyMove(g, seat, { type: 'pass', draw: 'troop' }, names);
      if (r.error) throw new Error('stuck: '+r.error+' hand='+hand.length);
    }
    turns++;
  }
  if (g.winner != null) finished++;
  maxTurns = Math.max(maxTurns, turns);
}
console.log(`finished: ${finished}/100, maxTurns: ${maxTurns}`);

// sanitize の情報隠蔽チェック
const g = newGame();
const s = sanitize(g, 0);
if (s.hand.length !== 7 || s.oppHand.troop + s.oppHand.tactic !== 7) throw new Error('sanitize hand');
if (JSON.stringify(s).includes('"hands"')) throw new Error('leak');
console.log('sanitize OK. oppHand =', s.oppHand);
