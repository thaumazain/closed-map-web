# closed-map-web

PINLOG の公開ページ。サポート・利用規約・プライバシーポリシーと、
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
| `invite/index.html` | 招待の受け皿。App Store へ誘導する |
| `_headers` | **AASA を `application/json` で返す**（無いと動かない） |
| `_redirects` | **`/invite/<id>` を index.html に割り当てる**（無いと 404） |
| `index.html` / `privacy.html` / `terms.html` | 既存のサポートページ |

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

**招待ページが出るか**:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://pinlogapp.com/invite/test123
# 200（404 なら _redirects が効いていない）
```

**Apple 側のキャッシュに載ったか**（反映に数時間かかる）:

```bash
curl -s "https://app-site-association.cdn-apple.com/a/v1/pinlogapp.com" | head -c 300
```

## 4. アプリ側

`app.json` の `associatedDomains` は PR で入れてある。**ネイティブ設定なので
OTA では入らない。次のビルドから効く。**

実機での確認:

1. 新しいビルドを入れる
2. メモ帳などに `https://pinlogapp.com/invite/<自分のID>` を書いて長押し
3. **「PINLOG で開く」が出れば成功**

> ⚠️ Safari のアドレスバーに直接打つと Universal Links は**発動しない**（仕様）。
> 他のアプリからのリンクとして開くこと。

## つまずきやすいところ

| 症状 | 原因 |
|---|---|
| アプリが開かず Safari でページが出る | AASA の `Content-Type` が違う／Apple のキャッシュがまだ古い |
| `/invite/<id>` が 404 | `_redirects` が無い、または output directory が `web` になっていない |
| 一度成功したのに効かなくなった | AASA を変えた。端末のキャッシュは**アプリの再インストール**で消える |
| `api.pinlogapp.com` が落ちた | apex と別レコード。落ちるはずは無いので、DNS を見直す |

## App Store に登録している URL

いまは GitHub Pages を登録している。

```
サポート          https://thaumazain.github.io/closed-map-web/
プライバシー      https://thaumazain.github.io/closed-map-web/privacy.html
利用規約          https://thaumazain.github.io/closed-map-web/terms.html
```

Cloudflare Pages に載せ替えたら、**App Store Connect の URL も差し替える**こと。

```
https://pinlogapp.com/
https://pinlogapp.com/privacy.html
https://pinlogapp.com/terms.html
```

`invite/index.html` はその想定で `/privacy.html` `/terms.html` を相対参照している。

> GitHub Pages と併存させてもよいが、**Universal Links は Cloudflare 側でしか
> 動かない**（GitHub Pages のプロジェクトページではルートに AASA を置けないため）。
