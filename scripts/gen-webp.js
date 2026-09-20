/**
 * カバー画像(PNG)から表示用の WebP を作る。
 *
 *   <slug>.png        … OGP 用。ここでは触らない（SNS が WebP を読めないことがあるため）
 *   <slug>.webp       … 記事ヒーロー・Featured 用（元と同じ幅）
 *   <slug>-card.webp  … 一覧カード用（幅 640px）
 *
 * 変換は Python(Pillow) → sharp の順で試し、どちらも無い環境では何もしない。
 * その場合でもビルドは PNG のまま続行できる（表示は重くなるが壊れない）。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CARD_WIDTH = 640;
const HERO_QUALITY = 80;
const CARD_QUALITY = 76;

function findPython() {
  for (const cmd of ['python3', 'python']) {
    try {
      execFileSync(cmd, ['-c', 'import PIL.features as f; assert f.check("webp")'], { stdio: 'ignore' });
      return cmd;
    } catch (e) { /* 次の候補へ */ }
  }
  return null;
}

function hasSharp() {
  try { require.resolve('sharp'); return true; } catch (e) { return false; }
}

/** 変換が必要か（WebP が無い、または PNG の方が新しい） */
function needsBuild(png, webp) {
  if (!fs.existsSync(webp)) return true;
  return fs.statSync(png).mtimeMs > fs.statSync(webp).mtimeMs;
}

const PY_SCRIPT = `
import sys, json
from PIL import Image
for job in json.loads(sys.argv[1]):
    im = Image.open(job["png"]).convert("RGB")
    w = job.get("width") or 0
    if w and im.width > w:
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(job["out"], "WEBP", quality=job["quality"], method=6)
`;

const NODE_SHARP_SCRIPT = `
const sharp = require('sharp');
const jobs = JSON.parse(process.argv[1]);
(async () => {
  for (const j of jobs) {
    let img = sharp(j.png);
    if (j.width) img = img.resize({ width: j.width, withoutEnlargement: true });
    await img.webp({ quality: j.quality }).toFile(j.out);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
`;

/**
 * @param {string} dir カバー画像のフォルダ（絶対パス）
 * @returns {Set<string>} WebP が揃っている slug の集合
 */
function generate(dir) {
  const ready = new Set();
  if (!fs.existsSync(dir)) return ready;

  const jobs = [];
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.png'))) {
    const slug = file.replace(/\.png$/, '');
    const png = path.join(dir, file);
    const hero = path.join(dir, `${slug}.webp`);
    const card = path.join(dir, `${slug}-card.webp`);
    if (needsBuild(png, hero)) jobs.push({ png, out: hero, width: 0, quality: HERO_QUALITY });
    if (needsBuild(png, card)) jobs.push({ png, out: card, width: CARD_WIDTH, quality: CARD_QUALITY });
    ready.add(slug);
  }

  if (jobs.length) {
    const python = findPython();
    try {
      if (python) {
        execFileSync(python, ['-c', PY_SCRIPT, JSON.stringify(jobs)], { stdio: 'inherit' });
      } else if (hasSharp()) {
        execFileSync(process.execPath, ['-e', NODE_SHARP_SCRIPT, JSON.stringify(jobs)], { stdio: 'inherit' });
      } else {
        console.warn('△ WebP 変換をスキップ（Python(Pillow) も sharp も無い環境）。既にある WebP はそのまま使います。');
      }
      console.log(`✓ WebP を ${jobs.length} 枚作成（${path.basename(dir)}）`);
    } catch (e) {
      console.warn('△ WebP 変換に失敗:', e.message);
    }
  }

  // 実際に両方そろっている slug だけを返す
  const ok = new Set();
  for (const slug of ready) {
    if (fs.existsSync(path.join(dir, `${slug}.webp`)) && fs.existsSync(path.join(dir, `${slug}-card.webp`))) ok.add(slug);
  }
  return ok;
}

module.exports = { generate, CARD_WIDTH };
