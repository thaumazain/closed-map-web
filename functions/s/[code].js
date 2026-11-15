// 店のシェアの短縮リンク https://pinlogapp.com/s/<code> の中継（thaumazain/closed_map#1622・ADR-067）。
//
// API（GET https://api.pinlogapp.com/s/<code>）が開かれた回数を数えて、案内ページ（/places/<id>?q=<店名 住所>）への
// 302 を返す。ここはその飛び先をそのまま返すだけ。DB にも鍵にも触らない。
//
// ⚠️ 飛び先は https://pinlogapp.com/places/ で始まるときだけ通す。それ以外（API の不具合・無いコード・API が落ちている）はトップへ。
// ⚠️ User-Agent は渡す。API はそれでリンクの下見のロボット（LINE の line-poker など）を回数から外す。
// ⚠️ 開いた人の IP は、合言葉（環境変数 PINLOG_RELAY_SECRET）が設定されているときだけ、合言葉と一緒に渡す。
//    API に届く接続元の IP はここ（Cloudflare）のものに揃うので、そのままだと 1 人ごとに連打を止められない。
//    API は合言葉が合ったときだけその IP で数え、保存もログへの書き出しもしない（→ ADR-067）。
//    合言葉は SSM /pinlog/<env>/share_relay_secret と同じ値。Cloudflare Pages の Settings → Variables and Secrets に Secret で置く

const API = 'https://api.pinlogapp.com';
const CODE = /^[A-Za-z0-9]{10}$/;
const PLACE_PAGE = 'https://pinlogapp.com/places/';

function toTop(request) {
  return new Response(null, { status: 302, headers: { Location: new URL('/', request.url).toString(), 'Cache-Control': 'no-store' } });
}

export async function onRequestGet({ params, request, env }) {
  const code = String(params.code ?? '');
  if (!CODE.test(code)) return toTop(request);
  const headers = { 'User-Agent': request.headers.get('user-agent') ?? '' };
  const secret = env?.PINLOG_RELAY_SECRET;
  const visitor = request.headers.get('cf-connecting-ip');
  if (secret && visitor) {
    headers['X-Pinlog-Relay'] = secret;
    headers['X-Pinlog-Visitor'] = visitor;
  }
  let res;
  try {
    res = await fetch(`${API}/s/${code}`, { redirect: 'manual', headers });
  } catch {
    return toTop(request);
  }
  const location = res.headers.get('location') ?? '';
  if (res.status !== 302 || !location.startsWith(PLACE_PAGE)) return toTop(request);
  return new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store' } });
}
