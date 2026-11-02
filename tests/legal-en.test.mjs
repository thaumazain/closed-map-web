// 英語版の利用規約・プライバシーポリシー（en/terms.html・en/privacy.html）を確かめる。
// 実行: node --test tests/*.test.mjs
//
// 英語版は「日本以外に住む人」に適用する正式版。オーストラリアとアメリカの人向けの条を持つ。
// 日本語版（terms.html・privacy.html）は日本に住む人向けの正式版で、英語版の条は入れていない。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const terms = page('en/terms.html');
const privacy = page('en/privacy.html');
const jaTerms = page('terms.html');
const jaPrivacy = page('privacy.html');
// タグを外して1行にした本文（文言の確認用）
const text = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');

test('英語版は lang="en" で、条の番号が 1 から飛ばずに並ぶ（条を足して番号を直し忘れたら落ちる）', () => {
  for (const [html, count] of [[terms, 16], [privacy, 15]]) {
    assert.match(html, /<html lang="en">/);
    const numbers = [...html.matchAll(/<h2>(\d+)\. /g)].map((m) => Number(m[1]));
    assert.deepEqual(numbers, Array.from({ length: count }, (_, i) => i + 1));
  }
});

test('どちらの版が誰に適用されるかを書く（日本以外は英語版・日本は日本語版。消したら落ちる）', () => {
  for (const html of [terms, privacy]) {
    assert.match(text(html), /binding version for users who live outside Japan/);
    assert.match(text(html), /binding version for users who live in Japan/);
  }
  assert.match(text(terms), /If you live outside Japan, these English Terms apply to you/);
});

test('オーストラリアの人は 16 歳以上・それ以外は 13 歳以上（Social Media Minimum Age。年齢を戻したら落ちる）', () => {
  assert.match(text(terms), /must be at least 13 years old/);
  assert.match(text(terms), /If you live in Australia, you must be at least 16 years old/);
  assert.match(text(terms), /14\.1 If you live in Australia.*must be at least 16 years old to have an account/);
  assert.match(text(privacy), /If you live in Australia, you must be at least 16 to have an account/);
  assert.match(text(privacy), /We do not knowingly collect personal information from children under 13/);
});

test('オーストラリア消費者法の保証は除外できないと書く（免責の条だけにしたら落ちる）', () => {
  assert.match(text(terms), /Our services come with guarantees that cannot be excluded under the Australian Consumer Law/);
  assert.match(text(terms), /Nothing in this Section excludes or limits any right or remedy that you have under the law where you live/);
});

test('準拠法は日本法・東京地裁のまま、住んでいる国の消費者保護は奪わない（オーナー決定。どちらかを消したら落ちる）', () => {
  assert.match(text(terms), /governed by the laws of Japan, and the Tokyo District Court/);
  assert.match(text(terms), /does not deprive you of the protection of the mandatory consumer laws of the country, state or territory where you live/);
  // 仲裁条項は入れない（オーナー決定）
  assert.match(text(terms), /These Terms do not require arbitration/);
  assert.doesNotMatch(text(terms), /binding arbitration|class action waiver/i);
});

test('有料サービス: 自動更新・24時間前の解約・アカウント削除では解約されない（課金の記載を消したら落ちる）', () => {
  assert.match(text(terms), /renews automatically for the same period and price unless you cancel at least 24 hours before the end of the current period/);
  assert.match(text(terms), /Deleting your account does not cancel your subscription/);
  assert.match(text(privacy), /Deleting your account does not cancel your App Store subscription/);
});

test('App Store の EULA に要る条（Apple は当事者でない・保守義務なし・第三者受益者）がある', () => {
  assert.match(text(terms), /These Terms are between you and us, not Apple Inc\./);
  assert.match(text(terms), /Apple has no obligation to provide maintenance or support/);
  assert.match(text(terms), /Apple and its subsidiaries are third-party beneficiaries/);
});

test('プライバシー: 日本とアメリカへの移転・OAIC への苦情・売らない・州の権利と不服申立てを書く', () => {
  assert.match(text(privacy), /we disclose personal information to recipients in Japan and the United States/);
  assert.match(privacy, /href="https:\/\/www\.oaic\.gov\.au"/);
  assert.match(text(privacy), /we do not sell your personal information or share it for cross-context behavioral \(targeted\) advertising/);
  assert.match(text(privacy), /Appeals/);
  assert.match(text(privacy), /Do Not Track and Global Privacy Control/);
});

test('プライバシー: 今のアプリに合わせる（認証コード・Apple でサインイン・地図を開いたときの現在地は保存しない）', () => {
  assert.match(text(privacy), /New accounts sign in with a one-time code sent by email/);
  assert.match(text(privacy), /Sign in with Apple identifier/);
  assert.match(text(privacy), /This location is used only for that request; it is not saved or written to our logs/);
});

test('写真のファイルまで消すとは書かない（S3 の実ファイルは今は消していない。「all of your data is permanently deleted」に戻したら落ちる）', () => {
  for (const html of [terms, privacy]) {
    assert.doesNotMatch(text(html), /all of your data(, including purchase information,)? is permanently deleted/);
  }
  assert.match(text(privacy), /If you also want the photo files themselves erased from our storage, email us/);
});

test('ログを見せる相手は承認したフォロワーで、「mutual」と書かない（日本語版の「相互フォロー」禁止と同じ）', () => {
  for (const html of [terms, privacy]) {
    assert.doesNotMatch(html, /mutual/i);
    assert.match(text(html), /people whose follow request you have approved \(your followers\)/);
  }
});

test('日本語版と英語版が互いにリンクする（リンクを消したら落ちる）', () => {
  // <head> の <link rel="alternate"> でなく、画面に出る <a> を見る
  const nav = (html) => html.match(/<nav>.*<\/nav>/)[0];
  assert.match(nav(jaTerms), /<a href="en\/terms\.html"[^>]*>English<\/a>/);
  assert.match(nav(jaPrivacy), /<a href="en\/privacy\.html"[^>]*>English<\/a>/);
  assert.match(nav(terms), /<a href="\.\.\/terms\.html"[^>]*>日本語<\/a>/);
  assert.match(nav(privacy), /<a href="\.\.\/privacy\.html"[^>]*>日本語<\/a>/);
  assert.match(nav(terms), /<a href="privacy\.html">Privacy Policy<\/a>/);
  assert.match(nav(privacy), /<a href="terms\.html">Terms of Service<\/a>/);
});

test('最終更新日は 2026年11月2日（英語版を作った日）', () => {
  for (const html of [terms, privacy]) {
    assert.match(html, /Last updated: November 2, 2026/);
  }
});
