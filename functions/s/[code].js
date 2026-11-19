// 店のシェアの短縮リンク https://pinlogapp.com/s/<code> の中継（thaumazain/closed_map#1622・ADR-067）。
//
// API（GET https://api.pinlogapp.com/s/<code>）が開かれた回数を数えて、案内ページ（/places/<id>?q=<店名 住所>）への
// 302 を返す。ここはその飛び先をそのまま返すだけ。DB にも鍵にも触らない。
//
// ⚠️ 飛び先は https://pinlogapp.com/places/ で始まるときだけ通す。それ以外（API の不具合・無いコード・API が落ちている）はトップへ。
// ⚠️ User-Agent は渡す。API はそれでリンクの下見のロボット（LINE の line-poker など）を回数から外す。
// ⚠️ IP は渡さない（API は IP を持たない → ADR-067）。

const API = 'https://api.pinlogapp.com';
const CODE = /^[A-Za-z0-9]{10}$/;
const PLACE_PAGE = 'https://pinlogapp.com/places/';

function toTop(request) {
  return new Response(null, { status: 302, headers: { Location: new URL('/', request.url).toString(), 'Cache-Control': 'no-store' } });
}

export async function onRequestGet({ params, request }) {
  const code = String(params.code ?? '');
  if (!CODE.test(code)) return toTop(request);
  let res;
  try {
    res = await fetch(`${API}/s/${code}`, {
      redirect: 'manual',
      headers: { 'User-Agent': request.headers.get('user-agent') ?? '' },
    });
  } catch {
    return toTop(request);
  }
  const location = res.headers.get('location') ?? '';
  if (res.status !== 302 || !location.startsWith(PLACE_PAGE)) return toTop(request);
  return new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store' } });
}
