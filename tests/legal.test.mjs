// 法務のページ（利用規約・プライバシーポリシー・特定商取引法に基づく表記）を確かめる（thaumazain/closed_map#912）。
// 実行: node --test tests/
//
// 正本は thaumazain/closed_map の docs/legal/。ここでは、課金に要る記載が抜けていないことと、
// どのページからも特定商取引法の表記へ行けることを見る。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const tokushoho = page('tokushoho.html');
const terms = page('terms.html');
const privacy = page('privacy.html');

test('特定商取引法の表記に必要な項目が揃っている（項目を消したら落ちる）', () => {
  for (const item of ['販売業者', '運営統括責任者', '所在地', '電話番号', 'メールアドレス', '販売価格',
    '商品代金以外の必要料金', '支払方法', '支払時期', '提供時期', '自動更新と解約', '返品・キャンセル', '動作環境']) {
    assert.match(tokushoho, new RegExp(`<th>${item}</th>`), item);
  }
});

test('氏名・所在地・電話は「請求があれば遅滞なく開示」（オーナー決定。実値を書いたら・省略の書き方を変えたら落ちる）', () => {
  assert.equal(tokushoho.match(/<td>請求があった場合には、遅滞なく開示します<\/td>/g)?.length, 4);
  assert.match(tokushoho, /<td>support\.closedmap@gmail\.com<\/td>/);
  assert.match(tokushoho, /月額 300円（税込）/);
});

test('利用規約に有料サービスの条があり、自動更新・解約・アカウント削除では解約されないことを書く', () => {
  assert.match(terms, /<h2>9\. 有料サービス（プレミアム）<\/h2>/);
  assert.match(terms, /期間が終わる24時間前までに解約しない限り/);
  assert.match(terms, /アカウントを削除しても解約にはなりません/);
  // 9 を足して繰り下げた。番号が飛んだり重なったりしたら落ちる
  const numbers = [...terms.matchAll(/<h2>(\d+)\. /g)].map((m) => Number(m[1]));
  assert.deepEqual(numbers, Array.from({ length: 14 }, (_, i) => i + 1));
});

test('プライバシーポリシーに購入の情報と、購入のときに Apple へ渡すものを書く', () => {
  assert.match(privacy, /有料サービス（プレミアム）を購入した場合に収集する情報/);
  assert.match(privacy, /<strong>Apple Inc\.<\/strong>/);
  assert.match(privacy, /支払い情報は Apple が扱い、本アプリは受け取りません/);
});

test('規約・ポリシー・サポート・トップのどこからでも、特定商取引法の表記へ行ける（リンクを消したら落ちる）', () => {
  for (const name of ['terms.html', 'privacy.html', 'support.html', 'index.html']) {
    assert.match(page(name), /href="tokushoho\.html"/, name);
  }
});

test('最終更新日は 3 ページとも 2026年10月13日（課金の記載を入れた日）', () => {
  for (const html of [tokushoho, terms, privacy]) {
    assert.match(html, /最終更新日：2026年10月13日/);
  }
});
