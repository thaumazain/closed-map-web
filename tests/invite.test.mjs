// 招待ページ（invite/index.html）のボタンの並びと行き先を確かめる。
// 実行: node --test tests/
//
// パッケージは入れない（Node 標準の node:test と vm だけ）。
// ページのスクリプトをそのまま取り出し、偽の document で走らせる。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../invite/index.html', import.meta.url), 'utf8');
const APP_STORE = 'https://apps.apple.com/app/id6801804300';

// カード内のボタンを、上から順に { id, cls, href, label } で返す
function buttons() {
  const re = /<a class="(btn[^"]*)" id="(\w+)" href="([^"]*)">([\s\S]*?)<\/a>/g;
  return [...html.matchAll(re)].map(([, cls, id, href, label]) => ({
    id, cls, href, label: label.trim(),
  }));
}

// ページのスクリプトを、pathname と search を与えて走らせる
function run(pathname, search = '') {
  const els = {
    open: { href: '#', style: {} },
    store: { href: APP_STORE, style: {} },
  };
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(script, {
    location: { pathname, search },
    document: { getElementById: (id) => els[id] },
    URLSearchParams,
  });
  return els;
}

test('上が「友達のマップを見る」、下が「アプリを入れてない方はこちら」（並びを戻したら落ちる）', () => {
  const [top, bottom] = buttons();
  assert.equal(top.id, 'open');
  assert.equal(top.label, '友達のマップを見る');
  assert.equal(top.cls, 'btn', '上が目立つ方のボタン');
  assert.equal(bottom.id, 'store');
  assert.equal(bottom.label, 'アプリを入れてない方はこちら');
  assert.equal(bottom.href, APP_STORE);
});

test('「友達のマップを見る」はアプリの招待画面を開く（行き先が App Store や別の画面になったら落ちる）', () => {
  const { open } = run('/invite/abc-123');
  assert.equal(open.href, 'pinlog://users/abc-123?invite=true');
  assert.notEqual(open.style.display, 'none');
});

test('ID の無い /invite/ では「友達のマップを見る」を隠し、App Store だけ残す', () => {
  const { open, store } = run('/invite/');
  assert.equal(open.style.display, 'none');
  assert.equal(store.href, APP_STORE);
  assert.notEqual(store.style.display, 'none');
});
