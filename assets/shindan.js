/* TENERAMENTE — AI×WEBアプリ開発 無料診断ウィジェット
   使い方: ページに <div id="shindan-widget"></div> を置いてこのファイルを読み込む。
   8問（Q3は複数選択＋その他入力）→ リード獲得フォーム → ATLASへ送信 → 結果表示。 */
(function () {
  const mount = document.getElementById('shindan-widget');
  if (!mount) return;

  const ATLAS_ENDPOINT = 'https://web-production-2f388.up.railway.app/api/public-inquiries';

  const QUESTIONS = [
    { t: '社内でAI活用はどのレベルですか？', type: 'single',
      o: [['ほぼ使っていない', 3], ['チャット型をたまに使う', 2], ['簡単な自動化はできている', 1], ['仕組みから社内管理までできている', 0]] },
    { t: 'いま一番の課題は何ですか？', type: 'single',
      o: [['AIが自社の役に立つのかわからない', 1], ['AIで様々な業務を補助してほしい', 2], ['社員がAIを使いこなせない／教育したい', 2], ['社内ツールをオリジナルで作りたい', 3]] },
    { t: '日々のPC業務は何が中心ですか？', type: 'multi', note: '複数選択できます',
      o: [['Excel・紙で情報など管理', 2], ['複数の市販ツールを使ってる', 1], ['データ入力が多い', 2], ['管理はバラバラで整理してない', 2], ['システム化できている', 0]], other: true },
    { t: '同じ情報を別の場所へ「転記」する作業はありますか？', type: 'single', note: '例）紙からExcelへ入力し直す など',
      o: [['毎日ある', 3], ['週に数回ある', 2], ['ほとんどない', 0]] },
    { t: '「あの人しか分からない業務」はありますか？', type: 'single',
      o: [['複数ある', 3], ['数個ある', 2], ['ない', 0]] },
    { t: '月末月初の集計・報告資料づくりに、毎月どれくらい時間がかかっていますか？', type: 'single',
      o: [['1日かかる', 3], ['半日以上かかる', 2], ['2〜3時間かかる', 1], ['自動化できてる', 0]] },
    { t: '市販ツールを使ってみての感想は？', type: 'single',
      o: [['機能は完ぺきで困っていない', 0], ['7割くらいは合っているが、3割は痒い所に手が届かない', 2], ['自社には合っていないが、いいツールがない', 3], ['何も使っていない', 2]] },
    { t: '業務改善の優先度はどれくらいですか？', type: 'single',
      o: [['今すぐ変えたい', 3], ['2〜3か月以内', 2], ['半年以内くらいには', 1], ['まずは何ができるのか気になる', 1]] },
  ];
  const RANKS = {
    A: { min: 15, comment: 'アプリ化・AI化で大きく改善できる可能性が高い状態です。改善インパクトの大きい業務から、具体的なご提案ができます。' },
    B: { min: 8,  comment: '部分的なアプリ化・AI活用から始めるのがおすすめの状態です。「一番面倒な業務」に絞った改善が費用対効果に優れます。' },
    C: { min: 0,  comment: 'まずは生成AIの活用・業務の棚卸しから始めるのがおすすめです。次の一手を整理したレポートをお送りします。' },
  };

  let idx = 0;
  const answers = [];   // {label(s), point}
  let finished = false;

  mount.innerHTML = `
  <div class="sq-card">
    <div class="sq-progress"></div>
    <div class="sq-quiz">
      <div class="sq-count"></div>
      <h3 class="sq-title"></h3>
      <p class="sq-note"></p>
      <div class="sq-opts"></div>
      <div class="sq-other hidden"><input type="text" placeholder="その他の内容（任意で入力）" maxlength="80"></div>
      <div class="sq-nav">
        <button type="button" class="sq-back hidden">← 戻る</button>
        <button type="button" class="sq-next hidden">次へ →</button>
      </div>
    </div>
    <div class="sq-lead hidden">
      <div class="sq-lead-head">
        <h3>📋 診断完了！<span class="sq-free">結果レポートを受け取る（無料）</span></h3>
        <p>強み・課題・おすすめの次の一歩をまとめた<strong>診断結果レポート</strong>を、ご入力のメールアドレスへお送りします。ご希望に応じて、担当より3営業日以内にご連絡します。</p>
      </div>
      <div class="sq-form">
        <div class="sq-row2">
          <div class="sq-field"><label>会社名 or 店舗名 <i>*</i></label><input type="text" name="sq-company" placeholder="株式会社◯◯ / ◯◯店"></div>
          <div class="sq-field"><label>担当者氏名 <i>*</i></label><input type="text" name="sq-name" placeholder="山田 太郎"></div>
        </div>
        <div class="sq-row2">
          <div class="sq-field"><label>役職 <i>*</i></label><input type="text" name="sq-role" placeholder="代表 / 店長 など"></div>
          <div class="sq-field"><label>メールアドレス <i>*</i></label><input type="email" name="sq-email" placeholder="you@example.com"></div>
        </div>
        <div class="sq-row2">
          <div class="sq-field"><label>電話番号 <i>*</i></label><input type="tel" name="sq-phone" inputmode="tel" placeholder="09012345678"></div>
          <div class="sq-field"><label>従業員数 <i>*</i></label>
            <select name="sq-emp"><option value="">選択してください</option><option>1〜5名</option><option>6〜20名</option><option>21〜50名</option><option>51名以上</option></select></div>
        </div>
        <div class="sq-field"><label>会社規模（拠点・店舗数） <i>*</i></label>
          <select name="sq-sites"><option value="">選択してください</option><option>1拠点・1店舗</option><option>2〜5拠点・店舗</option><option>6〜10拠点・店舗</option><option>11拠点・店舗以上</option></select></div>
        <div class="sq-field"><label>お困りごとなど（任意）</label><textarea name="sq-memo" rows="3" placeholder="例）営業部門の提案書作成を自動化したい"></textarea></div>
        <input type="text" name="sq-hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;top:-9999px;" aria-hidden="true">
        <p class="sq-err hidden">未入力の必須項目（<i>*</i>）があります。</p>
        <p class="sq-senderr hidden">送信に失敗しました。時間をおいて再度お試しください。</p>
        <button type="button" class="btn btn-primary btn-lg sq-submit">無料診断の結果を受け取る <span class="arr">→</span></button>
        <p class="sq-privacy">送信情報は診断結果のご案内・サービスのご提案のみに利用します。しつこい営業は行いません。</p>
      </div>
    </div>
    <div class="sq-done hidden">
      <div class="sq-rank"></div>
      <h3 class="sq-done-title">送信ありがとうございました！</h3>
      <p class="sq-done-body"></p>
      <p class="sq-done-note">診断結果レポートをメールでお送りしました。届かない場合は迷惑メールフォルダをご確認ください。</p>
      <a href="https://lin.ee/yfRAgr9" target="_blank" rel="noopener" class="btn btn-line btn-lg"><svg viewBox="0 0 36 36" fill="currentColor" class="ico" style="width:20px;height:20px;"><path d="M18 3C9.16 3 2 8.85 2 16.1c0 6.5 5.7 11.95 13.4 12.97.52.11 1.23.34 1.41.78.16.4.1.99.05 1.4l-.22 1.36c-.07.4-.32 1.58 1.38.86 1.71-.72 9.18-5.4 12.52-9.25C32.81 21.6 34 19 34 16.1 34 8.85 26.84 3 18 3z"/></svg>LINE問合せ</a>
    </div>
  </div>`;

  const $ = (sel) => mount.querySelector(sel);
  const progress = $('.sq-progress');
  QUESTIONS.forEach(() => { const i = document.createElement('i'); progress.appendChild(i); });

  function render() {
    const q = QUESTIONS[idx];
    $('.sq-count').textContent = 'Q' + (idx + 1) + ' / ' + QUESTIONS.length;
    $('.sq-title').textContent = q.t;
    $('.sq-note').textContent = q.note || '';
    $('.sq-note').classList.toggle('hidden', !q.note);
    const opts = $('.sq-opts'); opts.innerHTML = '';
    const saved = answers[idx];
    q.o.forEach(([label, pt], oi) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sq-opt';
      b.innerHTML = '<span class="mk"></span><span class="tx">' + label + '</span>';
      if (q.type === 'multi') {
        if (saved && saved.sel && saved.sel.indexOf(oi) >= 0) b.classList.add('on');
        b.addEventListener('click', () => { b.classList.toggle('on'); });
      } else {
        b.addEventListener('click', () => { answers[idx] = { label: label, point: pt }; next(); });
      }
      opts.appendChild(b);
    });
    const otherWrap = $('.sq-other');
    if (q.other) {
      otherWrap.classList.remove('hidden');
      otherWrap.querySelector('input').value = (saved && saved.other) || '';
    } else otherWrap.classList.add('hidden');
    $('.sq-next').classList.toggle('hidden', q.type !== 'multi');
    $('.sq-back').classList.toggle('hidden', idx === 0);
    progress.querySelectorAll('i').forEach((seg, i) => seg.classList.toggle('on', i <= idx));
  }

  function collectMulti() {
    const q = QUESTIONS[idx];
    const sel = [], labels = [];
    let pts = 0;
    mount.querySelectorAll('.sq-opt').forEach((b, oi) => {
      if (b.classList.contains('on')) { sel.push(oi); labels.push(q.o[oi][0]); pts += q.o[oi][1]; }
    });
    const other = $('.sq-other input').value.trim();
    if (other) { labels.push('その他: ' + other); pts += 1; }
    if (!labels.length) return null;
    return { label: labels.join('、'), point: Math.min(pts, 3), sel: sel, other: other };
  }

  function next() {
    if (idx < QUESTIONS.length - 1) { idx++; render(); }
    else showLead();
  }
  $('.sq-next').addEventListener('click', () => {
    const a = collectMulti();
    if (!a) { $('.sq-opts').classList.add('shake'); setTimeout(() => $('.sq-opts').classList.remove('shake'), 400); return; }
    answers[idx] = a; next();
  });
  $('.sq-back').addEventListener('click', () => { if (idx > 0) { idx--; render(); } });

  function score() { return answers.reduce((a, b) => a + (b ? b.point : 0), 0); }
  function rank() { const s = score(); return s >= RANKS.A.min ? 'A' : s >= RANKS.B.min ? 'B' : 'C'; }

  function showLead() {
    finished = true;
    $('.sq-quiz').classList.add('hidden');
    $('.sq-lead').classList.remove('hidden');
    progress.querySelectorAll('i').forEach(seg => seg.classList.add('on'));
    mount.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (typeof fbq === 'function') fbq('trackCustom', 'DiagnosisComplete', { rank: rank(), score: score() });
  }

  $('.sq-submit').addEventListener('click', async () => {
    const get = (n) => mount.querySelector('[name="' + n + '"]');
    const req = ['sq-company', 'sq-name', 'sq-role', 'sq-email', 'sq-phone', 'sq-emp', 'sq-sites'];
    let ok = true;
    req.forEach(n => {
      const el = get(n);
      const bad = !el.value.trim();
      el.classList.toggle('err', bad);
      if (bad) ok = false;
    });
    $('.sq-err').classList.toggle('hidden', ok);
    if (!ok) return;

    const r = rank(), s = score();
    const qa = QUESTIONS.map((q, i) => 'Q' + (i + 1) + ' ' + q.t + '\n→ ' + (answers[i] ? answers[i].label : '-')).join('\n');
    const memo = get('sq-memo').value.trim();
    const btn = $('.sq-submit');
    btn.disabled = true; btn.textContent = '送信中…';
    $('.sq-senderr').classList.add('hidden');
    try {
      const res = await fetch(ATLAS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'TENERAMENTE HP 無料診断',
          name: get('sq-name').value.trim(),
          email: get('sq-email').value.trim(),
          phone: get('sq-phone').value.trim(),
          company: get('sq-company').value.trim(),
          subject: '無料診断（ランク' + r + '・スコア' + s + '/24）',
          body: (memo ? 'お困りごと: ' + memo + '\n\n' : '') + '【診断回答】\n' + qa,
          '診断ランク': r + '（' + s + '/24）',
          '役職': get('sq-role').value.trim(),
          '電話番号': get('sq-phone').value.trim(),
          '従業員数': get('sq-emp').value,
          '拠点・店舗数': get('sq-sites').value,
          _hp: get('sq-hp').value,
        }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      $('.sq-lead').classList.add('hidden');
      const done = $('.sq-done');
      done.classList.remove('hidden');
      $('.sq-rank').textContent = r;
      $('.sq-rank').className = 'sq-rank r' + r.toLowerCase();
      $('.sq-done-body').textContent = '診断結果：ランク' + r + ' ── ' + RANKS[r].comment;
      mount.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (typeof fbq === 'function') { fbq('track', 'Lead'); fbq('track', 'Contact'); }
    } catch (err) {
      console.error('[shindan] send failed:', err);
      $('.sq-senderr').classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '無料診断の結果を受け取る <span class="arr">→</span>';
    }
  });

  render();
})();
