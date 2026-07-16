import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame,
  applyMove,
  bestScore,
  bestPossible,
  unseenPool,
  needOf,
  fogged,
  type GameState,
  type Card,
  type TroopCard,
  type Seat,
} from '../src/lib/battle-line/game';

const names: [string, string] = ['P1', 'P2'];

function troop(id: string, color: number, value: number): TroopCard {
  return { id, type: 'troop', color, value };
}

/**
 * 空のフラッグ配列を持つ最小のGameStateを作る。
 * 勝敗条件(5本 / 隣接3本)のテストでは、事前に flags[i].winner を直接セットし、
 * 何らかの合法手を1つ打って endTurn -> resolveFlags -> checkWinner を発火させる。
 */
function makeGame(): GameState {
  const g = newGame();
  g.hands = [
    [troop('h0', 0, 5)],
    [troop('h1', 1, 5)],
  ];
  g.winner = null;
  g.winReason = null;
  return g;
}

function setFlagWinner(g: GameState, idx: number, seat: Seat) {
  g.flags[idx].winner = seat;
}

// 適当な一手を打ち、resolveFlags/checkWinnerを発火させる
function triggerResolve(g: GameState, seat: Seat) {
  g.turn = seat;
  // まだ勝者が決まっていないフラッグに1枚置く(このフラッグ自体は未完成のまま)
  const openFlag = g.flags.findIndex((f) => f.winner == null);
  const r = applyMove(g, seat, { type: 'troop', handIdx: 0, flag: openFlag, draw: 'troop' }, names);
  assert.equal(r.error, undefined, r.error);
}

describe('バトルライン: 編成ランクの判定 (bestScore)', () => {
  test('ウェッジ(同色連番)が最強', () => {
    const s = bestScore([troop('a', 0, 1), troop('b', 0, 2), troop('c', 0, 3)], 3, false);
    assert.equal(s[0], 4);
  });
  test('ファランクス(同数)はウェッジの次に強い', () => {
    const s = bestScore([troop('a', 0, 5), troop('b', 1, 5), troop('c', 2, 5)], 3, false);
    assert.equal(s[0], 3);
  });
  test('大隊(同色, 非連番)はファランクスより弱い', () => {
    const s = bestScore([troop('a', 0, 1), troop('b', 0, 3), troop('c', 0, 7)], 3, false);
    assert.equal(s[0], 2);
  });
  test('スカーミッシュ(異色連番)は大隊より弱い', () => {
    const s = bestScore([troop('a', 0, 1), troop('b', 1, 2), troop('c', 2, 3)], 3, false);
    assert.equal(s[0], 1);
  });
  test('ホスト(何も揃わない)は合計値のみ', () => {
    const s = bestScore([troop('a', 0, 1), troop('b', 1, 4), troop('c', 2, 9)], 3, false);
    assert.equal(s[0], 0);
    assert.equal(s[1], 14);
  });
  test('同ランクなら合計値で比較する', () => {
    const low = bestScore([troop('a', 0, 1), troop('b', 1, 2), troop('c', 2, 3)], 3, false);
    const high = bestScore([troop('a', 0, 5), troop('b', 1, 6), troop('c', 2, 7)], 3, false);
    assert.ok(low[0] === high[0]);
    assert.ok(high[1] > low[1]);
  });
});

describe('バトルライン: 環境戦術カード', () => {
  test('霧(fog)は合計値のみで判定される(編成ランクは無視)', () => {
    const s = bestScore([troop('a', 0, 1), troop('b', 0, 2), troop('c', 0, 3)], 3, true);
    assert.equal(s[0], 0); // ウェッジになるはずが霧で無効化
    assert.equal(s[1], 6);
  });
  test('needOf: 泥沼(mud)付きフラッグは4枚編成になる', () => {
    const g = newGame();
    g.flags[0].env.push('mud');
    assert.equal(needOf(g.flags[0]), 4);
    assert.equal(needOf(g.flags[1]), 3);
  });
  test('fogged() は fog が付与されたフラッグのみ true', () => {
    const g = newGame();
    g.flags[0].env.push('fog');
    assert.equal(fogged(g.flags[0]), true);
    assert.equal(fogged(g.flags[1]), false);
  });
});

describe('バトルライン: ゲーム全体の勝敗条件', () => {
  test('5本のフラッグを獲得すると勝利', () => {
    const g = makeGame();
    for (const i of [0, 1, 2, 4, 6]) setFlagWinner(g, i, 0);
    triggerResolve(g, 0);
    assert.equal(g.winner, 0);
    assert.equal(g.winReason, '5本のフラッグを獲得');
  });

  test('隣接する3本のフラッグを獲得すると、5本に満たなくても勝利', () => {
    const g = makeGame();
    for (const i of [3, 4, 5]) setFlagWinner(g, i, 1);
    triggerResolve(g, 1);
    assert.equal(g.winner, 1);
    assert.equal(g.winReason, '隣接する3本のフラッグを獲得');
  });

  test('4本獲得していても、5本未満かつ隣接3本でなければ勝利しない', () => {
    const g = makeGame();
    // 0,1 は隣接だが 3,5 は離れているため、隣接3本にならない
    for (const i of [0, 1, 3, 5]) setFlagWinner(g, i, 0);
    triggerResolve(g, 0);
    assert.equal(g.winner, null);
  });

  test('相手が4本(非隣接)獲得している状態で自分が1本目を取っても、自分は勝利しない', () => {
    // 実際の不具合報告の再現: 相手フラッグ4つ、こちらが1つ目を取っただけでは勝利にならないはず
    const g = makeGame();
    for (const i of [0, 2, 4, 6]) setFlagWinner(g, i, 1); // 相手が非隣接に4本
    setFlagWinner(g, 8, 0); // 自分が1本目
    triggerResolve(g, 0);
    assert.equal(g.winner, null);
  });

  test('自分の1本と相手の隣接3本が同時に存在する場合は、相手(隣接3本側)が勝者になる', () => {
    const g = makeGame();
    for (const i of [3, 4, 5]) setFlagWinner(g, i, 1);
    setFlagWinner(g, 8, 0);
    triggerResolve(g, 0);
    assert.equal(g.winner, 1);
  });

  test('両者とも条件未達なら勝者はnullのまま', () => {
    const g = makeGame();
    setFlagWinner(g, 0, 0);
    setFlagWinner(g, 8, 1);
    triggerResolve(g, 0);
    assert.equal(g.winner, null);
  });
});

describe('バトルライン: フラッグの早期確定(片側完成・相手が逆転不可能な場合)', () => {
  test('相手が未着手でも、残りの全未公開札を使っても絶対に上回れないなら即座に確定する', () => {
    const g = newGame();
    g.hands = [
      [troop('a', 0, 8), troop('b', 0, 9), troop('c', 0, 10)], // ウェッジ(同色連番), 合計27 = 最強
      [],
    ];
    g.turn = 0;
    applyMove(g, 0, { type: 'troop', handIdx: 0, flag: 0, draw: 'troop' }, names);
    g.turn = 0;
    applyMove(g, 0, { type: 'troop', handIdx: 0, flag: 0, draw: 'troop' }, names);
    g.turn = 0;
    applyMove(g, 0, { type: 'troop', handIdx: 0, flag: 0, draw: 'troop' }, names);
    // 最強編成(ウェッジ+最大合計値)である以上、相手が何を引いても上回れないため即座に確定する
    assert.equal(g.flags[0].winner, 0);
  });

  test('unseenPool は部隊カードのみで構成される(戦術カードは早期確定の判定材料にしない)', () => {
    // 勝ちの証明(早期確定)は部隊カードだけで行うのが本来のルール。
    // 戦術カード(リーダー/援軍騎兵/盾兵などのワイルド)は対象外。
    const g = newGame();
    const pool = unseenPool(g, 0);
    assert.ok(pool.every((c) => c.type === 'troop'));
  });

  test('unseenPool は自分(確定した側)の手札も除外しない(手札か山札かという所在は判定材料にしない)', () => {
    // まだ場に出ていないカードは、自分の手札にあろうと山札にあろうと
    // 「相手がまだ入手しうる」ものとして扱わなければならない。
    // 自分の手札に眠っているという非公開情報を根拠に、相手の逆転可能性を
    // 否定してはいけない。
    const g = newGame();
    const claimant: Seat = 0;
    const heldCard = g.hands[claimant].find((c) => c.type === 'troop');
    assert.ok(heldCard, 'テスト前提: 手札に部隊カードが必要');
    const pool = unseenPool(g, claimant);
    assert.ok(
      pool.some((c) => c.id === heldCard!.id),
      '確定した側の手札にあるカードも、まだ場に出ていない以上プールに含まれるべき'
    );
    // 全60枚の部隊カードから、場・捨て札分のみ除いた枚数のはず(手札は除外しない)
    assert.equal(pool.length, 60);
  });

  test('実際に報告された不具合の再現: 未着手のカードがどちらの手札にあるか不明でも即座には確定しない', () => {
    // 自分は 赤1,赤2 を配置済み(need=3, あと1枚)。相手は 黄5+ダリウス+紫5 の
    // ファランクス(同数, rank3, 合計15)で完成。
    // 自分は赤3を引ければ 赤1,2,3 のウェッジ(同色連番, rank4)で相手を上回れるが、
    // 赤3はまだ場に出ていない(手札か山札かは不明)。
    // 「場に出ていない以上、所在に関わらず未確定」というルールにより、
    // この時点でフラッグを相手に確定させてはいけない。
    const g = newGame();
    g.hands = [[troop('red1', 0, 1), troop('red2', 0, 2)], [troop('y5', 2, 5), { id: 'x-darius', type: 'tactic', key: 'darius' } as Card, troop('p5', 5, 5)]];
    g.turn = 0;
    applyMove(g, 0, { type: 'troop', handIdx: 0, flag: 0, draw: 'troop' }, names); // 赤1
    g.turn = 1;
    applyMove(g, 1, { type: 'troop', handIdx: 0, flag: 0, draw: 'troop' }, names); // 黄5
    g.turn = 0;
    applyMove(g, 0, { type: 'troop', handIdx: 0, flag: 0, draw: 'troop' }, names); // 赤2
    g.turn = 1;
    applyMove(g, 1, { type: 'tactic', handIdx: 0, flag: 0, draw: 'troop' }, names); // ダリウス
    g.turn = 1;
    applyMove(g, 1, { type: 'troop', handIdx: 0, flag: 0, draw: 'troop' }, names); // 紫5(完成・早期確定判定が走る)

    assert.equal(g.flags[0].winner, null, '赤3が場に出ていない以上、まだ確定してはいけない');
  });
});

describe('バトルライン: 山札切れによる引き分け', () => {
  test('山札が両方尽きた状態で両者が連続パスすると引き分けになる', () => {
    const g = newGame();
    g.troopDeck = [];
    g.tacticsDeck = [];
    g.hands = [[], []];
    g.turn = 0;

    let r = applyMove(g, 0, { type: 'pass' }, names);
    assert.equal(r.error, undefined);
    assert.equal(g.draw, false);
    assert.equal(g.winner, null);

    r = applyMove(g, 1, { type: 'pass' }, names);
    assert.equal(r.error, undefined);
    assert.equal(g.draw, true);
    assert.equal(g.winner, null);
    assert.ok(g.winReason);
  });

  test('山札がまだ残っている場合は、連続パスしても引き分けにならない', () => {
    const g = newGame();
    // パスするたびに1枚引くため、2回パスしても山札が尽きないよう多めに用意する
    g.troopDeck = [troop('t1', 0, 5), troop('t2', 0, 6), troop('t3', 0, 7)];
    g.tacticsDeck = [];
    g.hands = [[], []];
    g.turn = 0;

    applyMove(g, 0, { type: 'pass' }, names);
    applyMove(g, 1, { type: 'pass' }, names);
    assert.equal(g.draw, false);
    assert.ok(g.troopDeck.length > 0);
  });

  test('途中で実際の着手があれば連続パスのカウントはリセットされる', () => {
    const g = newGame();
    g.troopDeck = [];
    g.tacticsDeck = [];
    g.hands = [[troop('r1', 0, 1)], []];
    g.turn = 0;

    applyMove(g, 0, { type: 'troop', handIdx: 0, flag: 0 }, names); // 実着手(パスではない)
    applyMove(g, 1, { type: 'pass' }, names); // パス1回目
    assert.equal(g.draw, false);
  });

  test('引き分け成立後は着手できない', () => {
    const g = newGame();
    g.troopDeck = [];
    g.tacticsDeck = [];
    g.hands = [[], []];
    g.turn = 0;
    applyMove(g, 0, { type: 'pass' }, names);
    applyMove(g, 1, { type: 'pass' }, names);
    assert.equal(g.draw, true);

    const r = applyMove(g, g.turn, { type: 'pass' }, names);
    assert.equal(r.error, 'ゲームは終了しています');
  });
});

describe('バトルライン: ランダム対戦での不変条件', () => {
  test('1000ゲームのランダムプレイで、両者完成済みフラッグの勝者判定に矛盾がなく、勝利条件も常に満たされている', () => {
    let unfinished = 0;
    for (let n = 0; n < 1000; n++) {
      const g = newGame();
      let turns = 0;
      while (g.winner == null && !g.draw && turns < 400) {
        const seat = g.turn;
        const hand = g.hands[seat];
        if (g.pendingScout === seat) {
          applyMove(g, seat, { type: 'scoutReturn', handIdxs: [0, 1] }, names);
          turns++;
          continue;
        }
        let played = false;
        const order = [...hand.keys()].sort(() => Math.random() - 0.5);
        for (const hi of order) {
          const c = hand[hi];
          if (c.type === 'troop') {
            const fs = g.flags
              .map((f, i) => i)
              .filter((i) => g.flags[i].winner == null && g.flags[i].cards[seat].length < needOf(g.flags[i]));
            if (fs.length) {
              const r = applyMove(
                g,
                seat,
                { type: 'troop', handIdx: hi, flag: fs[Math.floor(Math.random() * fs.length)], draw: 'troop' },
                names
              );
              assert.equal(r.error, undefined, r.error);
              played = true;
              break;
            }
          }
        }
        if (!played) {
          const r = applyMove(g, seat, { type: 'pass', draw: 'troop' }, names);
          if (r.error) throw new Error('stuck: ' + r.error);
        }

        // 不変条件1: 両者完成済みフラッグの勝者は、実スコア比較と一致する
        for (const f of g.flags) {
          if (f.winner == null) continue;
          const need = needOf(f);
          if (f.cards[0].length >= need && f.cards[1].length >= need) {
            const s0 = bestScore(f.cards[0], need, fogged(f));
            const s1 = bestScore(f.cards[1], need, fogged(f));
            const c = s0[0] - s1[0] || s0[1] - s1[1];
            if (c !== 0) {
              const expected = c > 0 ? 0 : 1;
              assert.equal(f.winner, expected, `フラッグ勝者が実スコアと矛盾: ${JSON.stringify(f)}`);
            }
          }
        }

        // 不変条件2: 勝利が確定しているなら、実際に5本 or 隣接3本の条件を満たしている
        if (g.winner != null) {
          const w = g.flags.map((f) => f.winner);
          const total = w.filter((x) => x === g.winner).length;
          let streak = 0,
            maxStreak = 0;
          for (const x of w) {
            streak = x === g.winner ? streak + 1 : 0;
            maxStreak = Math.max(maxStreak, streak);
          }
          assert.ok(total >= 5 || maxStreak >= 3, `勝利条件を満たさずに勝者判定: total=${total} maxStreak=${maxStreak}`);
        }
        turns++;
      }
      if (g.winner == null && !g.draw) unfinished++;
    }
    // 手詰まり(山札切れ+連続パス)は引き分けとして決着するため、
    // 400手経っても未決着のまま残るゲームはごく僅かであるはず
    assert.ok(unfinished / 1000 < 0.05, `未決着のまま終わったゲームが多すぎる: ${unfinished}/1000`);
  });
});
