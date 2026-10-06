# closed-map-web

PINLOG の公開ページ。アプリへ送るトップ（紹介ページ）・サポート・利用規約・プライバシーポリシーと、
招待リンクの受け皿、Universal Links のための AASA を置く。

⚠️ **アプリ本体（`thaumazain/closed_map`）とは別のリポジトリ。**
   規約とポリシーの正本はこちら。アプリ側に写しを置かないこと。

## なぜ必要か

招待リンクは `pinlog://users/<id>?invite=true` を共有していた。これは
**アプリを持っていない人には届かない**。LINE 等ではリンクとして認識すらされず
（`https://` でないため青字にならない）、押せても「接続できません」になる。

招待したい相手はまさにアプリを持っていない人なので、そこへ届かないと意味が無い。

## 中身

| ファイル | 役割 |
|---|---|
| `.well-known/apple-app-site-association` | Universal Links の宣言 |
| `invite/index.html` | 招待の受け皿。上「友達のマップを見る」でアプリの招待画面を開き、下「アプリを入れてない方はこちら」で App Store へ送る |
| `_headers` | **AASA を `application/json` で返す**（無いと動かない） |
| `_redirects` | **`/invite/<id>` を招待ページに割り当てる**（効いていないと**トップページが 200 で返る**） |
| `index.html` | トップ。アプリへ送る紹介ページ（キャッチコピー・App Store のバッジ・PC では QR・スクショ4枚 → thaumazain/closed_map#507）。Safari では Smart App Banner が出る |
| `support.html` | サポート（よくある質問・お問い合わせ）。**App Store Connect のサポート URL はここ** |
| `privacy.html` / `terms.html` | プライバシーポリシー・利用規約 |
| `img/` | トップの画像。`screen-*.webp` は App Store に出しているスクショ（600×1300）、`qr-app-store.svg` は `https://apps.apple.com/app/id6801804300` の QR、`icon-192.png` はアプリのアイコン |
| `index.html` / `privacy.html` / `terms.html` | 既存のサポートページ |
| `tests/` | 招待ページのボタンの並びと行き先のテスト。`node --test tests/*.test.mjs`（パッケージは要らない） |

> ⚠️ 招待ページを**1つのボタンで「アプリがあれば開く・無ければ App Store」にはできない。**
> Web ページからはアプリが入っているかを確かめられない（理由は `invite/index.html` 冒頭）。

---

# Cloudflare Pages への設置手順

`pinlogapp.com` の DNS はすでに Cloudflare にある（`api.` が EC2 を向いている）。
apex は空いているので、そこへ割り当てる。

## 1. プロジェクトを作る

1. Cloudflare にログイン → 左メニュー **Workers & Pages**
2. **Create** → **Pages** タブ → **Connect to Git**
3. GitHub を認証し、**`thaumazain/closed-map-web`** を選ぶ
4. ビルド設定を次のとおりにする

| 項目 | 値 |
|---|---|
| Production branch | `main` |
| Framework preset | **None** |
| Build command | **空のまま**（ビルドしない。静的ファイルをそのまま出す） |
| Build output directory | **空のまま**（リポジトリ直下がそのまま公開される） |
| Root directory | 空のまま |

5. **Save and Deploy**

初回のデプロイが終わると `xxxx.pages.dev` で開ける。ここで先に動作を確かめられる。

## 2. 独自ドメインを割り当てる

1. そのプロジェクトの **Custom domains** タブ → **Set up a domain**
2. `pinlogapp.com` を入力 → **Continue** → **Activate domain**

DNS は同じ Cloudflare アカウントにあるので、レコードは自動で作られる。
`api.pinlogapp.com` は別レコードなので**影響しない**。

> ⚠️ `www.pinlogapp.com` も使うなら別途追加する。AASA は
> `www` の有無それぞれで配信される必要がある。

## 3. 確認する

**AASA が正しく返るか**（ここが最重要）:

```bash
curl -sI https://pinlogapp.com/.well-known/apple-app-site-association | head -5
```

期待する応答:

```
HTTP/2 200
content-type: application/json     ← これが octet-stream だと Apple が読まない
```

中身も見る:

```bash
curl -s https://pinlogapp.com/.well-known/apple-app-site-association
# {"applinks":{"details":[{"appIDs":["632FCXMN2F.com.hirotaka.pinlog"], ...
```

**招待ページが出るか**（**ページのタイトルで**判定する）:

```bash
curl -s https://pinlogapp.com/invite/test123 | grep -o '<title>[^<]*'
# <title>PINLOG に招待されました     ← トップ（「PINLOG — 友だちの…」）が出たら _redirects が効いていない
```

> ⚠️ **ステータスコードでは判定できない。** `404.html` が無いので、Pages はどのパスにも
> 200 でトップページを返す。`_redirects` が効いていなくても 200 になり、
> 実際にこれで壊れたまま気づかなかった（→ thaumazain/closed_map#250）。

**Apple 側のキャッシュに載ったか**（反映に数時間かかる）:

```bash
curl -s "https://app-site-association.cdn-apple.com/a/v1/pinlogapp.com" | head -c 300
```

## 4. アプリ側

Universal Links を有効にするのは、アプリ側の **`mobile/ios/PINLOG/PINLOG.entitlements`** にある
`com.apple.developer.associated-domains`（`applinks:pinlogapp.com`）。

`app.json` の `associatedDomains` に書くだけでは**ビルドに入らない**。アプリは `ios/` を
コミットしているので prebuild が走らず、ビルドが読むのは entitlements のほう
（→ thaumazain/closed_map#250）。**ネイティブ設定なので OTA でも入らない。次のビルドから効く。**

実機での確認:

1. 新しいビルドを入れる
2. メモ帳などに `https://pinlogapp.com/invite/<自分のID>` を書いて長押し
3. **「PINLOG で開く」が出れば成功**

> ⚠️ Safari のアドレスバーに直接打つと Universal Links は**発動しない**（仕様）。
> 他のアプリからのリンクとして開くこと。

## つまずきやすいところ

| 症状 | 原因 |
|---|---|
| アプリが開かず Safari でページが出る | AASA の `Content-Type` が違う／Apple のキャッシュがまだ古い／アプリの entitlements に `applinks:pinlogapp.com` が無い（`app.json` だけでは入らない） |
| `/invite/<id>` でトップページ（紹介ページ）が出る | `_redirects` が効いていない。書き換え先を `/invite/index.html` と書くと効かないので `/invite/` にする。`_redirects` が無くても同じ見え方になる |
| 一度成功したのに効かなくなった | AASA を変えた。端末のキャッシュは**アプリの再インストール**で消える |
| `api.pinlogapp.com` が落ちた | apex と別レコード。落ちるはずは無いので、DNS を見直す |

## App Store に登録している URL

いまは GitHub Pages を登録している。

```
サポート          https://thaumazain.github.io/closed-map-web/   ← ⚠️ support.html に差し替える（#507。差し替えたらここも直す）
プライバシー      https://thaumazain.github.io/closed-map-web/privacy.html
利用規約          https://thaumazain.github.io/closed-map-web/terms.html
```

⚠️ **サポートはトップ（`/`）から `support.html` に移した**（#507）。App Store Connect のサポート URL が
トップのままだと、紹介ページが開く（お問い合わせはフッターの「サポート」から行けるが、審査で迷わせないよう差し替える）。

Cloudflare Pages に載せ替えたら、**App Store Connect の URL も差し替える**こと。

```
https://pinlogapp.com/support.html
https://pinlogapp.com/privacy.html
https://pinlogapp.com/terms.html
```

`invite/index.html` はその想定で `/privacy.html` `/terms.html` を相対参照している。

> GitHub Pages と併存させてもよいが、**Universal Links は Cloudflare 側でしか
> 動かない**（GitHub Pages のプロジェクトページではルートに AASA を置けないため）。
