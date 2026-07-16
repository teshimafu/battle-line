/* バトルライン ゲームロジック */

export type TacticKind = 'morale' | 'env' | 'guile';

export type TacticKey =
  | 'alexander'
  | 'darius'
  | 'cavalry'
  | 'shield'
  | 'fog'
  | 'mud'
  | 'scout'
  | 'redeploy'
  | 'deserter'
  | 'traitor';

export interface TacticInfo {
  name: string;
  kind: TacticKind;
  desc: string;
}

export const TACTIC_INFO: Record<TacticKey, TacticInfo> = {
  alexander: { name: 'アレキサンダー', kind: 'morale', desc: '好きな色・数字の部隊カードとして扱うワイルド。リーダーは1ゲームに1枚まで。' },
  darius: { name: 'ダリウス', kind: 'morale', desc: '好きな色・数字の部隊カードとして扱うワイルド。リーダーは1ゲームに1枚まで。' },
  cavalry: { name: '援軍騎兵', kind: 'morale', desc: '好きな色の「8」として扱うワイルド。' },
  shield: { name: '盾兵', kind: 'morale', desc: '好きな色の「1〜3」として扱うワイルド。' },
  fog: { name: '霧', kind: 'env', desc: 'このフラッグは合計値のみで勝敗を判定する。' },
  mud: { name: '泥沼', kind: 'env', desc: 'このフラッグは4枚で編成を作る。' },
  scout: { name: '偵察', kind: 'guile', desc: '好きな山札から計3枚引き、手札から2枚を山札の上に戻す。' },
  redeploy: { name: '再配置', kind: 'guile', desc: '未確定フラッグの自分のカード1枚を移動、または除外する。' },
  deserter: { name: '脱走', kind: 'guile', desc: '未確定フラッグの相手側カード1枚を除外する。' },
  traitor: { name: '裏切り', kind: 'guile', desc: '未確定フラッグの相手の部隊カード1枚を自分側に置く。' },
};
const TACTIC_KEYS = Object.keys(TACTIC_INFO) as TacticKey[];
export const COLOR_NAMES = ['赤', '橙', '黄', '緑', '青', '紫'];
export const RANK_NAMES = ['ホスト(合計)', 'スカーミッシュ(連番)', '大隊(同色)', 'ファランクス(同数)', 'ウェッジ(同色連番)'];

export interface TroopCard {
  id: string;
  type: 'troop';
  color: number;
  value: number;
}

export interface TacticCard {
  id: string;
  type: 'tactic';
  key: TacticKey;
}

export type Card = TroopCard | TacticCard;
export type Seat = 0 | 1;

export interface Flag {
  cards: [Card[], Card[]];
  env: TacticKey[];
  winner: Seat | null;
  completedAt: [number | null, number | null];
}

export interface GameState {
  troopDeck: Card[];
  tacticsDeck: Card[];
  hands: [Card[], Card[]];
  flags: Flag[];
  turn: Seat;
  turnStartedAt: number;
  winner: Seat | null;
  winReason: string | null;
  draw: boolean;
  consecutivePasses: number;
  tacticsPlayed: [number, number];
  leaderUsed: [boolean, boolean];
  discard: Card[];
  pendingScout: Seat | null;
  seq: number;
  log: string[];
}

export type DrawPref = 'troop' | 'tactic';

export interface Move {
  type: 'troop' | 'tactic' | 'pass' | 'scoutReturn';
  handIdx?: number;
  flag?: number;
  destFlag?: number;
  idx?: number;
  draw?: DrawPref;
  draws?: DrawPref[];
  handIdxs?: number[];
}

export interface MoveResult {
  error?: string;
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function allTroops(): TroopCard[] {
  const out: TroopCard[] = [];
  for (let c = 0; c < 6; c++)
    for (let v = 1; v <= 10; v++)
      out.push({ id: `t${c}-${v}`, type: 'troop', color: c, value: v });
  return out;
}

export function newGame(): GameState {
  const troopDeck: Card[] = shuffle(allTroops());
  const tacticsDeck: Card[] = shuffle(TACTIC_KEYS.map((k) => ({ id: `x-${k}`, type: 'tactic', key: k } as TacticCard)));
  const hands: [Card[], Card[]] = [[], []];
  for (let i = 0; i < 7; i++) {
    hands[0].push(troopDeck.pop() as Card);
    hands[1].push(troopDeck.pop() as Card);
  }
  const flags: Flag[] = Array.from({ length: 9 }, () => ({
    cards: [[], []],
    env: [],
    winner: null,
    completedAt: [null, null],
  }));
  return {
    troopDeck,
    tacticsDeck,
    hands,
    flags,
    turn: (Math.floor(Math.random() * 2) as Seat),
    turnStartedAt: Date.now(),
    winner: null,
    winReason: null,
    draw: false,
    consecutivePasses: 0,
    tacticsPlayed: [0, 0],
    leaderUsed: [false, false],
    discard: [],
    pendingScout: null,
    seq: 1,
    log: [],
  };
}

/* ---------- 編成の評価 ---------- */

export const needOf = (f: Flag): number => (f.env.includes('mud') ? 4 : 3);
export const fogged = (f: Flag): boolean => f.env.includes('fog');
type Score = [number, number];
const cmp = (a: Score, b: Score): number => a[0] - b[0] || a[1] - b[1];

interface Assign {
  color: number;
  value: number;
}

function wildOptions(card: Card): Assign[] {
  if (card.type === 'troop') return [{ color: card.color, value: card.value }];
  const out: Assign[] = [];
  if (card.key === 'cavalry') {
    for (let c = 0; c < 6; c++) out.push({ color: c, value: 8 });
    return out;
  }
  if (card.key === 'shield') {
    for (let c = 0; c < 6; c++) for (const v of [1, 2, 3]) out.push({ color: c, value: v });
    return out;
  }
  // リーダー(アレキサンダー/ダリウス)は任意の色・数字
  for (let c = 0; c < 6; c++) for (let v = 1; v <= 10; v++) out.push({ color: c, value: v });
  return out;
}

function assignments(cards: Card[]): Assign[][] {
  let res: Assign[][] = [[]];
  for (const cd of cards) {
    const opts = wildOptions(cd);
    const next: Assign[][] = [];
    for (const r of res) for (const o of opts) next.push(r.concat([o]));
    res = next;
  }
  return res;
}

function scoreConcrete(cards: Assign[], fog: boolean): Score {
  const sum = cards.reduce((a, c) => a + c.value, 0);
  if (fog) return [0, sum];
  const sameColor = cards.every((c) => c.color === cards[0].color);
  const values = cards.map((c) => c.value).sort((a, b) => a - b);
  const sameValue = values.every((v) => v === values[0]);
  let run = true;
  for (let i = 1; i < values.length; i++) if (values[i] !== values[i - 1] + 1) { run = false; break; }
  if (sameColor && run) return [4, sum];
  if (sameValue) return [3, sum];
  if (sameColor) return [2, sum];
  if (run) return [1, sum];
  return [0, sum];
}

// 完成した側のベストスコア(ワイルド全列挙)
export function bestScore(cards: Card[], need: number, fog: boolean): Score {
  let best: Score | null = null;
  for (const asg of assignments(cards.slice(0, need))) {
    const s = scoreConcrete(asg, fog);
    if (!best || cmp(s, best) > 0) best = s;
  }
  return best as Score;
}

// 未完成側が pool(未公開の部隊カード)で到達しうる最良スコア
export function bestPossible(placedCards: Card[], need: number, fog: boolean, pool: TroopCard[]): Score | null {
  let best: Score | null = null;
  for (const placed of assignments(placedCards)) {
    const s = bestCompleteConcrete(placed, need, fog, pool);
    if (s && (!best || cmp(s, best) > 0)) best = s;
  }
  return best;
}

function bestCompleteConcrete(placed: Assign[], need: number, fog: boolean, pool: TroopCard[]): Score | null {
  const miss = need - placed.length;
  const psum = placed.reduce((a, c) => a + c.value, 0);
  const poolValsDesc = pool.map((c) => c.value).sort((a, b) => b - a);
  if (poolValsDesc.length < miss) return null; // 完成不可能
  const topSum = (k: number) => poolValsDesc.slice(0, k).reduce((a, b) => a + b, 0);
  if (fog) return [0, psum + topSum(miss)];

  let best: Score = [0, psum + topSum(miss)]; // ホストは常に可能
  const upd = (s: Score) => { if (cmp(s, best) > 0) best = s; };
  const pColors = [...new Set(placed.map((c) => c.color))];
  const pVals = placed.map((c) => c.value);
  const pValSet = new Set(pVals);
  const distinct = pValSet.size === pVals.length;

  // ファランクス(同数)
  if (pVals.length === 0 || pVals.every((v) => v === pVals[0])) {
    const cands = pVals.length ? [pVals[0]] : [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    for (const v of cands) {
      if (pool.filter((c) => c.value === v).length >= miss) { upd([3, v * need]); break; }
    }
  }
  // 大隊(同色)
  if (pColors.length <= 1) {
    const cs = pColors.length ? pColors : [0, 1, 2, 3, 4, 5];
    for (const c of cs) {
      const vals = pool.filter((x) => x.color === c).map((x) => x.value).sort((a, b) => b - a);
      if (vals.length >= miss) upd([2, psum + vals.slice(0, miss).reduce((a, b) => a + b, 0)]);
    }
  }
  // スカーミッシュ / ウェッジ(連番系)
  if (distinct) {
    for (let lo = 1; lo <= 11 - need; lo++) {
      const win: number[] = [];
      for (let v = lo; v < lo + need; v++) win.push(v);
      if (![...pValSet].every((v) => v >= lo && v < lo + need)) continue;
      const missVals = win.filter((v) => !pValSet.has(v));
      const wsum = win.reduce((a, b) => a + b, 0);
      if (missVals.every((v) => pool.some((x) => x.value === v))) upd([1, wsum]);
      const wc = pColors.length === 1 ? pColors : pColors.length === 0 ? [0, 1, 2, 3, 4, 5] : [];
      for (const c of wc) {
        if (missVals.every((v) => pool.some((x) => x.color === c && x.value === v))) upd([4, wsum]);
      }
    }
  }
  return best;
}

/* ---------- フラッグ確定・勝敗 ---------- */

function syncCompletion(g: GameState, flag: Flag): void {
  const need = needOf(flag);
  for (const s of [0, 1] as const) {
    if (flag.cards[s].length >= need) {
      if (flag.completedAt[s] == null) flag.completedAt[s] = g.seq++;
    } else flag.completedAt[s] = null;
  }
}

// 早期確定(クレーム)の証明に使えるのは、実際に場に出た/捨てられたカードのみ。
// まだプレイされていないカードは、それが山札にあろうと(自分を含む)どちらの手札に
// あろうと「相手がまだ入手しうる」ものとして扱う。手札の中身という非公開情報を
// 根拠に相手の逆転可能性を否定してはいけない。
export function unseenPool(g: GameState, claimant: Seat): TroopCard[] {
  const visible = new Set<string>();
  for (const f of g.flags) for (const s of [0, 1] as const) for (const c of f.cards[s]) visible.add(c.id);
  for (const c of g.discard) visible.add(c.id);
  return allTroops().filter((c) => !visible.has(c.id));
}

function resolveFlags(g: GameState, names: [string, string]): void {
  for (let i = 0; i < g.flags.length; i++) {
    const f = g.flags[i];
    if (f.winner != null) continue;
    const need = needOf(f), fog = fogged(f);
    const n0 = f.cards[0].length, n1 = f.cards[1].length;
    if (n0 >= need && n1 >= need) {
      const s0 = bestScore(f.cards[0], need, fog);
      const s1 = bestScore(f.cards[1], need, fog);
      const c = cmp(s0, s1);
      const winner: Seat = c > 0 ? 0 : c < 0 ? 1 : ((f.completedAt[0] as number) < (f.completedAt[1] as number) ? 0 : 1);
      f.winner = winner;
      g.log.push(`フラッグ${i + 1}を${names[f.winner]}が獲得(${RANK_NAMES[(f.winner === 0 ? s0 : s1)[0]]})`);
    } else if (n0 >= need || n1 >= need) {
      const s: Seat = n0 >= need ? 0 : 1;
      const my = bestScore(f.cards[s], need, fog);
      const oppBest = bestPossible(f.cards[1 - s], need, fog, unseenPool(g, s));
      if (!oppBest || cmp(my, oppBest) >= 0) {
        f.winner = s;
        g.log.push(`フラッグ${i + 1}を${names[s]}が獲得(相手は上回れないことが証明された)`);
      }
    }
  }
  checkWinner(g, names);
}

function checkWinner(g: GameState, names: [string, string]): void {
  if (g.winner != null) return;
  const w = g.flags.map((f) => f.winner);
  for (const s of [0, 1] as const) {
    const total = w.filter((x) => x === s).length;
    let streak = 0, maxStreak = 0;
    for (const x of w) { streak = x === s ? streak + 1 : 0; maxStreak = Math.max(maxStreak, streak); }
    if (total >= 5) { g.winner = s; g.winReason = '5本のフラッグを獲得'; }
    else if (maxStreak >= 3) { g.winner = s; g.winReason = '隣接する3本のフラッグを獲得'; }
    if (g.winner != null) { g.log.push(`${names[s]}の勝利!(${g.winReason})`); return; }
  }
}

/* ---------- 着手 ---------- */

export const TURN_TIME_LIMIT_MS = 3 * 60 * 1000;

// 手番のプレイヤーが制限時間内に着手しなかった場合、時間切れとして相手の勝利にする。
// ポーリングのみで放置され続けたゲームでもサーバー側で自然に決着させるための仕組み。
export function checkTurnTimeout(g: GameState, names: [string, string]): void {
  if (g.winner != null || g.draw) return;
  if (Date.now() - g.turnStartedAt < TURN_TIME_LIMIT_MS) return;
  const timedOutSeat = g.turn;
  const winner: Seat = (1 - timedOutSeat) as Seat;
  g.winner = winner;
  g.winReason = '手番の時間切れ';
  g.log.push(`${names[timedOutSeat]}が制限時間内に着手しなかったため、${names[winner]}の勝利になりました`);
}

export function hasLegalTroopPlacement(g: GameState, seat: Seat): boolean {
  return g.flags.some((f) => f.winner == null && f.cards[seat].length < needOf(f));
}

export function applyMove(g: GameState, seat: Seat, move: Move, names: [string, string]): MoveResult {
  checkTurnTimeout(g, names);
  if (g.winner != null || g.draw) return { error: 'ゲームは終了しています' };
  if (g.turn !== seat) return { error: 'あなたの手番ではありません' };
  const hand = g.hands[seat];
  const opp: Seat = (1 - seat) as Seat;

  // 偵察の返却待ち
  if (g.pendingScout === seat) {
    if (move.type !== 'scoutReturn') return { error: '手札から2枚を山札に戻してください' };
    const idxs = [...new Set(move.handIdxs || [])];
    if (idxs.length !== 2 || idxs.some((i) => !hand[i])) return { error: '戻すカードを2枚選んでください' };
    idxs.sort((a, b) => b - a);
    for (const i of idxs) {
      const c = hand.splice(i, 1)[0];
      (c.type === 'tactic' ? g.tacticsDeck : g.troopDeck).push(c); // 山札の上へ
    }
    g.pendingScout = null;
    g.log.push(`${names[seat]}が手札2枚を山札に戻した`);
    endTurn(g, seat, null, names, true, false);
    return {};
  }
  if (move.type === 'scoutReturn') return { error: '不正な操作です' };

  if (move.type === 'pass') {
    const hasTroop = hand.some((c) => c.type === 'troop');
    if (hasTroop && hasLegalTroopPlacement(g, seat))
      return { error: '配置可能なフラッグがあるためパスできません' };
    g.log.push(`${names[seat]}はパスした`);
    endTurn(g, seat, move.draw ?? null, names, false, true);
    return {};
  }

  const card = hand[move.handIdx as number];
  if (!card) return { error: 'カードが見つかりません' };

  if (move.type === 'troop') {
    if (card.type !== 'troop') return { error: '部隊カードを選んでください' };
    const f = g.flags[move.flag as number];
    if (!f || f.winner != null) return { error: 'そのフラッグには置けません' };
    if (f.cards[seat].length >= needOf(f)) return { error: 'そのフラッグは満杯です' };
    hand.splice(move.handIdx as number, 1);
    f.cards[seat].push(card);
    syncCompletion(g, f);
    g.log.push(`${names[seat]}がフラッグ${(move.flag as number) + 1}に${COLOR_NAMES[card.color]}${card.value}を配置`);
    endTurn(g, seat, move.draw ?? null, names, false, false);
    return {};
  }

  if (move.type === 'tactic') {
    if (card.type !== 'tactic') return { error: '戦術カードを選んでください' };
    if (g.tacticsPlayed[seat] > g.tacticsPlayed[opp])
      return { error: '相手より多く戦術カードを使用済みのため、今は使えません' };
    const k = card.key;
    const info = TACTIC_INFO[k];

    if (info.kind === 'morale') {
      if ((k === 'alexander' || k === 'darius') && g.leaderUsed[seat])
        return { error: 'リーダーカードは1ゲームに1枚しか使えません' };
      const f = g.flags[move.flag as number];
      if (!f || f.winner != null) return { error: 'そのフラッグには置けません' };
      if (f.cards[seat].length >= needOf(f)) return { error: 'そのフラッグは満杯です' };
      hand.splice(move.handIdx as number, 1);
      f.cards[seat].push(card);
      if (k === 'alexander' || k === 'darius') g.leaderUsed[seat] = true;
      syncCompletion(g, f);
    } else if (info.kind === 'env') {
      const f = g.flags[move.flag as number];
      if (!f || f.winner != null) return { error: 'そのフラッグには置けません' };
      hand.splice(move.handIdx as number, 1);
      f.env.push(k);
      syncCompletion(g, f); // 泥沼で「完成」が解除される場合あり
    } else if (k === 'scout') {
      const draws = move.draws || [];
      if (draws.length !== 3) return { error: '引く山札を3回分選んでください' };
      hand.splice(move.handIdx as number, 1);
      g.discard.push(card);
      for (const d of draws) {
        let deck = d === 'tactic' ? g.tacticsDeck : g.troopDeck;
        if (!deck.length) deck = deck === g.tacticsDeck ? g.troopDeck : g.tacticsDeck;
        if (deck.length) hand.push(deck.pop() as Card);
      }
      g.tacticsPlayed[seat]++;
      g.pendingScout = seat;
      g.log.push(`${names[seat]}が【偵察】を使用(3枚引き、2枚戻す)`);
      return {}; // 手番は返却完了まで続く
    } else if (k === 'deserter') {
      const f = g.flags[move.flag as number];
      if (!f || f.winner != null) return { error: '未確定のフラッグを選んでください' };
      const target = f.cards[opp][move.idx as number];
      if (!target) return { error: '対象カードが見つかりません' };
      hand.splice(move.handIdx as number, 1);
      g.discard.push(card);
      f.cards[opp].splice(move.idx as number, 1);
      g.discard.push(target);
      syncCompletion(g, f);
      g.log.push(`${names[seat]}が【脱走】で相手のカードを除外`);
    } else if (k === 'traitor') {
      const f = g.flags[move.flag as number];
      const dest = g.flags[move.destFlag as number];
      if (!f || f.winner != null || !dest || dest.winner != null) return { error: '未確定のフラッグを選んでください' };
      const target = f.cards[opp][move.idx as number];
      if (!target || target.type !== 'troop') return { error: '相手の部隊カードを選んでください' };
      if (dest.cards[seat].length >= needOf(dest)) return { error: '移動先が満杯です' };
      hand.splice(move.handIdx as number, 1);
      g.discard.push(card);
      f.cards[opp].splice(move.idx as number, 1);
      dest.cards[seat].push(target);
      syncCompletion(g, f); syncCompletion(g, dest);
      g.log.push(`${names[seat]}が【裏切り】で相手の部隊を寝返らせた`);
    } else if (k === 'redeploy') {
      const f = g.flags[move.flag as number];
      if (!f || f.winner != null) return { error: '未確定のフラッグを選んでください' };
      const target = f.cards[seat][move.idx as number];
      if (!target) return { error: '対象カードが見つかりません' };
      hand.splice(move.handIdx as number, 1);
      g.discard.push(card);
      f.cards[seat].splice(move.idx as number, 1);
      if (move.destFlag === -1) {
        g.discard.push(target);
      } else {
        const dest = g.flags[move.destFlag as number];
        if (!dest || dest.winner != null || dest.cards[seat].length >= needOf(dest)) {
          // ロールバック
          f.cards[seat].splice(move.idx as number, 0, target);
          hand.splice(move.handIdx as number, 0, card);
          g.discard.pop();
          return { error: '移動先が不正です' };
        }
        dest.cards[seat].push(target);
        syncCompletion(g, dest);
      }
      syncCompletion(g, f);
      g.log.push(`${names[seat]}が【再配置】を使用`);
    } else {
      return { error: '不明な戦術カードです' };
    }

    if (info.kind === 'morale' || info.kind === 'env') {
      g.log.push(`${names[seat]}が【${info.name}】を${move.flag != null ? `フラッグ${move.flag + 1}に` : ''}使用`);
    }
    g.tacticsPlayed[seat]++;
    endTurn(g, seat, move.draw ?? null, names, false, false);
    return {};
  }
  return { error: '不明な操作です' };
}

function endTurn(g: GameState, seat: Seat, drawPref: DrawPref | null, names: [string, string], skipDraw: boolean, wasPass: boolean): void {
  resolveFlags(g, names);
  if (g.winner != null) return;
  if (!skipDraw) {
    let deck = drawPref === 'tactic' ? g.tacticsDeck : g.troopDeck;
    if (!deck.length) deck = drawPref === 'tactic' ? g.troopDeck : g.tacticsDeck;
    if (deck.length) g.hands[seat].push(deck.pop() as Card);
  }
  g.consecutivePasses = wasPass ? g.consecutivePasses + 1 : 0;
  // 山札が尽き、両者が連続でパスして手詰まりになったら引き分けとする
  if (!g.troopDeck.length && !g.tacticsDeck.length && g.consecutivePasses >= 2) {
    g.draw = true;
    g.winReason = '山札が尽き、双方が手詰まりとなったため引き分け';
    g.log.push('引き分けになりました(山札切れ・双方着手不能)');
  }
  if (g.log.length > 40) g.log.splice(0, g.log.length - 40);
  g.turn = (1 - seat) as Seat;
  g.turnStartedAt = Date.now();
}

/* ---------- プレイヤー視点の状態 ---------- */

export interface SanitizedFlag {
  mine: Card[];
  theirs: Card[];
  env: TacticKey[];
  winner: 'you' | 'opp' | null;
  need: number;
}

export interface SanitizedState {
  seat: Seat;
  turn: Seat;
  turnDeadline: number;
  winner: Seat | null;
  winReason: string | null;
  draw: boolean;
  hand: Card[];
  oppHand: { troop: number; tactic: number };
  decks: { troop: number; tactic: number };
  tacticsPlayed: [number, number];
  leaderUsed: boolean;
  pendingScout: Seat | null;
  canPass: boolean;
  flags: SanitizedFlag[];
  discard: Card[];
  log: string[];
}

export function sanitize(g: GameState, seat: Seat): SanitizedState {
  const opp: Seat = (1 - seat) as Seat;
  return {
    seat,
    turn: g.turn,
    turnDeadline: g.turnStartedAt + TURN_TIME_LIMIT_MS,
    winner: g.winner,
    winReason: g.winReason,
    draw: g.draw,
    hand: g.hands[seat],
    oppHand: {
      troop: g.hands[opp].filter((c) => c.type === 'troop').length,
      tactic: g.hands[opp].filter((c) => c.type === 'tactic').length,
    },
    decks: { troop: g.troopDeck.length, tactic: g.tacticsDeck.length },
    tacticsPlayed: g.tacticsPlayed,
    leaderUsed: g.leaderUsed[seat],
    pendingScout: g.pendingScout,
    canPass: g.turn === seat && (!g.hands[seat].some((c) => c.type === 'troop') || !hasLegalTroopPlacement(g, seat)),
    flags: g.flags.map((f) => ({
      mine: f.cards[seat],
      theirs: f.cards[opp],
      env: f.env,
      winner: f.winner == null ? null : f.winner === seat ? 'you' : 'opp',
      need: needOf(f),
    })),
    discard: g.discard,
    log: g.log.slice(-12),
  };
}
