#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ChatGPT で作ったブログのトップ画像を、毎朝のルーティンに渡せる形に整えて「在庫」に置く。

  python scripts/place-ai-cover.py <teneramente|mieroom> <キューID> <元画像のパス> "<記事のタイトル>" [--logo] [--wipe=x0,y0,x1,y1]

やること
  1. 既存のカバーと同じ寸法に切り抜く（TENERAMENTE 1200x630 / ミエルーム 1200x675。中央基準）
  2. --logo を付けたときだけ、左上に本物のロゴを載せる（左上が空いている絵のときだけ使う。
     ChatGPT の絵は左上まで描き込まれていることが多く、板を重ねると絵が壊れるので既定では載せない）
     ChatGPT が偽のロゴ・キャッチコピーを描いたときは --wipe=x0,y0,x1,y1（切り抜き後の座標）で地の色で消し、
     --logo を付ければ本物のロゴをそこに置く
  3. assets/img/cover-queue/<ID>.png（ミエルームは mieroom/assets/cover-queue/<ID>.png）に保存
  4. キューの項目に coverTitle（ChatGPT に「内容」として渡した記事タイトル）と coverImage（在庫のパス）を書き込む

このあとルーティンは coverTitle どおりのタイトルで記事を書き、
`node scripts/seo-queue.js done <ID> <slug>` がこの画像を covers/<slug>.png にコピーする。
covers/<slug>.png が先にあるので、ビルドはコードでカバーを作らず、この画像をそのまま使う。
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(os.path.expanduser('~'), '.teneramente', 'cover-tools', 'fonts')

SITES = {
    'teneramente': {
        'size': (1200, 630),
        'queue': os.path.join('data', 'seo-keywords.json'),
        'out': os.path.join('assets', 'img', 'cover-queue'),
    },
    'mieroom': {
        'size': (1200, 675),
        'queue': os.path.join('data', 'seo-keywords-mieroom.json'),
        'out': os.path.join('mieroom', 'assets', 'cover-queue'),
    },
}


def fit(im, width, height):
    """縦横比を合わせて中央で切り抜き、目標の寸法に縮小する"""
    w, h = im.size
    target = width / height
    if w / h > target:
        nw = round(h * target)
        x = (w - nw) // 2
        im = im.crop((x, 0, x + nw, h))
    else:
        nh = round(w / target)
        y = (h - nh) // 2
        im = im.crop((0, y, w, y + nh))
    return im.resize((width, height), Image.LANCZOS)


def smooth_plate(im, box, radius=18):
    """ロゴの置き場を、周りの地の色でやわらかく塗る（ChatGPT が何か描いていても隠れる）"""
    x0, y0, x1, y1 = box
    x1 = min(x1, im.width - 1)
    y1 = min(y1, im.height - 1)
    px = im.load()
    samples = []
    for x in range(x0, x1, 4):
        samples.append(px[x, y0])
        samples.append(px[x, y1])
    for y in range(y0, y1, 4):
        samples.append(px[x0, y])
        samples.append(px[x1, y])
    color = tuple(sorted(c[i] for c in samples)[len(samples) // 2] for i in range(3))
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((x0, y0, x1, y1), radius=radius, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(6))
    im.paste(Image.new('RGB', im.size, color), (0, 0), mask)


def logo_teneramente(im, x=64, y=44):
    brand = os.path.join(ROOT, 'assets', 'img', 'brand')
    mark = Image.open(os.path.join(brand, 'mark-dark.png')).convert('RGBA')
    word = Image.open(os.path.join(brand, 'word-dark.png')).convert('RGBA')
    mh, wh = 40, 17
    mark = mark.resize((round(mark.width * mh / mark.height), mh), Image.LANCZOS)
    word = word.resize((round(word.width * wh / word.height), wh), Image.LANCZOS)
    wx = x + mark.width + 14
    smooth_plate(im, (x - 18, y - 14, wx + word.width + 18, y + mh + 14))
    im.paste(mark, (x, y), mark)
    im.paste(word, (wx, y + (mh - wh) // 2), word)


def logo_mieroom(im, x=60, y=40):
    mark = Image.open(os.path.join(ROOT, 'mieroom', 'assets', 'logo-mark-sm.webp')).convert('RGBA')
    mh = 46
    mark = mark.resize((mh, mh), Image.LANCZOS)
    font = ImageFont.truetype(os.path.join(FONT_DIR, 'ZenKakuGothicNew-Black.ttf'), 28)
    draw = ImageDraw.Draw(im)
    tx = x + mh + 10
    w1 = draw.textlength('ミエ', font=font)
    w2 = draw.textlength('ルーム', font=font)
    smooth_plate(im, (x - 16, y - 12, int(tx + w1 + w2) + 18, y + mh + 12))
    im.paste(mark, (x, y), mark)
    draw = ImageDraw.Draw(im)
    ty = y + (mh - 30) // 2 - 2
    draw.text((tx, ty), 'ミエ', font=font, fill=(20, 160, 133))
    draw.text((tx + w1, ty), 'ルーム', font=font, fill=(224, 122, 95))


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    with_logo = '--logo' in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) < 4:
        print(__doc__)
        sys.exit(1)
    site, qid, src, title = args[0], args[1], args[2], args[3].strip()
    if site not in SITES:
        sys.exit('site は teneramente か mieroom を指定してください')
    cfg = SITES[site]
    qpath = os.path.join(ROOT, cfg['queue'])
    with open(qpath, encoding='utf-8') as f:
        q = json.load(f)
    item = next((i for i in q['items'] if i['id'] == qid), None)
    if not item:
        sys.exit(f'キューに {qid} がありません')
    if item.get('status') != 'todo':
        sys.exit(f'{qid} はすでに {item.get("status")} です（書き終えた記事には使えません）')

    im = Image.open(src).convert('RGB')
    im = fit(im, *cfg['size'])
    # --wipe=x0,y0,x1,y1（切り抜き後の座標）: ChatGPT が描いた偽のロゴやキャッチコピーを地の色で消す。
    # --logo と一緒に使うと、本物のロゴを消した場所に置く
    wipe = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--wipe=')), None)
    box = tuple(int(v) for v in wipe.split(',')) if wipe else None
    if box:
        smooth_plate(im, box)
    if with_logo:
        draw_logo = logo_teneramente if site == 'teneramente' else logo_mieroom
        if box:
            draw_logo(im, box[0] + 18, box[1] + max(0, (box[3] - box[1] - 44) // 2))
        else:
            draw_logo(im)

    out_dir = os.path.join(ROOT, cfg['out'])
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f'{qid}.png')
    # 256色に減色して軽くする（イラストなので見た目はほとんど変わらない）
    im.quantize(colors=256, method=Image.Quantize.FASTOCTREE,
                dither=Image.Dither.FLOYDSTEINBERG).save(out, optimize=True)

    rel = os.path.relpath(out, ROOT).replace(os.sep, '/')
    item['coverTitle'] = title
    item['coverImage'] = rel
    with open(qpath, 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(q, ensure_ascii=False, indent=2) + '\n')
    print(f'✓ {rel} を作りました（{cfg["size"][0]}x{cfg["size"][1]}、{os.path.getsize(out) // 1024}KB）')
    print(f'✓ {qid} に coverTitle「{title}」を記録しました')


if __name__ == '__main__':
    main()
