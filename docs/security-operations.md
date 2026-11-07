# coderdojo.kamiyama.club 構成・セキュリティ運用メモ

サイトの管理者・手伝ってくれる人向け。構成を変えたときはこのファイルも更新する。
**見直し周期: 半年ごと（5月・11月）**。最終確認: 2026-11-07

## 1. 構成

```
note（RSS）───────┐
                   ├─ GitHub Actions（6時間ごと）─ assets/data/*.json をコミット ─┐
Googleカレンダー（公開ICS）┘                                                       │
                                                                                   ▼
                       master への push ── GitHub Actions「Deploy」── Jekyll ビルド ── Cloudflare Pages
                                                                                   │
                                Route 53（CNAME coderdojo → coderdojo-kamiyama.pages.dev）
```

| 役割 | サービス / アカウント |
|---|---|
| ソース | GitHub `motohasystem/cdkamiyama_jekyll`（公開リポジトリ） |
| 配信 | Cloudflare Pages `coderdojo-kamiyama`（ddssk.m@gmail.com のアカウント） |
| DNS | AWS Route 53（`kamiyama.club` ゾーン） |
| レジストラ | Gandi（移管ロック有効） |
| 取り込み元 | note `cdkamiyama` マガジン RSS、Googleカレンダー「CoderDojo神山神領・広野」 |

- サイトは静的ファイルのみ。サーバー側の処理（Pages Functions）やフォーム・ログインは持たない。参加申込は外部の Google フォームへのリンク。
- 旧ホスティング（Netlify `coderdojokamiyama`）はリポジトリ連携を解除済み。不要になったら削除する。

## 2. 認証情報の一覧

| 用途 | 種類 | 置き場所 | 権限 |
|---|---|---|---|
| note RSS の取得 | なし（公開RSS） | ― | ― |
| カレンダーの取得 | なし（公開ICS） | ― | ― |
| 取り込み結果のコミット・デプロイ起動 | `GITHUB_TOKEN`（Actions が自動発行） | ― | contents: write, actions: write（そのジョブの間だけ有効） |
| Pages へのデプロイ | Cloudflare API トークン | GitHub Secrets `CLOUDFLARE_API_TOKEN` | Account / Cloudflare Pages / Edit のみ |
| 〃 | アカウントID（秘密ではない） | GitHub Secrets `CLOUDFLARE_ACCOUNT_ID` | ― |

- Cloudflare トークンは **デプロイのジョブにだけ** 渡す。取り込みジョブには渡さない。
- **ローテーション: 1年ごと**（トークン作成時に有効期限を付ける）。手順: Cloudflare で新トークン作成 → `gh secret set CLOUDFLARE_API_TOKEN -R motohasystem/cdkamiyama_jekyll` → Actions の「Deploy to Cloudflare Pages」を手動実行して成功を確認 → 古いトークンを削除。
- 手元から wrangler を使うときは、仕事用アカウントと混ざらないよう `XDG_CONFIG_HOME=$USERPROFILE/.config-cdkamiyama` を付けて実行する。

## 3. 取り込みデータの扱い（XSS対策）

- 描画はすべて `textContent`（HTMLとして解釈しない）。`assets/js/bsky.js`, `assets/js/next_events.js`
- URL は https のみ。note のリンクは `note.com`、サムネイルは `assets.st-note.com` に限定（取り込み側 `scripts/` と描画側の両方で検査）。
- 上流から iframe や script は持ち込まない。iframe はページに直接書いたもの（Googleカレンダー/マップ、YouTube、SUZURI、note）だけ。
- テスト: `tests/test_feeds.py`（取り込み）、`tests/test_render.js`（描画）。`<script>`・`javascript:`・`data:`・偽ドメインを入れたときの挙動を確認している。CI で毎回実行。

## 4. 自動反映の方針と安全装置

- **方針: 人の承認を挟まず自動反映する。** 上流のアカウント（note / Google）を守ることが前提（7章）。
- 取り込みが **0件**、または **前回の半分未満に急減** したら、ファイルを書き換えずにジョブを失敗させる（`scripts/feed_guard.py`）。サイトには前回の内容が出続ける。意図した減少なら、ワークフローを手動実行するか、手元で `--allow-drop` を付けて実行する。
- 取得そのものに失敗した場合もジョブが失敗し、コミットもデプロイも起きない。Pages は丸ごと切り替わる（アトミック）ので、壊れた中途半端な状態は配信されない。
- 差分はすべて git の履歴に残る（`chore: update ... json` のコミット）。
- **カレンダーに入れた予定は説明文も含めて自動で公開される。** 公開したくない予定は別のカレンダーに入れること。

## 5. 依存関係

| 種類 | 固定方法 | 更新 |
|---|---|---|
| Ruby / Jekyll / gem | `Gemfile.lock`（Ruby 3.4.8） | Dependabot（毎週） |
| Python（取り込み） | `requirements.txt` | Dependabot（毎週） |
| wrangler（デプロイ） | `package-lock.json` | Dependabot（毎週） |
| GitHub Actions | メジャーバージョンのタグ | Dependabot（毎週） |

Dependabot の PR は、中身（変更履歴）を見てからマージする。マージすると本番にデプロイされる。

## 6. 公開面の設定

レスポンスヘッダは `_headers` で設定（Cloudflare Pages）。

- `Content-Security-Policy`: インラインスクリプト禁止。許可している外部ドメイン:
  - script: `kit.fontawesome.com`, `ka-f.fontawesome.com`（Font Awesome。**外部JSなので最も注意が必要**。自前ホストに置き換えると外せる）
  - style / font: Google Fonts（`fonts.googleapis.com`, `fonts.gstatic.com`）、Font Awesome
  - img: `assets.st-note.com`（note のサムネイル）
  - frame: `calendar.google.com`, `www.google.com`, `www.youtube.com`, `suzuri.jp`, `note.com`
- そのほか HSTS、`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`。HTTP→HTTPS は Cloudflare が 301 で転送。
- `*.pages.dev` のURLには `X-Robots-Tag: noindex` を付けている。
- **外部の埋め込みやスクリプトを追加するときは、CSP にドメインを足す**（足さないとブラウザがブロックする）。インラインの `<script>` や `onclick=` は使えないので、`assets/js/` にファイルとして置く。

## 7. 管理者が確認・維持すること（コードでは担保できないもの）

- [ ] note・Google・GitHub・Cloudflare・AWS・Gandi・Netlify の全アカウントで2段階認証を有効にする（Workspace なら管理コンソールで強制）
- [ ] note マガジン・Googleカレンダーの編集権限者を最小限にし、一覧を持つ（閲覧と編集を分ける）
- [ ] 離脱者が出たら、上記サービスの権限をその日のうちに外す
- [ ] Route 53 に CAA レコードを追加する。現在の証明書は Google Trust Services（`pki.goog`）発行（2026-11-07 確認）。Cloudflare は更新時に別の発行元を使うことがあるため、Cloudflare が使う発行元をまとめて許可する: `0 issue "pki.goog"`, `0 issue "letsencrypt.org"`, `0 issue "ssl.com"`。kamiyama.club の他のサブドメイン（Netlify 等）が使う発行元も含めること（Netlify は Let's Encrypt）
- [ ] Route 53 で DNSSEC を有効にし、Gandi に DS レコードを登録する
- [ ] 使わなくなったサブドメインの CNAME を消す。特に **Netlify 側のサイトを消すときは、先に DNS の CNAME を消す**（逆順だとサブドメインを乗っ取られる恐れ）。対象: `hirono.coderdojo`（別アカウントの Netlify）、`kiero`
- [ ] Actions の失敗通知が届くか確認する（GitHub の Settings → Notifications → Actions）

## 8. 監視

- 取り込み・ビルド・デプロイの失敗: GitHub Actions の失敗通知メール（上記設定）
- 死活監視・改ざん検知: 未設定。導入するなら外部の死活監視サービスでトップページと `assets/data/events.json` を監視する

## 9. 上流が乗っ取られた・おかしな内容が出たときの手順

1. **取り込みを止める**
   `gh workflow disable "Update Note Feed JSON" -R motohasystem/cdkamiyama_jekyll`
   `gh workflow disable "Update Events JSON" -R motohasystem/cdkamiyama_jekyll`
2. **サイトを前回の正常な版に戻す**
   Cloudflare ダッシュボード → Workers & Pages → `coderdojo-kamiyama` → Deployments → 正常だった版の「Rollback」。
   恒久的に戻すなら、問題の `chore: update ... json` コミットを `git revert` して push。
3. **アカウントを回復する**: パスワード変更、2段階認証の再設定、不審なセッション・連携アプリの削除、投稿の削除。
4. **原因を確認してから取り込みを再開**: `gh workflow enable ...`
5. 必要なら Cloudflare API トークンも作り直す（2章の手順）。

## 10. ローカルでの確認

WSL の Ubuntu で（Docker を使用）:

```bash
cd /mnt/c/Users/ddssk/Documents/MotohaSystem/WebSites/coderdojo.kamiyama.club
docker compose up                         # http://localhost:4000/
docker compose run --rm cdkamiyama build  # ビルドのみ
```

ローカルのプレビューには `_headers` は効かない。CSP を確かめたいときは、プレビュー用ブランチとして Pages に出す:
`npx wrangler pages deploy _site --project-name coderdojo-kamiyama --branch csp-check` → `https://csp-check.coderdojo-kamiyama.pages.dev`
