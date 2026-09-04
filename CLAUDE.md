# 株式会社TENERAMENTE ブログ自動投稿ルール

このリポジトリは、GitHub Pages 上で公開されている TENERAMENTE 公式サイトです。
このファイルは **Claude Code が新しいブログ記事を自動で公開する際のルールブック** です。
人間が記事を書く場合も同じルールに従ってください。

---

## 1. リポジトリ構成

```
.
├── index.html / services.html / company.html / contact.html   … 通常ページ（手動更新）
├── blog.html                  … 記事一覧（data/posts.json を読んで描画）
├── blog-post.html             … 記事ページ（?slug=xxx を読んで描画するテンプレ）
├── data/posts.json            … 一覧用インデックス（build-index.js で自動生成）
├── posts/<slug>.md            … 記事本文（あなたが書くファイルはここだけ）
├── scripts/build-index.js     … インデックス & sitemap 再生成スクリプト
├── sitemap.xml                … 自動生成
└── llms.txt                   … AI検索向けサイト案内
```

**書き換えていいファイル:**
- `posts/<slug>.md` を新規作成する
- `scripts/build-index.js` を実行して `data/posts.json` と `sitemap.xml` を更新

**触らないファイル:**
- 上記以外（index.html / blog.html / blog-post.html / assets/ など）

---

## 2. 新記事を投稿する手順

### Step 1. テーマと slug を決める

- **テーマ**：ワークフロー実行時に渡されたテーマがあればそれを使用。なければ過去20本の記事を確認し、被らないトピックを `posts/` 配下を `ls` して把握してから選定する。
- **カテゴリ**を以下から1つ選ぶ：
  - `meo` … Google マップ・ローカル検索
  - `aio` … AI 検索エンジン最適化 (Perplexity, ChatGPT, AI Overviews)
  - `app` … 業務 Web アプリ / SaaS 開発
  - `hp`  … コーポレートサイト / ランディングページ制作
  - `ai`  … AI 活用全般 (社内導入, RAG, プロンプト)
- **slug**：`YYYY-MM-DD-kebab-case-summary` 形式の **半角英数字とハイフンのみ**。例: `2026-06-03-gbp-monthly-checklist`

### Step 2. `posts/<slug>.md` を作成

必ず以下の構造で書く。先頭にメタデータ、それ以降に本文。

```markdown
<!--META
{
  "title": "ここに日本語タイトル（カギ括弧や句読点は自由）",
  "date": "2026-06-03",
  "category": "meo",
  "excerpt": "1〜2文の要約。記事一覧カードと OGP description に使われます。",
  "tags": ["MEO", "GBP", "ローカル検索"]
}
META-->

ここからリード文（先頭の段落）。記事冒頭の「リード」として大きめに表示されます。1〜3行程度。**強調したいキーフレーズ**は太字で。

## 見出しの自然な日本語（番号は書かない。表示時に 01, 02… が自動で付く）

本文。`コード`、*斜体*、**太字** が使えます。

> 印象に残るプルクオート。1記事に0〜1個まで。

### 小見出しは ### で

リストも普通に：

- 項目1
- 項目2
- 項目3

数字付きリスト：

1. 第一
2. 第二

特別な注釈ボックスは生 HTML で：

<div class="callout">
  <span class="ico">!</span>
  <div>
    <h4>実例</h4>
    <p>ここに具体例。数字は実在の案件のものに限る。捏造禁止。</p>
  </div>
</div>

## 次の H2 セクション

…
```

### Step 3. インデックスと sitemap を再生成

```bash
node scripts/build-index.js
```

これで以下が更新される：
- `data/posts.json`（一覧用、新しい順にソート、ビジュアルバリアントと番号を自動採番）
- `sitemap.xml`（全 URL を再列挙）
- `<slug>.html`（記事ごとの静的ページ。OGP/canonical 用に自動生成される。手で編集しない）
- `assets/img/covers/<slug>.png`（カバー画像。タイトル・カテゴリ入りで自動生成。一覧カード・記事カバー・OGP画像に使われる。作り直したい時はPNGを削除して再ビルド）

### Step 4. コミット & プッシュ

ローカルで作業した場合は手動でコミット＆プッシュする（GitHub Pages が自動反映）：

```bash
git add posts/ data/ sitemap.xml *.html assets/img/covers/
git commit -m "blog: <slug> を追加"
git push
```

---

## 3. コンテンツのスタイルガイド

### 文量と構成
- 本文 **2,500〜4,500字（日本語）** が目安（"ちゃんとした"読み応えのある記事にする）
- H2 セクションは **6〜9本**（記事ページの**目次はこの H2 から自動生成**される。必ず複数の H2 を立てること）
- 各 H2 セクションは 250〜450字程度。必要に応じて `###` 小見出しで分ける
- 冒頭リードは 100〜200字、結論を含意する

### 記事に必ず入れる構造要素（参照: 目次つきの長文ガイド記事）
リード直後に **結論ボックス** を置く：
```html
<div class="conclusion">
  <h4>📌 この記事の結論</h4>
  <p>記事の要旨を1〜2文で。**太字**で要点を1つ強調。</p>
</div>
```
さらに記事内に以下を**できるだけ盛り込む**：
- **比較表・費用表**を1つ以上（Markdown の表 `| … |`。違いや料金の整理に有効）
- `<div class="callout">`（実例・補足）や `<div class="callout warn">`（注意点）を適宜
- 末尾に **FAQ** を3問程度：
```html
<details class="faq"><summary>よくある質問は？</summary><div class="faq-a">回答をここに。</div></details>
```
- 最後の H2 は「まとめ」や次の一歩を促す内容にし、自然に当社サービスへつなぐ

### 文体
- 「です・ます調」
- 一人称は「TENERAMENTE」または「当社」。「私たち」は控えめに。
- 専門用語は初出時に英語と日本語を併記（例: *AI Optimization*（AIO））
- 「優しく、専門的に」がブランドトーン。煽らない、断言しすぎない、でも歯切れよく。

### 強調の使い分け
- `**太字**` … 各段落で **キーフレーズ1つ**。ハイライト風の下線が引かれる。乱用厳禁。
- `*斜体*` … 英語の専門用語、強調的なフレーズ。セリフ体で表示される。
- `> blockquote` … 印象に残る一節。記事につき0〜1個。

### 数字・実例
- **数値は実在のものだけ**。架空の「3.2倍」「78%」などは絶対に書かない。
- 一般論で書ける場合は数字を使わない方が好ましい。
- 実例を入れたい場合は「業界全般の傾向として」「弊社の運用では一般に」など曖昧な範囲表現に留める。

### CTA
- 記事末は自然に当社サービスへ繋げる1段落。営業的すぎない。
- 「無料相談」「LINEで相談」などの直リンクは記事本文に書かない（テンプレ側に既にある）。

### 禁止事項
- メールアドレス・電話番号・架空の住所を本文に書かない
- 競合他社名を出すときは批判的なトーンにしない
- 著作権のある画像・図版は埋め込まない（テキストとコールアウトで表現する）

---

## 4. featured（注目記事）の運用

- featured 記事は **常に最新の1本のみ**。
- 新しく公開する記事を featured にしたい場合は frontmatter に `"featured": true` を入れる。
- `build-index.js` は featured が複数指定されても **最新1本だけを featured として残す** ので、過去記事を手動で false に書き換える必要はない。
- 既存の featured と差し替えたくない場合は `"featured": false`（または省略）で投稿する。

---

## 5. カテゴリのローテーション戦略

スケジュール自動投稿時、過去5本のカテゴリ分布を見て **直近で投稿していないカテゴリ** を優先する。理想配分は：

| カテゴリ | 月間目安 |
|----------|----------|
| meo / aio | 40% |
| ai        | 25% |
| app       | 20% |
| hp        | 15% |

---

## 6. 記事作成を依頼されたときの呼び出し例

（スケジュール自動投稿は廃止済み。記事はミルページ経由か、Claude Code への依頼で作成する）

> 「CLAUDE.md の手順に従って、新しいブログ記事を1本作成・公開してください。
> テーマは過去5本を確認の上、ローテーション戦略に従って自動選定。
> 完了後、`node scripts/build-index.js` を必ず実行してください。」

テーマの指定がある場合は、そのテーマで書く。

---

## 7. ローカル動作確認

`posts/`, `data/`, `assets/` などへの `fetch()` を含むため、ファイルを直接ブラウザで開いてもブログは動かない。最低限の HTTP サーバが必要：

```bash
# Node がある場合
npx serve .
# Python がある場合
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000/blog.html` を開いて確認する。

---

## 8. デザインシステム（2026-09 全面刷新）

サイト全体（`mieroom/` を除く）は **黒 × 紙白 × 青1色のエディトリアル** で統一されている。
ページを足す・直すときは以下に従う。

- **共通CSS**: `assets/site.css`（配色・タイポ・ボタン・罫線グリッド・ヘッダー/フッター・診断ウィジェット・LP互換クラス）。旧 `kintone.css` は廃止済み
- **共通JS**: `assets/chrome.js`（ヘッダー／ハンバーガーメニュー／フッター／スマホ固定CTA を `data-chrome="header|footer"` に差し込む）、`assets/site.js`（`.reveal` の出現・`.lines` の見出し立ち上がり・マーキー・パララックス）
- **ページの雛形**: `<html lang="ja" class="js">` → head に Google Fonts の `<link>`（Zen Kaku Gothic New / Shippori Mincho / Instrument Sans / Instrument Serif / IBM Plex Mono）と `assets/site.css` → `<body data-active="services">`（ナビの現在地）。黒いヒーローで始まるページは `<body data-hero="dark">` を付ける（ヘッダー文字が白になる）
- **部品**: 見出しは `.sec-head`（左に `.index` の番号ラベル、右に `.h2` と `.lead`）、リストは `.rows > .row`、罫線グリッドは `.cells.cells--3 > .cell`、実画面は `.frame`、黒セクションは `.sec--dark`、締めは `.cta-band`
- **禁止**: グラデーション文字・紫〜青グラデ・パステル・浮遊図形や粒子・絵文字アイコン・アイコンバッジ・同型カードの均等並び・ピル型ボタンの多色使い。装飾ではなく余白・罫線・番号・実画面で見せる
- **ロゴ**: `assets/img/brand/mark-*.png` `word-*.png`（`-dark` は紙白の上用、`-light` は黒の上用）。元画像 `logo-teneramente.png` から切り出したもの
- **ブログのカバー画像**: `scripts/gen-covers.js` が紙白ベースで自動生成。フォントは `C:/Users/<user>/.teneramente/cover-tools/fonts/`（Zen Kaku Gothic New / IBM Plex Mono / Shippori Mincho の TTF）を参照。作り直すときは `assets/img/covers/*.png` を消して `node scripts/build-index.js`
- **スマホの折り返し**: `assets/site.js` の orphanGuard が段落末尾の4文字（＋句読点）を `<span class="og">` で包み、「す。」だけが次行に落ちる“ぶら下がり”を全ページで自動防止する。見出しは `.lines`（1行=1ブロック）と `text-wrap: balance`、〜400px では見出しを一段小さくする（site.css 末尾）。新しい段落クラスを作ったら OG_SEL に追加する

---

## 9. 毎日の自動投稿（Claude Code クラウドルーティン）

2026-09-04 から、Claude Code のクラウドルーティン（毎日 06:00 JST）がこのリポジトリをチェックアウトし、
**TENERAMENTE ブログに1本、ミエルーム ブログに1本（計2本）** 書いて main に push する。GitHub Actions ではなく https://claude.ai/code/routines で管理する。
ミエルーム側の書き方は 10 章、待ち行列は `data/seo-keywords-mieroom.json`（`--site=mieroom`）。

- **狙いキーワードの待ち行列**: `data/seo-keywords.json`。上から順に `status: "todo"` を1日1件消化する。
  取りたいワードを足すときは同じ形式で末尾に追加する（`title` は仮題、`pillar` は本文中でリンクする自社ページ、`related` は関連記事の slug）。
- **操作スクリプト**: `node scripts/seo-queue.js next`（次の1件）／`done <id> <slug>`（消し込み）／`list`／`remaining`
- **記事の書き方**はこのファイルの 2〜5 章のとおり。加えて、主キーワードを title の前半・リード文・H2 のどれか1つに自然に入れ、
  `pillar` へ本文中で1回、`related` へ1〜2回、相対リンクで内部リンクする。数値・事例の捏造は絶対に禁止。
- ルーティンは記事を書いたあと `node scripts/build-mieroom.js` → `node scripts/build-index.js` の順に実行し、posts/・mieroom/posts/・mieroom/articles/・mieroom/blog.html・data/・sitemap.xml・生成記事ページ・カバー画像をコミットして push する。
  カバー画像の生成には `@resvg/resvg-js` と `~/.teneramente/cover-tools/fonts/` のフォントが必要で、無い環境ではカバー無しで続行する（後で再生成できる）。
- ミルページ取り込み（`sync-milpage.yml`）は 07:05／19:05 JST に動く。ルーティンの投稿とは干渉しない（CMS側の記事だけを追加・更新し、削除はしない）。

---

## 10. ミエルーム ブログの記事ルール（mieroom/posts/）

ミエルーム（賃貸仲介向け 業務管理SaaS）のブログは、TENERAMENTE ブログとは別の仕組み・別の読者。

- **置き場所**: `mieroom/posts/<slug>.md`（slug は日付なしの半角英数字＋ハイフン。既存の `mieroom/articles/*.html` と重複させない）
- **生成**: `node scripts/build-mieroom.js` が `mieroom/articles/<slug>.html` と `mieroom/blog.html` の一覧を更新する。そのあと `node scripts/build-index.js` を実行すると sitemap に載る
- **META**: `title` / `date`（YYYY-MM-DD）/ `category` / `excerpt`（1〜2文）/ `tags`（3〜5個）。category は次の5つのどれか: `売上管理` `業務効率化` `集客・広告` `組織・育成` `DX`
- **本文**: 2,000〜3,000字、H2 は「## 見出し」で5〜8本（番号は書かない。既存記事と同じ見た目にする）。**Markdown の表は使えない**（変換器が未対応。箇条書きで書く）。使えるのは見出し・段落・箇条書き・番号付き・太字・斜体・リンク・行頭が `<` の生HTML
- **読者**: 賃貸仲介・不動産仲介の店舗オーナー、店長、これから開業する人。「です・ます」調。一人称は「ミエルーム」または「当社」
- **内部リンク**（記事は `mieroom/articles/` に置かれるので相対パスに注意）: 製品トップ `../index.html`、機能・事例 `../features.html`、他の記事 `./<slug>.html`、TENERAMENTE 側のページ `../../lp-ai.html` など
- **書いてよい製品の事実**: 申込管理表／売上管理／反響管理／接客管理／申込・入金管理（後ADを案件ごとに記録、一部入金・分割入金、確定売上と見込みの分離）／接客・反響成績の可視化／反響分析／フォーム自動取込・メール自動取込／間取り作成／社内契約フォーマット自動取込／物件コンバータ／業者間サイト連携／LINE・SMS自動追客／経理・勤怠・給与／デモアカウント発行／最短即日スタート／Excel データのインポートと初期設定の代行に対応。**無料お試し期間は無い**（FAQ に明記。「無料で試せる」と書かない）。**料金は書かない**（ページに記載がない）
- **狙いキーワード**: `data/seo-keywords-mieroom.json`（`node scripts/seo-queue.js next --site=mieroom` / `done <id> <slug> --site=mieroom`）
- 数値・事例・実績の捏造禁止、競合批判なし、連絡先を書かない、は TENERAMENTE ブログと同じ
