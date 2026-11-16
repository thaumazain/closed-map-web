// シェアした店のリンクの受け皿（places/index.html）と、そのリンクでアプリを開く設定（AASA・_redirects）を確かめる。
// thaumazain/closed_map#1605。実行: node --test tests/*.test.mjs
//
// パッケージは入れない（Node 標準の node:test と vm だけ）。ページのスクリプトをそのまま取り出し、偽の document で走らせる。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('places/index.html');
const APP_STORE = 'https://apps.apple.com/app/id6801804300';
const ID = '30a12036-13ab-41fb-8231-d54b4cc9353e';

function buttons() {
  const re = /<a class="(btn[^"]*)" id="(\w+)" href="([^"]*)">([\s\S]*?)<\/a>/g;
  return [...html.matchAll(re)].map(([, cls, id, href, label]) => ({ id, cls, href, label: label.trim() }));
}

function run(pathname, search = '') {
  const els = { open: { href: '#', style: {} }, map: { href: '#', style: {} }, store: { href: APP_STORE, style: {} } };
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(script, {
    location: { pathname, search },
    document: { getElementById: (id) => els[id] },
    URLSearchParams,
  });
  return els;
}

test('上から「PINLOG で開く」「Google マップで開く」「アプリを入れてない方はこちら」（目立つのはアプリを開く方）', () => {
  const [open, map, store] = buttons();
  assert.deepEqual([open.id, map.id, store.id], ['open', 'map', 'store']);
  assert.equal(open.cls, 'btn');
  assert.equal(store.href, APP_STORE);
});

test('「PINLOG で開く」はアプリの店のページを開く', () => {
  const { open } = run(`/places/${ID}`, '?ll=35.66312,139.73220');
  assert.equal(open.href, `pinlog://places/${ID}`);
  assert.notEqual(open.style.display, 'none');
});

test('「Google マップで開く」は q の店名＋住所で検索する（アプリと同じ検索。座標に戻ったら落ちる）', () => {
  const q = encodeURIComponent('喫茶ことり 渋谷店 東京都渋谷区道玄坂2丁目10-7');
  assert.equal(run(`/places/${ID}`, `?q=${q}`).map.href, `https://www.google.com/maps/search/?api=1&query=${q}`);
});

test('q はページに書かない（書き換えたリンクで PINLOG の名前のまま好きな文を見せられたら落ちる）', () => {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(script, /innerHTML|textContent|innerText|document\.write|document\.title/);
});

test('「Google マップで開く」は ll の座標で開き、読めない ll では隠す（スクリプトを差し込まれたら落ちる）', () => {
  assert.equal(run(`/places/${ID}`, '?ll=35.66312,139.73220').map.href, 'https://www.google.com/maps/search/?api=1&query=35.66312,139.73220');
  assert.equal(run(`/places/${ID}`).map.style.display, 'none');
  assert.equal(run(`/places/${ID}`, '?ll=javascript:alert(1)').map.style.display, 'none');
});

test('店名・写真を出さず、API も呼ばない（リンクを知っているだけの人に PINLOG のデータを出したら落ちる）', () => {
  assert.doesNotMatch(html, /fetch\(|XMLHttpRequest|api\.pinlogapp\.com/);
});

test('AASA は /places/* を exclude し、_redirects が案内ページを返す（アプリへ直接飛んで選べなくなったら・トップが出たら落ちる）', () => {
  const aasa = JSON.parse(read('.well-known/apple-app-site-association'));
  const comps = aasa.applinks.details[0].components;
  const places = comps.filter((c) => c['/'] === '/places/*');
  assert.equal(places.length, 1);
  assert.equal(places[0].exclude, true);
  assert.ok(comps.some((c) => c['/'] === '/invite/*' && !c.exclude), '招待リンクはアプリで開くまま');
  assert.match(read('_redirects'), /^\/places\/\*\s+\/places\/\s+200$/m);
});
