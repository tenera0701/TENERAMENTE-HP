# 株式会社TENERAMENTE ブログ自動投稿ルール

このリポジトリは、GitHub Pages 上で公開されている TENERAMENTE 公式サイトです。
このファイルは **Claude Code が新しいブログ記事を自動で公開する際のルールブック** です。
人間が記事を書く場合も同じルールに従ってください。

---

## 1. リポジトリ構成

```
.
├── index.html / services.html / company.html / contact.html   … 通常ページ（手動更新）
├── blog.html                  … 記事一覧（カードはビルドが HTML に書き込む。JS はページ送りと絞り込み）
├── blog-post.html             … 記事ページのテンプレ（ビルドが <slug>.html を作る元）
├── <slug>.html                … 記事ページ（build-index.js が題名・本文・目次・関連記事・サービス案内まで書き込む）
├── data/posts.json            … 一覧用インデックス（build-index.js で自動生成）
├── posts/<slug>.md            … 記事本文（あなたが書くファイルはここだけ）
├── scripts/build-index.js     … 記事ページ・一覧・インデックス & sitemap の再生成スクリプト
├── scripts/vendor/marked.min.js … Markdown 変換（ブラウザと同じ marked 12.0.2。npm 不要）
├── sitemap.xml                … 自動生成
└── llms.txt                   … AI検索向けサイト案内
```

**書き換えていいファイル:**
- `posts/<slug>.md` を新規作成する
- `scripts/build-index.js` を実行して `data/posts.json`・`sitemap.xml`・`blog.html` の一覧・`<slug>.html` を更新

**触らないファイル:**
- 上記以外（index.html / blog-post.html / assets/ など。blog.html はビルドが一覧の部分だけ書き換える）

**記事ページは本文まで HTML に書き出す（2026-10-28〜）。** 以前は本文をブラウザの JS で後から描いていたため、
検索エンジンが最初に受け取る HTML には題名も本文も無く、Search Console で「検出 - インデックス未登録」が76件たまっていた。
今は `build-index.js` が Markdown を HTML にして `<slug>.html` に書き込み、`blog.html` にも全記事のリンクを書き込む。
関連記事は「同じ系統で公開日が近い3本」なので、新しい記事を足すと、日付が近い既存記事のページも書き換わる（正常）。

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
- 本文 **4,000〜6,000字（日本語）**（2026-10-28 社長の指示「中身をもっと分厚く」。それまでは毎朝の指示書が 2,000〜2,800字・H2 5〜8本、このファイルが 2,500〜4,500字・H2 6〜9本で食い違っていた）。
  分厚くするのは具体性で、同じことの言い換え・一般論の水増しで字数を稼がない
- H2 セクションは **7〜10本**（記事ページの**目次はこの H2 から自動生成**される。必ず複数の H2 を立てること）
- 各 H2 セクションは 350〜650字程度。必要に応じて `###` 小見出しで分ける
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
- **チェックリスト**（読者がそのまま使える確認項目の箇条書き）と、**よくある失敗とその避け方**を必ず入れる
- **記事の最後の3つの H2 は「自分で進める場合と、専門家に任せる場合の分かれ目」→「よくある質問」→「まとめ」の順**にする（2026-10-28〜）。
  「分かれ目」は判断の基準を一般論として書く（自社名・自社サービス・数字は出さない）。依頼を考えている読者の判断材料になり、問い合わせにつながる
- 「よくある質問」の H2 の下に **FAQ** を4〜5問：
```html
<details class="faq"><summary>よくある質問は？</summary><div class="faq-a">回答をここに。</div></details>
```
- 最後の H2 は「まとめ」や次の一歩を促す内容にし、自然に当社サービスへつなぐ

### 文体
- 「です・ます調」
- 一人称は「TENERAMENTE」または「当社」。「私たち」は控えめに。
- 専門用語は初出時に英語と日本語を併記（例: *AI Optimization*（AIO））
- 「優しく、専門的に」がブランドトーン。煽らない、断言しすぎない、でも歯切れよく。

### 書き方の落とし穴（表示が崩れる。2026-10-28 に既存記事で見つかった）
- **太字の内側の最初と最後の文字を、括弧・引用符・句読点にしない。** `**「下書き」**`・`**オーナー確認（任意）**を`・`**“見える”運用**` は太字にならず `**` がそのまま出る（17記事で発生）。`「**下書き**」`・`**オーナー確認**（任意）を` のように、記号を太字の外に出す
- **行頭が `<` の生HTML（callout・conclusion など）の中では Markdown が効かない。** リンクは `<a href="…">`、太字は `<strong>` で書く（`[文字](URL)` のまま表示された記事が2本あった）

### 強調の使い分け
- `**太字**` … 各段落で **キーフレーズ1つ**。ハイライト風の下線が引かれる。乱用厳禁。
- `*斜体*` … 英語の専門用語、強調的なフレーズ。セリフ体で表示される。
- `> blockquote` … 印象に残る一節。記事につき0〜1個。

### 数字・実例
- **数値は実在のものだけ**。架空の「3.2倍」「78%」などは絶対に書かない。
- 一般論で書ける場合は数字を使わない方が好ましい。
- 実例を入れたい場合は「業界全般の傾向として」「弊社の運用では一般に」など曖昧な範囲表現に留める。

### CTA（訴求は「最後だけ」）
- **記事の途中で自社サービスを訴求しない。** 本文の途中に `lp-ai.html` `lp-ai-app.html` `services.html` や、ミエルームの `../index.html` `../features.html` へのリンクを置かない。「当社では〜」「ミエルームでは〜」と自社のやり方を語る段落も途中には置かない。
- 訴求は**最後のH2セクションの末尾に1段落だけ**。そこで初めて pillar（自社サービスページ）へ1回リンクし、最後の一文で問い合わせに誘う。TENERAMENTE 側は `contact.html` へ1回リンクしてよい。
- **最後の訴求段落は具体的に書く**（2026-10-11〜）。「ご覧ください」「お手伝いしています」だけで終わらせない。1段落の中で次の3つを順に書く：
  1. **「TENERAMENTEなら〜」「ミエルームなら〜」で始め、この記事の課題を自社サービスのどの機能・進め方でどう解決できるか**を具体的に（記事で挙げた手間や失敗に対応させる。ミエルームは 10 章の「書いてよい製品の事実」の範囲だけ）
  2. それで**業務がどう楽になるか**を1文（数字は使わない）
  3. **問い合わせへの誘導**で締める。TENERAMENTE は「[お問い合わせ](contact.html)からお気軽にご相談ください」。ミエルームはサイト内に問い合わせページが無いので「デモアカウントの発行やご相談は、この下のボタンからお気軽にどうぞ」（記事の直下にテンプレのボタンがある）
  - 例（ミエルーム・申込管理の記事）: 「ミエルームなら、申込から入金・後ADまでを案件ごとに1行で記録でき、確定売上と見込みも分かれて表示されるので、月末に管理表を突き合わせる作業がなくなります。〜。デモアカウントの発行やご相談は、この下のボタンからお気軽にどうぞ。」
- 「無料相談」「LINEで相談」「デモ申込」などの外部直リンクは記事本文に書かない（テンプレ側に既にある）。「初回相談60分は無料」のように事実を書くのは可。
- 他のブログ記事へのリンクは途中にあってよい（読者の役に立つため）。
- **記事の下には、内容に合うサービス案内のカードがビルドで自動で入る**（2026-10-28〜。`build-index.js` の `SERVICE_CARDS`。
  キーワードの待ち行列の `pillar`、無ければカテゴリで選ぶ。ボタンは `contact.html?svc=meo` のように相談したいサービスに最初からチェックが入った問い合わせフォームと、サービスページ）。
  本文に同じ案内を書き足さない。カードの文言は各サービスページに書いてある事実だけ

### トップページに出す「おすすめ記事」
- TENERAMENTE のトップ（index.html）のブログ3件は、`scripts/build-index.js` の `HOME_PICKUP` に並べた slug の順で表示される。ここを空にすると従来どおり最新3件になる。
- ミエルームのトップ（mieroom/index.html）のブログ3件は、HTML に直接書いてある（`a.btcard` が3つ）。画像は `assets/cover-bg/<name>.webp` を使う。
- **アクセス解析**（2026-09-23 時点）: GA4（G-7GB2364PBY）と Clarity（xyhqpguofs）は**ミルページ**が読み込む（ID はミルページの管理画面で設定。Cookie バナーで「同意する」を押した訪問者だけ計測）。Search Console は sc-domain:teneramente.jp で設定済み。**assets/analytics.js で計測タグを読み込まないこと**（同意前にも計測してしまい、同意した人は二重に数えられる）。「よく読まれている記事」はまだ編集部の選定。GA4 にデータが溜まったら実績ベースに置き換える。

### カバー画像（記事のトップ画像）
- **最優先は、ChatGPT で作ったタイトル入りの画像（在庫）。** キューの項目に `coverTitle` があれば、手元の定期タスクが ChatGPT で作った画像が `assets/img/cover-queue/<キューID>.png`（ミエルームは `mieroom/assets/cover-queue/<キューID>.png`）に置いてある。
  - **記事のタイトルは coverTitle と一字一句同じにする**（画像はそのタイトルを ChatGPT に渡して作ってあり、見出しにも描かれているため。変えると画像と食い違う）
  - `node scripts/seo-queue.js done <id> <slug>` がこの画像を `covers/<slug>.png` にコピーし、ビルドはそれを作り直さずにそのまま使う
  - 在庫フォルダ（cover-queue）の中身はルーティンから触らない。作り方・ChatGPT への指示文は `assets/img/cover-queue/README.md`
- **カバーは記事ごとに ChatGPT で作る（2026-10-28〜。社長の指示「記事の内容によってデザインを変えたい」）。**
  ルーティンはコードで仮のカバーを作って公開し、そのあと手元の定期タスク `blog-cover-chatgpt`（毎日9:30・16:30）が、
  **2026-10-28 以降に公開した記事**のうち ChatGPT の画像が無いものを、その記事の題名で ChatGPT に作らせて差し替え、push する。
  ルーティンは画像について何もしなくてよい。過去の仮カバーの記事は差し替えない（社長の決定）
  - 手元のタスクは専用の命令1本（todo｜place｜zoom｜publish｜verify）で動き、このリポジトリの写しを手元に別に持って作業する（手順の正はブログ担当のマニュアル。リポジトリには置かない）
  - 中身は `place-ai-cover.py <site> <キューID> <元画像> "<記事のタイトル>" --published` → `build-mieroom.js` → `build-index.js` → push と同じ
  - 前もって作る「在庫」（下の coverTitle の仕組み）も残してあるが、今は使っていない
- 以下は、仮のカバーをコードで作る仕組みの説明。
- カバーは `scripts/gen-covers.js` が生成する。**記事のテーマに合わせた背景画像**を敷き、その上に見出しを重ねる形。
- 背景は `assets/img/cover-bg/<name>.jpg`（TENERAMENTE、紙白×黒×青）と `mieroom/assets/cover-bg/<name>.{webp,jpg}`（ミエルーム、緑×テラコッタ）。ChatGPT の画像生成で作り、1200×675 に整えてある。**文字は入れない**（見出しはビルド時に重ねるため）。ミエルーム側は同じ絵柄を webp と jpg の両方で置く（ページ表示は webp、カバー生成は jpg。resvg が webp を読めないため）
- **背景の絵柄は1記事につき1回だけ使う。一度使った絵柄は、ほかの記事には二度と使わない**（2026-10-11〜）。使用台帳 `data/cover-bg-used.json`（ミエルームは `data/cover-bg-used-mieroom.json`）に「絵柄 → 使った記事」が残る。台帳を手で消したり、使用済みの絵柄を別の記事に指定したりしない
  - 割り当ての順番: その記事専用の絵柄（`cover-bg/<slug>.jpg`、`gen-covers.js` の `BG_BY_SLUG`、ミエルームは `build-mieroom.js` の `COVER_BY_SLUG`）→ まだ誰も使っていない絵柄。`BG_BY_CATEGORY` / `COVER_BY_CATEGORY` はもう使わない
  - 空いている絵柄が無いときは、slug から描く**記事ごとに違うコード生成の絵**（`art` レイアウト）になる。絵の型は13種類（flow / radial / wave / grid / stack / bars / orbit / funnel / contour / mesh / steps / tiles / arcs）あり、`cover-art.js` の `assignMotifs()` が **slug から選んだうえで、近い7本とは必ず違う型**になるよう割り当てる（日付で回すと型の数だけ日が空いたとき同じ絵に戻るため、2026-10-13 にこの方式へ変えた）。型が同じでも中心・大きさ・傾き・要素の数・差し色の位置は記事ごとに変わるので、同じ絵にはならない
  - 既に出したコード生成のカバーを作り直すときは `COVER_REGEN=1 node scripts/build-mieroom.js` → `COVER_REGEN=1 node scripts/build-index.js`。ChatGPT の在庫を使った記事と背景画像を使った記事は上書きしない（PNG を消す必要はない）
  - 新しい背景を cover-bg に足すと、次にカバーを作る記事がそれを1回だけ使う
- ミエルームも TENERAMENTE と同じく**タイトル入りのカバーを自動生成**する（2026-09-06〜）。`scripts/gen-covers-mieroom.js` が `mieroom/assets/covers/<slug>.png`（1200×675）を作り、記事ヒーロー・`blog.html` のカード・OGP画像に使う。背景の絵柄は上の使用台帳のルール（1記事1回）で決まり、その上に「MIEROOM — BLOG」ラベル・タイトル・META の `hook`・日付が乗る。作り直したいときは PNG を消して再ビルドする
- 新しい背景を足すときは、既存と同じ配色・同じ作り（画面の右側に絵柄、左半分は余白、文字なし、横長）にそろえる
- **表示用の WebP は自動で作られる**（2026-09-20〜）。`scripts/gen-webp.js` がカバーPNGから `<slug>.webp`（記事ヒーロー用・元の幅）と `<slug>-card.webp`（一覧カード用・幅640px）を作り、ビルドが一覧・トップ・記事ヒーローでそれを使う。**PNG は OGP 用に残す**（SNS が WebP を読めないことがあるため）。変換には Python(Pillow) か sharp のどちらかが要る。両方無い環境では変換をスキップし、既にある WebP をそのまま使う（新しい記事だけ PNG 表示になる）

### 図版（記事に1枚入れる）
- 記事1本につき図版を1枚入れる。手順は次のとおり。
  1. `data/figures.json` に定義を足す（`type` は `steps` 横並びのステップ／`rows` 縦の番号つきリスト／`compare` 2〜3列の対比／`pipeline` 業務の流れ）
  2. `node scripts/gen-figures.js` で PNG を生成（TENERAMENTE は `assets/img/figures/`、ミエルームは `mieroom/assets/figures/`）
  3. `node scripts/insert-figures.js` で記事に差し込む（`anchor` に指定した H2 の最初の段落の直後に入る）
- 図版の中身は**本文に書いてある事実だけ**を図にする。図版のためにデータを作らない。
- ミエルーム記事の figure は**1行のHTML**で書く（変換器が行頭 `<` の行をそのまま通すため）。

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
- ルーティンは記事を書いたあと `node scripts/build-mieroom.js` → `node scripts/build-index.js` の順に実行し、posts/・mieroom/posts/・mieroom/articles/・mieroom/blog.html・data/・sitemap.xml・blog.html・生成記事ページ（`20*.html`。新しい記事と、関連記事が書き換わった既存記事）・カバー画像をコミットして push する。
- **狙いキーワードは問い合わせに近い言葉を優先する**（2026-10-28〜）。費用・選び方・依頼・比較・業種別・名古屋など、依頼を考えている人が調べる言葉。
  待ち行列の `intent` の（）内の注意（「数字は書かない」「他社を批判しない」など）は必ず守る
  カバー画像の生成には `@resvg/resvg-js` と `~/.teneramente/cover-tools/fonts/` のフォントが必要で、無い環境ではカバー無しで続行する（後で再生成できる）。
- ミルページ取り込み（`sync-milpage.yml`）は 07:05／19:05 JST に動く。ルーティンの投稿とは干渉しない（CMS側の記事だけを追加・更新し、削除はしない）。

---

## 10. ミエルーム ブログの記事ルール（mieroom/posts/）

ミエルーム（賃貸仲介向け 業務管理SaaS）のブログは、TENERAMENTE ブログとは別の仕組み・別の読者。

- **置き場所**: `mieroom/posts/<slug>.md`（slug は日付なしの半角英数字＋ハイフン。既存の `mieroom/articles/*.html` と重複させない）
- **下書き置き場**: `mieroom/drafts/<slug>.md`。**ビルド対象外**（公開されない）。公開するときは `mieroom/posts/` へ移してビルドする。自動投稿ではここを読まない・書かない
- **生成**: `node scripts/build-mieroom.js` が `mieroom/articles/<slug>.html`・`mieroom/blog.html` の一覧・`mieroom/assets/covers/<slug>.png`（カバー画像）を更新する。そのあと `node scripts/build-index.js` を実行すると sitemap に載る
- **META**: `title` / `date`（YYYY-MM-DD）/ `category` / `excerpt`（1〜2文）/ `hook`（カバー画像に載る一言。18〜24字。記事を読みたくなる要点を1つ）/ `tags`（3〜5個）。category は次の5つのどれか: `売上管理` `業務効率化` `集客・広告` `組織・育成` `DX`
- **本文**: 4,000〜5,500字、H2 は「## 見出し」で7〜9本（番号は書かない。2026-10-28 社長の指示で分厚くした。それまでは 2,000〜3,000字・5〜8本）。チェックリスト・よくある失敗と、最後の3つの H2「自分で進める場合と、ツールや専門家に任せる場合の分かれ目」→「よくある質問」→「まとめ」は 3 章と同じく入れる。3 章の「書き方の落とし穴」も同じ。使えるのは見出し・段落・箇条書き・番号付き・**表**（`| … |`）・太字・斜体・リンク・行頭が `<` の生HTML
- **記事の構成は TENERAMENTE ブログと同じにする**（2026-09-06〜）。リード → 結論ボックス → 目次（自動）→ 本文 → FAQ → まとめ の順で書く：
  - **目次**は H2 から `build-mieroom.js` が自動生成し、結論ボックスの直後・最初の H2 の直前に入る。書かなくてよい（H2 が2本以上あるときだけ出る）
  - **結論ボックス**はリード直後に置く: `<div class="conclusion"><h4>この記事の結論</h4><p>要旨を1〜2文。<strong>要点</strong>を1つ強調。</p></div>`
  - **比較表**を1つ以上入れる（Markdown の表が使えるようになった）
  - **FAQ** を末尾のまとめの前に4〜5問: `<details class="faq"><summary>質問</summary><div class="faq-a">回答</div></details>`
  - 補足は `<div class="callout"><div class="ct"><span class="ci">✓</span>見出し</div><p>本文</p></div>`、注意は `<div class="callout warn">…</div>`
- **読者**: 賃貸仲介・不動産仲介の店舗オーナー、店長、これから開業する人。「です・ます」調。一人称は「ミエルーム」または「当社」
- **最後の訴求**は 3 章「CTA」の「最後の訴求段落は具体的に書く」に従う（「ミエルームなら〜」→ 楽になること → 「デモアカウントの発行やご相談は、この下のボタンからお気軽にどうぞ」）
- **内部リンク**（記事は `mieroom/articles/` に置かれるので相対パスに注意）: 製品トップ `../index.html`、機能・事例 `../features.html`、他の記事 `./<slug>.html`、TENERAMENTE 側のページ `../../lp-ai.html` など
- **書いてよい製品の事実**: 申込管理表／売上管理／反響管理／接客管理／申込・入金管理（後ADを案件ごとに記録、一部入金・分割入金、確定売上と見込みの分離）／接客・反響成績の可視化／反響分析／フォーム自動取込・メール自動取込／間取り作成／社内契約フォーマット自動取込／物件コンバータ／業者間サイト連携／LINE・SMS自動追客／経理・勤怠・給与／デモアカウント発行／最短即日スタート／Excel データのインポートと初期設定の代行に対応。**無料お試し期間は無い**（FAQ に明記。「無料で試せる」と書かない）。**料金は書かない**（ページに記載がない）
- **機能の使い方ページ**（2026-09-24〜）: `mieroom/guide/<slug>.html` の16枚（トップの「主要機能」カードから開く）は `node scripts/build-mieroom-guide.js` が作る**生成ページ**。手で直さない。中身は `scripts/mieroom-guide-data.js`（出典はアプリ本体の使い方ガイド `templates/guide.html` だけ。オプションかどうかは `app.py` の NAV_PERM_OPTION_KEYS・PLAN_OPTION_DEFS も見て、option に明記）、実画面は `scripts/make-mieroom-guide-shots.py` がアプリの `static/manual/*.png`（一部は LP 用の実画面 `mieroom/assets/app-*.webp` と、アプリのフォルダ内の営業資料・営業LPの素材 `app:`）から切り出す。開発用URL・QR・電話番号・メールアドレス・住所（番地）・免許番号・実在の企業名はぼかす（位置は元画像の座標で決め打ち。元画像が撮り直されるとスクリプトが止まるので、ぼかし位置を確かめてから `--accept` で作り直す）。毎朝の自動投稿では触らない（sitemap への掲載だけ build-index.js が行う）
- **比較ページ**: `mieroom/compare.html`（賃貸仲介の業務管理システム比較）。他社情報は公式サイトに記載のある内容のみ・出典リンク付き・自社サービスを含む比較である旨を明記する。他社の短所は書かない。更新するときは確認日も直す
- **狙いキーワード**: `data/seo-keywords-mieroom.json`（`node scripts/seo-queue.js next --site=mieroom` / `done <id> <slug> --site=mieroom`）
- 数値・事例・実績の捏造禁止、競合批判なし、連絡先を書かない、は TENERAMENTE ブログと同じ
