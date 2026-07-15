# Battle Line — オンライン対戦

バトルライン(Battle Line / Schotten Totten)の2人対戦Webアプリ。Next.js (App Router) 上でポーリング方式のREST APIを提供し、WebSocketや外部DBは不要です。

## 起動方法

```bash
npm install
npm run dev       # 開発サーバー http://localhost:3000

npm run build     # 本番ビルド
npm start         # 本番起動 http://localhost:3000 (PORT環境変数を尊重)
```

動作確認用テスト:

```bash
npm test          # ゲームロジックのランダム対戦100回 (test.js)
npm run test:e2e  # サーバー起動後、API経由のフル対戦テスト (e2e.js)
```

## 遊び方

1. トップページで「部屋を作る」→ `/room/XXXXXX` に遷移し、6文字の部屋IDが発行される
2. 相手は「部屋に入る」からIDを入力(またはURLを直接開く)して入室
3. 双方が揃うと「ゲーム開始」ボタンが表示される
4. 手札のカードをクリック → フラッグをクリックで配置。戦術カードは画面のガイドに従って対象を選択
5. 手番の最後に引く山札(部隊/戦術)はフッターのトグルで選択

自分の手札は自分にしか見えません。相手の手札は「部隊 n 枚 + 戦術 m 枚」の枚数だけが裏面カードとして表示されます。

## 実装しているルール

- 部隊カード60枚(6色 × 1〜10)、戦術カード10枚すべて
  - 士気: アレキサンダー / ダリウス / 援軍騎兵 / 盾兵(ワイルド)
  - 地形: 霧(合計値判定) / 泥沼(4枚編成)
  - 奇計: 偵察 / 再配置 / 脱走 / 裏切り
- リーダーは1人1ゲーム1枚、戦術カードは相手の使用枚数+1枚まで
- 編成の強さ: ウェッジ > ファランクス > 大隊 > スカーミッシュ > ホスト、同格は合計値 → 先に完成した側
- フラッグの確定は自動判定。片側のみ完成の場合も「未公開カードでは相手が上回れない」ことを列挙で証明できれば確定
- 勝利条件: フラッグ5本、または隣接3本

### 簡略化している点

- フラッグの主張(claim)は手番開始時の宣言制ではなく、着手のたびに自動判定
- 「上回れない証明」は未公開の部隊カードのみを対象(相手が今後引く戦術ワイルドの可能性は考慮しない)

## アーキテクチャ

Next.js (App Router) + Atomic Design構成。

```
src/
  app/
    page.tsx              ホーム画面(部屋作成/入室) — templatesを呼ぶだけの薄いページ
    room/[id]/page.tsx     待機室〜対戦画面 — 同上
    api/rooms/...          Route Handlers。部屋管理(メモリ上のMap) + REST API
    globals.css             全体のトークン/リセットCSS(革・羊皮紙・ブロンズのトンマナ)
  lib/battle-line/
    game.ts                ルールエンジン(純粋ロジック、Next.js非依存)
    com.ts                 COM(AI)対戦ロジック
    rooms.ts                部屋のメモリ管理(globalThisに保持し、HMRでも状態を維持)
  hooks/
    useGameRoom.ts          1.5秒間隔で /api/rooms/:id/state をポーリングするフック
  components/
    atoms/                  Card, Button, Badge, FlagMarker など最小単位
    molecules/               HandCard, TacticListItem, DrawPrefToggle など
    organisms/                GameBoard, GameHeader, HelpModal, ResultModal など
    templates/                 HomeTemplate, WaitingRoomTemplate, GameTemplate
```

- 部屋はメモリ保持、12時間アクセスがなければ自動削除
- 座席はトークン(localStorage保存)で識別。リロードや回線切断後も同じ席に復帰可能
- `next start` は永続Node プロセスなので、旧server.js構成と同様にメモリ上のMapが動作中は保持される(サーバーレス関数のような都度起動には非対応)

## デプロイ

GitHub Pagesは静的ホスティングのみでサーバープロセスを動かせないため、このままでは不可。安価な選択肢:

| 方法 | 費用 | 備考 |
|---|---|---|
| **Render (Web Service, Free)** | 無料 | このリポジトリをそのままデプロイ可。無操作でスリープ→初回アクセスが遅い |
| **Fly.io / Railway** | 無料枠〜数百円/月 | スリープなし運用がしやすい |
| **Cloudflare Workers + Durable Objects** | 実質無料 | 要コード移植(Route Handlers→Workers)。部屋=Durable Objectの相性が最高 |
| **GH Pages + Firebase/Supabase** | 無料枠 | フロントだけGH Pagesに置き、状態をBaaSに持たせる構成なら可能 |

### Render へのデプロイ例(Next.js版)

1. GitHubにこのリポジトリをpush
2. Render で New → Web Service → リポジトリを選択
3. Build Command: `npm install && npm run build`
4. Start Command: `npm start`
   - `package.json` の `start` スクリプトは `next start -p ${PORT:-3000}` としてあり、Renderが自動注入する環境変数 `PORT` を利用する
5. Node バージョンは18以上を指定(Renderの環境変数 `NODE_VERSION` または `.node-version` で明示するとよい)

### 注意(本番化する場合)

- 状態がメモリのみなので、**再起動で全部屋が消える**・**複数インスタンスにスケールできない**。本格運用時はRedisやDurable Objectsへ移す
- レートリミット・入力サイズ制限は未実装。公開時は `express-rate-limit` 相当のミドルウェアやRenderのレート制限機能の追加を推奨
- Render無料プランはビルド時に `NODE_ENV=production` が設定されるため、`npm run build` 後の `.next` を含めてデプロイされることを確認する
