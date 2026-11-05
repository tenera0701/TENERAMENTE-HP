/* ===== オンライン説明の予約カレンダー（2026-11-05）=====
   空き日時は ATLAS の予約メニュー「ミエルーム オンライン説明（1時間）」から取る
   （ATLAS のカレンダーの予定の前後30分を空けた、翌日以降の 10:00〜18:00 開始・30分ごと・土日休み。
    長さ・きざみ・受付期間は ATLAS の「カレンダー → 予約フォーム設定 → 予約メニュー」で変えられる）。
   使い方: MieroomReserve.mount(要素, { api, via, prefill:{company,name,email,phone}, consented, privacyUrl, onDone }) */
(function () {
  var DOW = '日月火水木金土';
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function label(s) { var d = ymd(s); return (d.getMonth() + 1) + '月' + d.getDate() + '日（' + DOW[d.getDay()] + '）'; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toHalf(v) {
    return String(v || '').replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[－ー―‐−]/g, '-');
  }
  function telOk(v) { return /^0\d{9,10}$/.test(toHalf(v).replace(/-/g, '')); }
  function endOf(t, dur) {
    var p = t.split(':'), m = (+p[0]) * 60 + (+p[1]) + dur;
    return pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  }

  function mount(root, opt) {
    opt = opt || {};
    var pf = opt.prefill || {};
    var hasPf = !!(pf.name && EMAIL_RE.test(pf.email || '') && telOk(pf.phone));
    var S = { data: null, view: null, date: '', time: '' };
    root.classList.add('mrv');
    root.innerHTML = '<div class="mrv-load">空いている日時を読み込んでいます…</div>';

    function fail(msg) {
      root.innerHTML = '<div class="mrv-fail"><b>' + esc(msg) + '</b>お手数ですが、下の公式LINEから日程をご相談ください。</div>';
    }
    function load() {
      return fetch(opt.api, { credentials: 'omit' }).then(function (r) {
        return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; });
      }).then(function (j) { S.data = j; return j; });
    }
    function days() { return Object.keys((S.data && S.data.days) || {}).sort(); }

    load().then(function (j) {
      if (j.closed) { fail('ただいまWebでのご予約を受け付けておりません。'); return; }
      var ds = days();
      if (!ds.length) { fail('申し訳ありません、いまご予約いただける日時がありません。'); return; }
      var f = ymd(ds[0]);
      S.view = new Date(f.getFullYear(), f.getMonth(), 1);
      build();
    }).catch(function () { fail('予約カレンダーを読み込めませんでした。'); });

    function build() {
      var dur = S.data.duration_min || 60;
      var how = (S.data.meeting_mode === 'visit' ? 'ご来店' : 'オンライン（Google Meet）') + '・' + dur + '分';
      root.innerHTML =
        '<div class="mrv-grid">' +
          '<div class="mrv-col"><div class="mrv-step"><i>1</i>日にちを選ぶ</div>' +
            '<div class="mrv-hd"><button type="button" class="mrv-nav" data-nav="-1" aria-label="前の月">‹</button><b class="mrv-ym"></b>' +
            '<button type="button" class="mrv-nav" data-nav="1" aria-label="次の月">›</button></div>' +
            '<div class="mrv-cal"></div>' +
            '<div class="mrv-legend"><span>予約できる日</span><span>受付なし</span></div></div>' +
          '<div class="mrv-col mrv-tcol"><div class="mrv-step"><i>2</i>時間を選ぶ</div><div class="mrv-tbox"></div></div>' +
        '</div>' +
        '<div class="mrv-form" hidden>' +
          '<div class="mrv-step"><i>3</i>内容を確かめて予約する</div>' +
          '<div class="mrv-when"><b class="mrv-w"></b><span>' + esc(how) + '</span></div>' +
          (hasPf ? '<div class="mrv-who"><div>ご予約者：<b>' + esc(pf.name) + '</b> 様' + (pf.company ? '（' + esc(pf.company) + '）' : '') +
            '<br>' + esc(pf.email) + '　／　' + esc(pf.phone) + '</div><button type="button" class="mrv-edit">変更する</button></div>' : '') +
          '<div class="mrv-fields"' + (hasPf ? ' hidden' : '') + '>' +
            fld('company', '会社名・店舗名', 'text', 'organization', '例）〇〇不動産', false) +
            fld('name', 'お名前', 'text', 'name', '例）山田 太郎', true) +
            fld('email', 'メールアドレス', 'email', 'email', '例）info@example.co.jp', true) +
            fld('phone', '電話番号', 'tel', 'tel', '例）090-1234-5678', true) +
          '</div>' +
          '<div class="mrv-f full mrv-memo"><label for="mrv-memo">当日ご相談したいこと（任意）</label>' +
            '<textarea id="mrv-memo" maxlength="2000" placeholder="例）申込から入金までの管理をまとめたい、反響の数字を店舗ごとに見たい など"></textarea></div>' +
          (opt.consented
            ? '<p class="mrv-note">ご入力の内容は、<a href="' + esc(opt.privacyUrl || '../privacy.html') + '" target="_blank" rel="noopener">プライバシーポリシー</a>に沿って取り扱います。</p>'
            : '<label class="mrv-agree"><input type="checkbox" class="mrv-ok"><span><a href="' + esc(opt.privacyUrl || '../privacy.html') +
              '" target="_blank" rel="noopener">プライバシーポリシー</a>に同意する</span></label>') +
          '<div class="mrv-hp" aria-hidden="true"><input type="text" class="mrv-hpi" tabindex="-1" autocomplete="off"></div>' +
          '<div class="mrv-err" hidden></div>' +
          '<div class="mrv-go"><button type="button" class="btn btn-doc btn-lg mrv-send">この日時で予約する</button></div>' +
        '</div>';
      ['company', 'name', 'email', 'phone'].forEach(function (k) { var el = q('#mrv-' + k); if (el && pf[k]) el.value = pf[k]; });
      var ph = q('#mrv-phone');
      ph.addEventListener('input', function () { var v = toHalf(ph.value).replace(/[^0-9-]/g, ''); if (v !== ph.value) ph.value = v; });
      root.addEventListener('input', function (e) { var f = e.target.closest('.mrv-f'); if (f) f.classList.remove('bad'); });
      root.addEventListener('click', onClick);
      drawCal();
      drawTimes();
    }
    function fld(k, lab, type, ac, ph, req) {
      return '<div class="mrv-f"><label for="mrv-' + k + '">' + lab + (req ? '<em>*</em>' : '') + '</label>' +
        '<input id="mrv-' + k + '" type="' + type + '" autocomplete="' + ac + '" placeholder="' + esc(ph) + '"' +
        (type === 'tel' ? ' inputmode="tel"' : '') + (type === 'email' ? ' inputmode="email"' : '') +
        ' maxlength="' + (type === 'tel' ? 16 : 100) + '"></div>';
    }
    function q(sel) { return root.querySelector(sel); }

    function drawCal() {
      var v = S.view, ds = S.data.days, first = ymd(S.data.first_date), last = ymd(S.data.last_date);
      q('.mrv-ym').textContent = v.getFullYear() + '年' + (v.getMonth() + 1) + '月';
      q('[data-nav="-1"]').disabled = v <= new Date(first.getFullYear(), first.getMonth(), 1);
      q('[data-nav="1"]').disabled = v >= new Date(last.getFullYear(), last.getMonth(), 1);
      var h = '';
      for (var i = 0; i < 7; i++) h += '<div class="mrv-dw' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '') + '">' + DOW[i] + '</div>';
      for (i = 0; i < v.getDay(); i++) h += '<span></span>';
      var n = new Date(v.getFullYear(), v.getMonth() + 1, 0).getDate();
      for (var d = 1; d <= n; d++) {
        var s = iso(new Date(v.getFullYear(), v.getMonth(), d));
        h += (ds[s] && ds[s].length)
          ? '<button type="button" class="mrv-d ok' + (s === S.date ? ' sel' : '') + '" data-d="' + s + '" aria-label="' + label(s) + '">' + d + '</button>'
          : '<span class="mrv-d">' + d + '</span>';
      }
      q('.mrv-cal').innerHTML = h;
    }
    function drawTimes() {
      var box = q('.mrv-tbox');
      if (!S.date) { box.innerHTML = '<div class="mrv-empty">左のカレンダーで日にちを選ぶと、<br>空いている時間が出ます。</div>'; return; }
      var ts = S.data.days[S.date] || [];
      box.innerHTML = '<div class="mrv-date">' + label(S.date) + '</div>' + (ts.length
        ? '<div class="mrv-times">' + ts.map(function (t) {
            return '<button type="button" class="mrv-t' + (t === S.time ? ' sel' : '') + '" data-t="' + t + '">' + t + '</button>';
          }).join('') + '</div>'
        : '<div class="mrv-empty">この日は空きがなくなりました。<br>別の日をお選びください。</div>');
    }
    function showForm(on) {
      var f = q('.mrv-form');
      f.hidden = !on;
      if (on) q('.mrv-w').textContent = label(S.date) + ' ' + S.time + '〜' + endOf(S.time, S.data.duration_min || 60);
    }
    function err(msg) { var e = q('.mrv-err'); e.textContent = msg || ''; e.hidden = !msg; }
    function scrollTo(el) { if (window.innerWidth <= 760 || el.getBoundingClientRect().top > window.innerHeight - 120) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

    function onClick(e) {
      var b = e.target.closest('button');
      if (!b || !root.contains(b)) return;
      if (b.hasAttribute('data-nav')) {
        S.view = new Date(S.view.getFullYear(), S.view.getMonth() + (+b.getAttribute('data-nav')), 1); drawCal(); return;
      }
      if (b.hasAttribute('data-d')) {
        S.date = b.getAttribute('data-d'); S.time = ''; drawCal(); drawTimes(); showForm(false); err('');
        scrollTo(q('.mrv-tcol')); return;
      }
      if (b.hasAttribute('data-t')) {
        S.time = b.getAttribute('data-t'); drawTimes(); showForm(true); err(''); scrollTo(q('.mrv-form')); return;
      }
      if (b.classList.contains('mrv-edit')) {
        q('.mrv-fields').hidden = false; b.parentNode.style.display = 'none'; q('#mrv-name').focus(); return;
      }
      if (b.classList.contains('mrv-send')) send(b);
    }

    function val(k) { var el = q('#mrv-' + k); return el ? el.value.trim() : ''; }
    function send(btn) {
      err('');
      var bad = null;
      [['name', function (v) { return !!v; }], ['email', function (v) { return EMAIL_RE.test(v); }], ['phone', telOk]].forEach(function (c) {
        var ok = c[1](val(c[0]));
        q('#mrv-' + c[0]).closest('.mrv-f').classList.toggle('bad', !ok);
        if (!ok && !bad) bad = c[0];
      });
      if (bad) {
        q('.mrv-fields').hidden = false;
        var who = q('.mrv-who'); if (who) who.style.display = 'none';
        err(bad === 'phone' ? '電話番号を数字で入力してください（例：090-1234-5678）。' : bad === 'email' ? 'メールアドレスを正しく入力してください。' : 'お名前を入力してください。');
        q('#mrv-' + bad).focus(); return;
      }
      var agree = q('.mrv-ok');
      if (agree && !agree.checked) { agree.closest('.mrv-agree').classList.add('bad'); err('プライバシーポリシーへの同意にチェックを入れてください。'); return; }
      btn.disabled = true; btn.textContent = '送信中…';
      fetch(opt.api, {
        method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: S.date, time: S.time, customer_name: val('name'), company: val('company'),
          email: val('email'), phone: toHalf(val('phone')), memo: (q('#mrv-memo').value || '').trim(),
          agreed: true, via: opt.via || '', _hp: q('.mrv-hpi').value })
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { r: r, j: j }; });
      }).then(function (x) {
        if (x.r.status === 409) {
          err(x.j.error || 'この時間はちょうど埋まってしまいました。別の日時をお選びください。');
          S.time = '';
          return load().then(function () { drawCal(); drawTimes(); showForm(false); err(''); scrollTo(q('.mrv-tcol'));
            var box = q('.mrv-tbox'); box.insertAdjacentHTML('afterbegin', '<div class="mrv-err">' + esc(x.j.error || 'この時間はちょうど埋まってしまいました。別の時間をお選びください。') + '</div>'); });
        }
        if (!x.r.ok) throw new Error(x.j.error || '送信できませんでした。');
        done(x.j);
      }).catch(function (e2) {
        err((e2 && e2.message && !/fetch|network/i.test(e2.message)) ? e2.message : '送信できませんでした。通信状況をご確認のうえ、もう一度お試しください。');
      }).then(function () { if (document.body.contains(btn)) { btn.disabled = false; btn.textContent = 'この日時で予約する'; } });
    }
    function done(j) {
      root.innerHTML = '<div class="mrv-done"><span class="ok"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>' +
        '<h3>ご予約を受け付けました</h3><div class="w">' + esc(j.when || '') + '</div>' +
        '<p>' + (j.mail ? 'ご予約の内容を、メールでお送りしました。' + (j.online ? '<br>オンライン（Google Meet）の参加URLも、そのメールでご案内します。' : '')
                        : 'ご予約の内容は、担当者からあらためてご連絡いたします。') +
        '<br>日程の変更は、メールへのご返信でお知らせください。</p></div>';
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (opt.onDone) { try { opt.onDone(j); } catch (x) {} }
    }
  }

  window.MieroomReserve = { mount: mount };
})();
