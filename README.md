# 📅 Today's NFT - 日々のNFTオークションシステム

**Ethereum Sepolia テストネット対応**

毎日、その日を自分のものにする。日付ベースのNFTオークションプラットフォームです。

## 🌟 機能概要

### 🏆 コアオークションシステム
- **日次オークション**: 各日付に対する自動的な日次オークション
- **リアルタイム入札**: WebSocketベースのライブ入札システム
- **ウォレット統合**: MetaMask、WalletConnect対応
- **署名認証**: 全ての入札に対する暗号学的証明
- **勝者決定**: 自動的な勝者決定とNFT準備

### 📅 カレンダー機能
- **インタラクティブカレンダー**: 月別の視覚的カレンダービュー
- **履歴データ**: 過去のオークションと勝者の確認
- **日付ナビゲーション**: 異なる月・年の簡単な閲覧
- **勝者インジケータ**: オークション勝者の明確な視覚表示

### 🖼️ NFT管理
- **自動メタデータ生成**: 日付、勝者、入札詳細を含む豊富なメタデータ
- **IPFS統合**: Pinataによる分散型メタデータストレージ
- **自動ミント**: 勝者決定後の自動NFTミント
- **コレクション表示**: ユーザーの保有NFT一覧

### 🔧 高度な機能
- **スマートコントラクト**: Solidity + OpenZeppelinによる安全な実装
- **データベース統合**: SQLite + Prisma ORMによる効率的なデータ管理
- **Cronジョブ**: 日次処理の自動実行
- **リアルタイム更新**: Socket.IOによるライブ通信
- **管理機能**: 緊急ミント、設定変更、統計表示

## 🏗️ システムアーキテクチャ

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   フロントエンド   │◄──►│   バックエンド   │◄──►│  スマートコントラクト │
│   (SvelteKit)   │    │   (Node.js)     │    │   (Solidity)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    ┌─────────┐            ┌─────────┐            ┌─────────┐
    │ Socket.IO│            │ Prisma  │            │ Ethereum│
    │WebSocket │            │Database │            │ Sepolia │
    └─────────┘            └─────────┘            └─────────┘
         │                       │                       │
    ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
    │リアルタイム │         │ SQLite DB   │         │ IPFS/Pinata │
    │   通信      │         │   永続化    │         │ メタデータ  │
    └─────────────┘         └─────────────┘         └─────────────┘
```

## 📂 プロジェクト構造

```
today_nft/
├── 📁 today_nft_contract/          # スマートコントラクト
│   ├── contracts/TodaysNFT.sol     # メインコントラクト
│   ├── scripts/deploy.ts           # デプロイスクリプト
│   ├── hardhat.config.ts           # Hardhat設定
│   └── test/                       # テストファイル
├── 📁 today_nft_auction/           # バックエンドAPI
│   ├── server.js                   # Express サーバー
│   ├── cron.js                     # Cronジョブ
│   ├── prisma/schema.prisma        # データベーススキーマ
│   └── package.json
├── 📁 today_nft_ui/                # フロントエンド
│   ├── src/routes/+page.svelte     # メインUI
│   ├── src/lib/                    # ライブラリ
│   └── package.json
├── 🚀 deploy.sh                    # ワンクリックデプロイ
├── 🔍 check-config.sh              # 設定確認
└── 📖 README.md                    # このファイル
```

## ⚡ クイックスタート

### 1. ワンクリックデプロイ（推奨）

```bash
# 1. 環境変数設定
export PRIVATE_KEY="あなたのプライベートキー"
export PINATA_API_KEY="あなたのPinata APIキー"
export PINATA_API_SECRET_KEY="あなたのPinata APIシークレット"
export SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/YOUR_PROJECT_ID"

# 2. 設定確認
./check-config.sh

# 3. デプロイ実行
sudo ./deploy.sh
```

### 2. 手動インストール

#### 前提条件
- Node.js v16以上
- npm
- Git
- 各種APIキー（下記参照）

#### ステップ1: スマートコントラクト

```bash
cd today_nft_contract
npm install

# .env ファイル作成
cat > .env << EOF
PRIVATE_KEY=あなたのプライベートキー
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
ETHERSCAN_API_KEY=あなたのEtherscan APIキー
TREASURY_WALLET=トレジャリーウォレットアドレス
EOF

# コンパイル・デプロイ
npx hardhat compile
npx hardhat run scripts/deploy.ts --network sepolia
```

#### ステップ2: バックエンド

```bash
cd today_nft_auction
npm install

# .env ファイル作成（コントラクトアドレスを更新）
cat > .env << EOF
DATABASE_URL="file:./dev.db"
CONTRACT_ADDRESS=デプロイされたコントラクトアドレス
PRIVATE_KEY=あなたのプライベートキー
NETWORK=sepolia
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
PINATA_API_KEY=あなたのPinata APIキー
PINATA_API_SECRET_KEY=あなたのPinata APIシークレット
PORT=3000
EOF

# データベースセットアップ
npx prisma generate
npx prisma db push

# サーバー起動
node server.js
```

#### ステップ3: フロントエンド

```bash
cd today_nft_ui
npm install
npm run build
npm run preview
```

## 🔧 動作原理

### 日次オークションフロー

1. **🌅 毎日午前0時**: 前日のオークションが終了
2. **🏆 勝者決定**: 最高入札者が自動選出
3. **📝 メタデータ生成**: NFTメタデータをIPFSにアップロード
4. **⚙️ コントラクト準備**: ペンディング勝者として設定
5. **💰 自動ミント**: ETH支払いでNFTを勝者にミント
6. **🔄 新日開始**: 新しい日のオークションが開始

### スマートコントラクト機能

- **ERC-721準拠**: 標準NFT実装
- **オークション管理**: 日付ベースの入札管理
- **支払い処理**: ETH決済と手数料管理
- **アクセス制御**: 所有者権限とセキュリティ
- **緊急機能**: 管理者による緊急ミント

### API エンドポイント

```
GET  /api/winner/:date          # 指定日の勝者情報
GET  /api/history/:date         # 指定日の入札履歴
GET  /api/calendar/:year/:month # 月別カレンダーデータ
GET  /api/collection/:wallet    # ウォレットのNFTコレクション
POST /api/bid                   # 入札送信
POST /api/execute-mint          # NFTミント実行
GET  /api/stats                 # システム統計
```

## ⚙️ 設定

### 環境変数

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `PRIVATE_KEY` | デプロイヤーのプライベートキー | ✅ |
| `PINATA_API_KEY` | Pinata API キー | ✅ |
| `PINATA_API_SECRET_KEY` | Pinata API シークレット | ✅ |
| `SEPOLIA_RPC_URL` | Sepolia RPC URL | ⚠️ |
| `ETHERSCAN_API_KEY` | Etherscan API キー | ⚠️ |
| `TREASURY_WALLET` | トレジャリーウォレット | ⚠️ |
| `CONTRACT_ADDRESS` | デプロイ済みコントラクトアドレス | ✅ |

### オークション設定

```javascript
// 設定可能パラメータ
const auctionConfig = {
  startTime: 0,           // 開始時刻（午前0時）
  duration: 86400,        // 期間（24時間）
  minBidIncrement: 0.001, // 最小入札増分（ETH）
  autoMintEnabled: true   // 自動ミント有効
};
```

## 🗄️ データベーススキーマ

### 主要テーブル

- **AuctionBid**: 入札情報
- **PendingMint**: ミント待ちNFT
- **NFT**: ミント済みNFT
- **User**: ユーザープロファイル
- **SystemEvent**: システムイベントログ

## 🔒 セキュリティ機能

- **署名認証**: すべての入札でWallet署名を要求
- **ReentrancyGuard**: 再入攻撃防止
- **Access Control**: 管理者権限の適切な分離
- **Input Validation**: 入力値の検証とサニタイゼーション
- **Rate Limiting**: API呼び出し制限

## 🚀 デプロイオプション

### 本番環境デプロイ

```bash
# Nginx + SSL + Systemd での完全デプロイ
sudo ./deploy.sh

# SSL証明書取得（ドメイン設定後）
sudo certbot --nginx -d yourdomain.com
```

### 開発環境

```bash
# 開発モードでの起動
npm run dev  # 各ディレクトリで実行
```

### Docker（将来対応予定）

```bash
# コンテナ化デプロイ
docker-compose up -d
```

## 📊 監視・分析

### ログ確認

```bash
# サーバーログ
sudo journalctl -u today-nft-auction -f

# UIログ  
sudo journalctl -u today-nft-ui -f

# Nginxログ
sudo tail -f /var/log/nginx/access.log
```

### 統計データ

- 総入札数
- ユニーク入札者数
- 総NFT数
- 月別統計
- ユーザー別統計

## 🛠️ メンテナンス

### 定期タスク

- **日次**: 勝者決定とNFTミント
- **2時間毎**: 失敗ミントの再試行
- **毎時**: ヘルスチェック
- **週次**: 古いデータのクリーンアップ

### バックアップ

```bash
# データベースバックアップ
cp today_nft_auction/dev.db backup/dev_$(date +%Y%m%d).db

# 設定ファイルバックアップ
tar -czf backup/config_$(date +%Y%m%d).tar.gz .env
```

## 🐛 トラブルシューティング

### よくある問題

1. **コントラクトデプロイ失敗**
   ```bash
   # RPC URL確認
   curl -X POST -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
     $SEPOLIA_RPC_URL
   ```

2. **NFTミント失敗**
   ```bash
   # ETH残高確認
   # ガス価格確認
   # コントラクト状態確認
   ```

3. **IPFS アップロード失敗**
   ```bash
   # Pinata API キー確認
   curl -X GET \
     -H "pinata_api_key: $PINATA_API_KEY" \
     -H "pinata_secret_api_key: $PINATA_API_SECRET_KEY" \
     "https://api.pinata.cloud/data/testAuthentication"
   ```

### エラーコード

- `E001`: プライベートキー不正
- `E002`: RPC接続失敗  
- `E003`: コントラクト呼び出し失敗
- `E004`: IPFS アップロード失敗
- `E005`: データベースエラー

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/新機能`)
3. 変更をコミット (`git commit -am '新機能を追加'`)
4. ブランチにプッシュ (`git push origin feature/新機能`)
5. プルリクエストを作成

### 開発ガイドライン

- TypeScript/JavaScript のコーディング規約に従う
- 新機能にはテストを追加
- 日本語でのコメント記述
- セキュリティベストプラクティスを遵守

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照

## 🙏 謝辞

- [OpenZeppelin](https://openzeppelin.com/) - 安全なスマートコントラクトライブラリ
- [Hardhat](https://hardhat.org/) - Ethereum開発環境
- [Pinata](https://pinata.cloud/) - IPFS インフラストラクチャ
- [SvelteKit](https://kit.svelte.dev/) - 高性能Webフレームワーク
- [Prisma](https://prisma.io/) - 次世代ORM

## 📞 サポート

### コミュニティ

- GitHub Issues: バグ報告・機能要求
- GitHub Discussions: 質問・ディスカッション

### 技術サポート

プロダクション環境での問題は、詳細な環境情報とログを含めてIssueを作成してください。

---

**今日から始めよう！毎日がNFTになる新しい体験を。** 🚀