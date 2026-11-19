// 店のシェアの短縮リンク /s/<code> の中継（functions/s/[code].js）を確かめる。
// thaumazain/closed_map#1622。実行: node --test tests/*.test.mjs
//
// パッケージは入れない。関数のファイルを読み、export を外して vm で走らせる。fetch は偽物に差し替える。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../functions/s/[code].js', import.meta.url), 'utf8');
const PLACE = 'https://pinlogapp.com/places/30a12036-13ab-41fb-8231-d54b4cc9353e?q=%E5%96%AB%E8%8C%B6';

function load(fakeFetch) {
  const ctx = { fetch: fakeFetch, Response, URL, String };
  vm.runInNewContext(src.replace(/^export /gm, '') + '\nthis.onRequestGet = onRequestGet;', ctx);
  return ctx.onRequestGet;
}

const request = (ua = 'Mozilla/5.0 (iPhone) Safari') =>
  new Request('https://pinlogapp.com/s/Ab3dE5fG7h', { headers: { 'user-agent': ua } });

test('API の 302 の飛び先（案内ページ）へそのまま飛ばす。UA を渡し、リダイレクトは自分で追わない', async () => {
  const calls = [];
  const onRequestGet = load(async (url, init) => {
    calls.push({ url, init });
    return new Response(null, { status: 302, headers: { location: PLACE } });
  });
  const res = await onRequestGet({ params: { code: 'Ab3dE5fG7h' }, request: request('Line/14.19.0') });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), PLACE);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(calls[0].url, 'https://api.pinlogapp.com/s/Ab3dE5fG7h');
  assert.equal(calls[0].init.redirect, 'manual');
  assert.equal(calls[0].init.headers['User-Agent'], 'Line/14.19.0');
});

test('案内ページ以外への飛び先は通さず、トップへ（API の不具合で別のサイトへ飛ばしたら落ちる）', async () => {
  const onRequestGet = load(async () => new Response(null, { status: 302, headers: { location: 'https://evil.example/' } }));
  const res = await onRequestGet({ params: { code: 'Ab3dE5fG7h' }, request: request() });
  assert.equal(res.headers.get('location'), 'https://pinlogapp.com/');
});

test('無いコード（API の 404）・API が落ちている・形の違うコードはトップへ', async () => {
  const notFound = load(async () => new Response('{}', { status: 404 }));
  assert.equal((await notFound({ params: { code: 'Ab3dE5fG7h' }, request: request() })).headers.get('location'), 'https://pinlogapp.com/');
  const down = load(async () => { throw new Error('down'); });
  assert.equal((await down({ params: { code: 'Ab3dE5fG7h' }, request: request() })).headers.get('location'), 'https://pinlogapp.com/');
  let called = false;
  const bad = load(async () => { called = true; return new Response(null, { status: 302, headers: { location: PLACE } }); });
  assert.equal((await bad({ params: { code: '..%2Fusers' }, request: request() })).headers.get('location'), 'https://pinlogapp.com/');
  assert.equal(called, false, '形の違うコードで API を叩かない');
});

test('IP を API に渡さない（ADR-067。数えるのは回数と日時だけ）', () => {
  assert.doesNotMatch(src, /cf-connecting-ip|x-forwarded-for|x-real-ip/i);
});
