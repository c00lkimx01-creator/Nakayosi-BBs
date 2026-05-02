# 🏮 Nakayosi Chat (なかよしチャット)

リアルタイムチャットアプリです。部屋を作成して、みんなとリアルタイムでチャットを楽しめます。

---

## 📦 プロジェクト構成

```
nakayosi-chat/
├── server/          # Node.js + Express + Socket.io バックエンド
│   ├── index.js
│   └── package.json
├── client/          # React フロントエンド
│   ├── src/
│   │   ├── App.js
│   │   ├── App.css
│   │   └── index.js
│   ├── public/
│   │   └── index.html
│   └── package.json
├── render.yaml
├── vercel.json
└── package.json
```

---

## ✨ 機能一覧

| 機能 | 説明 |
|------|------|
| ログイン / 新規登録 | 名前・パスワードでアカウント管理。同名は使用不可 |
| 管理者ログイン | ログイン時に管理者パスワードを入力することで管理者になれる |
| チャットルーム | 部屋を作成して、複数の部屋でチャット可能 |
| リアルタイムチャット | Socket.io によるリアルタイム通信 |
| 読み上げ機能 | Web Speech API でメッセージを読み上げ |
| ダーク / ライトモード | 設定から切り替え可能 |
| /おみくじ | 大吉〜大凶のおみくじを引ける |
| 管理者コマンド | /kick, /ban, /unban, /unkick など |

---

ログイン画面の「管理者パスワード」欄に入力してください。

---

## 💻 コマンド一覧

### 全ユーザー
```
/おみくじ    おみくじを引く
/help       コマンド一覧を表示
```

### 管理者のみ
```
/kick [ユーザー名] [日数]    指定日数KICKする（例: /kick taro 3）
/ban [ユーザー名]            BANする（ログイン不可）
/unban [ユーザー名]          BANを解除する
/unkick [ユーザー名]         KICKを解除する
/users                       オンラインユーザー一覧
```

---

## 🚀 ローカル起動方法

### ⚠️ 重要：先にクライアントをビルドする

サーバーを起動する前に、必ずクライアントのビルドを行ってください。

```bash
# ステップ1: クライアントをビルド
cd client
npm install
npm run build
cd ..

# ステップ2: サーバーを起動
cd server
npm install
npm start
```

ブラウザで http://localhost:3001 を開く。

### 開発モード（ビルド不要）

サーバーとクライアントを別々に起動します。

```bash
# ターミナル1: サーバー起動
cd server
npm install
npm start

# ターミナル2: クライアント開発サーバー起動
cd client
npm install
npm start
```

クライアントは http://localhost:3000、サーバーは http://localhost:3001 で動作します。

---

## ☁️ デプロイ方法

### Render（推奨・一番簡単）

1. [render.com](https://render.com) にサインアップ
2. 「New Web Service」→ GitHubリポジトリを選択
3. 以下を設定:
   - **Build Command**: `cd client && npm install && npm run build && cd ../server && npm install`
   - **Start Command**: `node server/index.js`
4. 「Create Web Service」をクリック

### CodeSandbox

1. [codesandbox.io](https://codesandbox.io) で「Import from GitHub」
2. リポジトリURLを入力してインポート
3. ターミナルで以下を実行:
   ```bash
   cd client && npm install && npm run build && cd ../server && npm install && npm start
   ```

### Vercel（フロントエンド） + Render（バックエンド）

1. Renderでバックエンドをデプロイ（上記参照）
2. `client/.env` を作成:
   ```
   REACT_APP_SERVER_URL=https://your-render-url.onrender.com
   ```
3. Vercelで `client` フォルダのみデプロイ

---

## 🛠 技術スタック

- **バックエンド**: Node.js, Express, Socket.io, bcryptjs
- **フロントエンド**: React 18, Socket.io-client, Web Speech API
- **スタイル**: Pure CSS（カスタムプロパティによるダーク/ライトモード）

---

## ⚠️ 注意事項

- データはメモリ上に保存されます。サーバー再起動でリセットされます
- 本番運用する場合はMongoDBやPostgreSQLなどのDBへの移行を推奨します

---

## 📄 ライセンス

MIT
