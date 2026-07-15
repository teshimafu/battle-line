/* バトルライン COM(コンピュータ)対戦AI */

import {
  TACTIC_INFO,
  needOf,
  fogged,
  bestScore,
  bestPossible,
  unseenPool,
  type GameState,
  type Seat,
  type Card,
  type Flag,
  type Move,
} from './game';

type Score = [number, number];
const cmp = (a: Score, b: Score): number => a[0] - b[0] || a[1] - b[1];

// フラッグ評価: カードを配置した場合の有利さをスコア化する
function evalPlacement(g: GameState, seat: Seat, fi: number, card: Card): number {
  const opp: Seat = (1 - seat) as Seat;
  const f = g.flags[fi];
  const need = needOf(f);
  const fog = fogged(f);
  const pool = unseenPool(g, seat);
  const mySim = f.cards[seat].concat([card]);

  let my: Score | null, decisive = false;
  if (mySim.length >= need) { my = bestScore(mySim, need, fog); decisive = true; }
  else my = bestPossible(mySim, need, fog, pool);

  const oppEval = f.cards[opp].length >= need
    ? bestScore(f.cards[opp], need, fog)
    : bestPossible(f.cards[opp], need, fog, pool);

  let score = 0;
  if (my) score += my[0] * 10 + my[1];
  if (oppEval) score -= oppEval[0] * 6 + oppEval[1] * 0.5;
  if (decisive && (!oppEval || (my && cmp(my, oppEval) >= 0))) score += 500; // その場で獲得確定
  score += f.cards[seat].length * 3; // 既に投資しているフラッグを優先
  return score;
}

function evalEnv(g: GameState, seat: Seat, fi: number, key: 'fog' | 'mud'): number {
  const f = g.flags[fi];
  const opp: Seat = (1 - seat) as Seat;
  const diff = f.cards[opp].length - f.cards[seat].length;
  if (key === 'fog') return diff > 0 ? 8 + diff * 2 : 1;
  if (key === 'mud') return diff > 0 ? 6 + diff * 2 : 0;
  return 0;
}

function cardValueOrZero(c: Card): number {
  return c.type === 'troop' ? c.value : 0;
}

function bestEnemyCardIdx(cards: Card[]): number {
  let bi = 0;
  for (let i = 1; i < cards.length; i++) if (cardValueOrZero(cards[i]) > cardValueOrZero(cards[bi])) bi = i;
  return bi;
}

function cardKeepValue(card: Card): number {
  if (card.type === 'troop') return card.value;
  const order: Record<string, number> = { alexander: 9, darius: 9, cavalry: 8, shield: 5, traitor: 7, deserter: 6, redeploy: 5, scout: 4, fog: 3, mud: 2 };
  return order[card.key] || 3;
}

function pickDraw(g: GameState, seat: Seat): 'troop' | 'tactic' {
  const hand = g.hands[seat];
  const tacticCount = hand.filter((c) => c.type === 'tactic').length;
  if (tacticCount < 2 && g.tacticsDeck.length) return 'tactic';
  return 'troop';
}

function chooseScoutReturn(g: GameState, seat: Seat): Move {
  const hand = g.hands[seat];
  const idxs = hand
    .map((c, i) => ({ i, v: cardKeepValue(c) }))
    .sort((a, b) => a.v - b.v)
    .slice(0, 2)
    .map((x) => x.i);
  return { type: 'scoutReturn', handIdxs: idxs };
}

interface Candidate {
  move: Move;
  score: number;
}

export function chooseComMove(g: GameState, seat: Seat): Move {
  if (g.pendingScout === seat) return chooseScoutReturn(g, seat);

  const opp: Seat = (1 - seat) as Seat;
  const hand = g.hands[seat];
  const tacticAllowed = g.tacticsPlayed[seat] <= g.tacticsPlayed[opp];
  const candidates: Candidate[] = [];

  hand.forEach((card, handIdx) => {
    if (card.type === 'troop') {
      g.flags.forEach((f: Flag, fi: number) => {
        if (f.winner != null || f.cards[seat].length >= needOf(f)) return;
        candidates.push({ move: { type: 'troop', handIdx, flag: fi, draw: pickDraw(g, seat) }, score: evalPlacement(g, seat, fi, card) });
      });
      return;
    }
    if (!tacticAllowed) return;
    const info = TACTIC_INFO[card.key];

    if (info.kind === 'morale') {
      if ((card.key === 'alexander' || card.key === 'darius') && g.leaderUsed[seat]) return;
      g.flags.forEach((f: Flag, fi: number) => {
        if (f.winner != null || f.cards[seat].length >= needOf(f)) return;
        candidates.push({ move: { type: 'tactic', handIdx, flag: fi, draw: pickDraw(g, seat) }, score: evalPlacement(g, seat, fi, card) + 0.5 });
      });
    } else if (info.kind === 'env') {
      g.flags.forEach((f: Flag, fi: number) => {
        if (f.winner != null) return;
        candidates.push({ move: { type: 'tactic', handIdx, flag: fi, draw: pickDraw(g, seat) }, score: evalEnv(g, seat, fi, card.key as 'fog' | 'mud') });
      });
    } else if (card.key === 'scout') {
      candidates.push({ move: { type: 'tactic', handIdx, draws: ['troop', 'troop', 'tactic'] }, score: 4 });
    } else if (card.key === 'deserter') {
      g.flags.forEach((f: Flag, fi: number) => {
        if (f.winner != null || !f.cards[opp].length) return;
        const idx = bestEnemyCardIdx(f.cards[opp]);
        const target = f.cards[opp][idx];
        candidates.push({ move: { type: 'tactic', handIdx, flag: fi, idx, draw: pickDraw(g, seat) }, score: 10 + cardValueOrZero(target) });
      });
    } else if (card.key === 'traitor') {
      g.flags.forEach((f: Flag, fi: number) => {
        if (f.winner != null) return;
        f.cards[opp].forEach((c: Card, idx: number) => {
          if (c.type !== 'troop') return;
          g.flags.forEach((dest: Flag, di: number) => {
            if (dest.winner != null || dest.cards[seat].length >= needOf(dest)) return;
            candidates.push({ move: { type: 'tactic', handIdx, flag: fi, idx, destFlag: di, draw: pickDraw(g, seat) }, score: 12 + cardValueOrZero(c) + dest.cards[seat].length });
          });
        });
      });
    } else if (card.key === 'redeploy') {
      g.flags.forEach((f: Flag, fi: number) => {
        if (f.winner != null) return;
        f.cards[seat].forEach((c: Card, idx: number) => {
          g.flags.forEach((dest: Flag, di: number) => {
            if (di === fi || dest.winner != null || dest.cards[seat].length >= needOf(dest)) return;
            candidates.push({
              move: { type: 'tactic', handIdx, flag: fi, idx, destFlag: di, draw: pickDraw(g, seat) },
              score: 4 + dest.cards[seat].length - f.cards[seat].length * 0.5 + cardValueOrZero(c) * 0.2,
            });
          });
          candidates.push({ move: { type: 'tactic', handIdx, flag: fi, idx, destFlag: -1, draw: pickDraw(g, seat) }, score: 1 });
        });
      });
    }
  });

  if (!candidates.length) return { type: 'pass', draw: pickDraw(g, seat) };
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].move;
}
