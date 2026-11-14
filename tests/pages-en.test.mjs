// トップとサポートの英語版（en/index.html・en/support.html）と、日本語版との切り替えを確かめる。
// 実行: node --test tests/*.test.mjs
//
// 英語版は日本以外の人向け（thaumazain/closed_map#1181）。規約・ポリシーも英語版（en/）へつなぐ。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = (name) => readFileSync(join(root, name), 'utf8');

// [日本語版, 英語版, 日本語版から見た英語版の href, 英語版から見た日本語版の href]
const PAIRS = [
  ['index.html', 'en/index.html', 'en/', '../'],
  ['support.html', 'en/support.html', 'en/support.html', '../support.html'],
];

const links = (html) => [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>/g)].map((m) => ({ tag: m[0], href: m[1] }));

test('日本語版と英語版が互いに切り替えのリンクを持つ（片方を消したら落ちる）', () => {
  for (const [ja, en, toEn, toJa] of PAIRS) {
    assert.match(page(ja), /<html lang="ja">/, ja);
    assert.match(page(en), /<html lang="en">/, en);
    const jaToEn = links(page(ja)).filter((l) => l.href === toEn);
    const enToJa = links(page(en)).filter((l) => l.href === toJa);
    assert.ok(jaToEn.some((l) => /hreflang="en"/.test(l.tag)), `${ja} → ${en} のリンクが無い`);
    assert.ok(enToJa.some((l) => /hreflang="ja"/.test(l.tag)), `${en} → ${ja} のリンクが無い`);
  }
});

test('どちらの版も hreflang で日本語版と英語版の URL を宣言する（検索に別の言語の版を知らせる）', () => {
  for (const [ja, en] of PAIRS) {
    for (const name of [ja, en]) {
      assert.match(page(name), /<link rel="alternate" hreflang="ja" href="https:\/\/pinlogapp\.com\//, name);
      assert.match(page(name), /<link rel="alternate" hreflang="en" href="https:\/\/pinlogapp\.com\/en\//, name);
    }
  }
});

test('英語版の規約・ポリシー・サポートは英語版へつなぐ（日本語版を指すのは日本語の印付きだけ。../privacy.html に戻したら落ちる）', () => {
  for (const [, en] of PAIRS) {
    const html = page(en);
    assert.ok(links(html).some((l) => l.href === 'privacy.html'), `${en} に英語版のプライバシーポリシーが無い`);
    assert.ok(links(html).some((l) => l.href === 'terms.html'), `${en} に英語版の利用規約が無い`);
    for (const l of links(html).filter((l) => l.href.startsWith('../'))) {
      assert.match(l.tag, /hreflang="ja"/, `${en} の ${l.href} は日本語のページなのに印が無い`);
    }
  }
  assert.ok(links(page('en/index.html')).some((l) => l.href === 'support.html'), '英語版のトップから英語版のサポートへ行けない');
});

test('英語版のページが指す画像・ページはどれもリポジトリにある（パスを間違えたら落ちる）', () => {
  for (const [, en] of PAIRS) {
    const html = page(en);
    const paths = [...html.matchAll(/\b(?:src|href)="([^"#:]+)"/g)].map((m) => m[1]);
    for (const p of paths) {
      const file = normalize(join(root, dirname(en), p));
      const target = p.endsWith('/') ? join(file, 'index.html') : file;
      assert.ok(existsSync(target), `${en} の ${p} が無い`);
    }
  }
});

test('英語版のトップのスクショは英語の5枚（日本語のスクショに戻したら落ちる）', () => {
  const shots = [...page('en/index.html').matchAll(/<img src="([^"]+)" width="600" height="1300"/g)].map((m) => m[1]);
  assert.equal(shots.length, 5);
  for (const src of shots) assert.match(src, /^\.\.\/img\/en\/screen-\d-[a-z]+\.webp$/);
});
