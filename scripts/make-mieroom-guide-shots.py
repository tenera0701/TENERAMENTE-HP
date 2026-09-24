# -*- coding: utf-8 -*-
"""
ミエルーム「機能の使い方」ページ用の実画面を、アプリの使い方ガイドの画像から切り出す。
  元画像: WEBアプリ/ミエルーム/static/manual/*.png（株式会社デモの画面。2880px幅は2倍解像度）
          'lp:' で始まるものは LP 用に切り出し済みの実画面（mieroom/assets/app-*.webp）
          'app:' で始まるものはアプリのフォルダの中の画像（営業資料・営業LPの素材）
  出力  : mieroom/assets/guide/<名前>.webp（幅は最大1400px）
使い方: python scripts/make-mieroom-guide-shots.py [名前 ...]   （名前を省くと全部作る）

ぼかしの位置は元画像のピクセル座標で決め打ちしている。アプリ側で元画像が撮り直されると、
ぼかしがずれて隠したはずの文字（電話番号・実在の企業名など）が出てしまうので、
元画像の中身（SHA-1）を scripts/mieroom-guide-shots.lock.json に控えておき、変わっていたら作らずに止まる。
新しい元画像でぼかし位置を確かめ直したら、--accept を付けて実行すると控えを更新して作る。
"""
import hashlib, json, os, sys
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(os.path.dirname(os.path.dirname(ROOT)), 'WEBアプリ', 'ミエルーム')   # 'app:' で始まる元画像はアプリのフォルダからの相対パス
MAN = os.path.join(APP, 'static', 'manual')
OUT = os.path.join(ROOT, 'mieroom', 'assets', 'guide')
LP = os.path.join(ROOT, 'mieroom', 'assets')   # 'lp:' で始まる元画像は LP 用に切り出し済みの実画面
LOCK = os.path.join(ROOT, 'scripts', 'mieroom-guide-shots.lock.json')
SIDEBAR = 420          # 左メニューの幅（2880px幅の画面）
MAXW = 1400

def top(src, y0=0, x0=SIDEBAR, ratio=0.625):
    """左メニューを外して、上から 16:10 で切り出す"""
    return (src, ('ratio', x0, y0, ratio))

SHOTS = {
    # ぼかし（3つ目）は切り出す前の元画像の座標。5つ目の数字があればぼかしの強さ（QRコードは読めないよう強くする）、'white' なら白で塗って空欄にする
    # 申込管理表：管理会社の列はデモでも実在の企業名が入っているのでぼかす（表の下の枠線までにとどめる）
    'moushikomi-list':    top('customer-management.png') + ([(1525, 880, 1745, 1540)],),
    'moushikomi-input':   ('modal-cm-input.png', ('modal-top', 0.55)),
    'moushikomi-paid':    top('customer-management.png', y0=2230) + ([(1690, 2440, 1925, 3693)],),
    'moushikomi-unpaid':  top('customer-management.png', y0=3780) + ([(1690, 3990, 1925, 5243)],),
    'uriage-top':         top('executive.png'),
    'uriage-staff':       ('executive.png', ('box', SIDEBAR, 1835, 2880, 2700)),   # スタッフ別今月実績（下の媒体割合は手順3で別に出す）
    'uriage-media':       ('executive.png', ('box', SIDEBAR, 2712, 2880, 3525)),   # 今月の反響（媒体割合）
    # 反響分析：使い方ガイドの leads.png は読み込み中の空の画面、LP の app-leads.webp は数字の少ない8月なので、
    # 営業資料の素材（2026年7月・今のアプリと同じ画面）と、営業LPの素材（月次トレンドが1〜6月まで欠けずに入っている）を使う
    'hankyo-top':         ('app:営業資料/deck-src/img/leads.png', ('box', 282, 0, 1890, 1215)),     # 合計のカード〜媒体別詳細の表（右上のボタンと申込数のカードが欠けない所まで）
    'hankyo-table':       ('app:営業資料/deck-src/img/leads.png', ('box', 282, 525, 1862, 1212)),   # 媒体別詳細の表の拡大（CVR の列まで）
    # 月次トレンドは、1〜6月がそろう営業LPの素材も当月（6月）が月の途中までで急落して見えるので使わない
    'sekkyaku-list':      top('customer-service.png'),
    'sekkyaku-card':      ('handoff.png', ('box', 0, 0, 2560, 815), [(240, 245, 760, 282)]),   # 引継ぎカードの希望条件まで。電話番号とメールをぼかす
    # 営業分析は LP 用の実画面（7月分）。使い方ガイドの sales.png は月の途中で率が100%を超えて見える
    'seiseki-kpi':        ('lp:app-sales.webp', ('box', 233, 0, 1600, 817)),
    'seiseki-annual':     top('staff-annual.png'),
    # 来店・申込フォーム：開発用URL（127.0.0.1）の欄と、それを読めるQRコードをぼかす
    'form-visit':         top('store-visits.png') + ([(955, 604, 1700, 672), (550, 485, 865, 800, 30)],),
    'form-reserve':       top('reservation-settings.png'),
    'form-apply':         top('application-form.png') + ([(955, 628, 1700, 690), (925, 1308, 1700, 1370), (550, 490, 865, 800, 30), (535, 1168, 850, 1480, 30)],),
    'mail-settings':      top('mail-import.png') + ([(525, 920, 775, 968)],),   # 連携するGmailアドレスの例（shop@example.com）をぼかす
    'mail-reply':         ('echo-reply-mobile.png', None, [(165, 66, 372, 100), (400, 66, 562, 100)]),   # メールアドレスと電話番号をぼかす
    'line-steps':         top('line_steps.png'),
    'line-step-phone':    ('line_steps-phone.png', None),   # 配信ステップと、携帯での見え方
    'tsuikyaku-settings': top('mail-automation.png') + ([(525, 1178, 985, 1222), (570, 1355, 822, 1405)],),   # ポータル登録の入力例のメールアドレス（info@smocca.jp）をぼかす
    'tsuikyaku-ai':       ('mail-automation.png', ('box', 440, 560, 2100, 940)),   # 「自動追客」の欄（AIが追客し続けるスイッチ）の拡大
    # 物件コンバータの一覧は2行目から実在の物件が写るので、ボタンの並びとデモ物件の1行目までで切る（所在地の番地はぼかす）
    'converter-top':      ('converter.png', ('box', SIDEBAR, 0, 2880, 806), [(967, 775, 1024, 801)]),
    'converter-new':      ('modal-converter-new.png', 'modal'),
    # 物確は LP 用の実画面（使い方ガイドの property-confirm.png はテスト用の中身）。元付会社の列（会社名・電話番号）をぼかす
    'bukkaku-list':       ('lp:app-bukkaku.webp', ('box', 233, 0, 1600, 855), [(1205, 520, 1362, 855)]),
    # 初期費用：見積に載る会社の住所・電話番号・免許番号・登録番号をぼかす
    'shoki-input':        top('initial-cost.png') + ([(2430, 318, 2805, 458)],),
    'shoki-share':        top('initial-cost-share.png') + ([(2430, 440, 2805, 572)],),
    # floorplan.png・myosoku.png は中身が空の画面なので使わない（完成したマイソクの画像だけ使う）
    # 「テスト物件（手で直した）」は白で塗って空欄にし、所在地の番地と、下の帯の店名・住所・電話番号・免許番号をぼかす
    'maisoku-sheet':      ('myosoku-sheet.png', None, [(145, 26, 340, 46, 'white'), (262, 97, 300, 118), (258, 1003, 452, 1037), (25, 1037, 690, 1062)]),
    'keiyaku-format':     top('doc-templates.png') + ([(980, 772, 1420, 1442)],),   # 会社情報（FAX・登録番号・メール・代表者・住所・免許番号など）の値をぼかす
    'keiyaku-list':       top('contract-customers.png') + ([(1418, 545, 1625, 1540)],),   # 管理会社の列
    'keiyaku-checklist':  ('contract-checklist.png', ('box', 0, 0, 1280, 1180), [(30, 78, 175, 116)]),   # テスト用に見えるお客様名
    'chat':               ('chat.png', ('box', SIDEBAR, 0, 2880, 830)),   # 下のスタンプ選択欄が会話に重なるので、その上まで
    'chat-group':         ('chat-group-store.png', None),
    'kintai':             ('attendance.png', ('box', SIDEBAR, 730, 2880, 2229)),   # 上の「打刻できません」の注意書きを外して、シフト表の見出しから、勤怠一覧の行の区切りまで
    'kyuyo':              top('payroll.png'),
    'keiri-receipts':     ('accounting-receipts.png', 'modal'),   # 承認済みの領収書が経理に入った画面（ポップの部分だけ）
    'keiri':              top('accounting.png'),
}

def src_path(src):
    if src.startswith('lp:'):
        return os.path.join(LP, src[3:])
    if src.startswith('app:'):
        return os.path.join(APP, *src[4:].split('/'))
    return os.path.join(MAN, src)

def sha1(path):
    with open(path, 'rb') as f:
        return hashlib.sha1(f.read()).hexdigest()

def modal_box(im):
    """暗い背景の上に出た白いポップの範囲を探す"""
    g = im.convert('L'); W, H = g.size
    mid = H // 2
    xs = [x for x in range(W) if g.getpixel((x, mid)) > 235]
    ys = [y for y in range(H) if g.getpixel((W // 2, y)) > 235]
    return (min(xs), min(ys), max(xs) + 1, max(ys) + 1)

def make(name):
    spec = SHOTS[name]
    src, how = spec[0], spec[1]
    blurs = spec[2] if len(spec) > 2 else []
    im = Image.open(src_path(src)).convert('RGB')
    for b in blurs:   # 見せたくない文字（開発用URL・電話番号・実在の企業名）を、切り出す前の座標でぼかす
        box, radius = b[:4], (b[4] if len(b) > 4 else 12)
        if radius == 'white':
            im.paste((255, 255, 255), box)
        else:
            im.paste(im.crop(box).filter(ImageFilter.GaussianBlur(radius)), box[:2])
    W, H = im.size
    if how == 'modal':
        im = im.crop(modal_box(im))
    elif how and how[0] == 'modal-top':
        x0, y0, x1, y1 = modal_box(im)
        im = im.crop((x0, y0, x1, y0 + round((y1 - y0) * how[1])))
    elif how and how[0] == 'ratio':
        _, x0, y0, ratio = how
        w = W - x0; h = min(round(w * ratio), H - y0)
        im = im.crop((x0, y0, W, y0 + h))
    elif how and how[0] == 'box':
        im = im.crop(how[1:])
    if im.width > MAXW:
        im = im.resize((MAXW, round(im.height * MAXW / im.width)), Image.LANCZOS)
    out = os.path.join(OUT, name + '.webp')
    im.save(out, 'WEBP', quality=80, method=6)
    return im.size, os.path.getsize(out)

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    accept = '--accept' in sys.argv
    names = args or list(SHOTS)
    lock = json.load(open(LOCK, encoding='utf-8')) if os.path.exists(LOCK) else {}
    total = 0; skipped = []
    for n in names:
        src = SHOTS[n][0]
        h = sha1(src_path(src))
        if n in lock and lock[n]['src'] == src and lock[n]['sha1'] != h and not accept:   # 同じ元画像の中身が変わったときだけ止める
            skipped.append(n)
            print(f'× {n:20s} 元画像 {src} が撮り直されています。ぼかし位置を確かめてから --accept で作り直してください（今の画像はそのまま）')
            continue
        size, b = make(n); total += b
        lock[n] = {'src': src, 'sha1': h}
        print(f'{n:20s} {size[0]}x{size[1]}  {b//1024}KB')
    for n in [k for k in lock if k not in SHOTS]:   # 使わなくなった画像の控えは消す
        del lock[n]
    with open(LOCK, 'w', encoding='utf-8') as f:
        json.dump(dict(sorted(lock.items())), f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'合計 {len(names) - len(skipped)}枚 {total//1024}KB' + (f'（止めた {len(skipped)}枚）' if skipped else ''))
    if skipped:
        sys.exit(1)
