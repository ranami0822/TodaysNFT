#!/bin/bash

# ===============================================
# Today's NFT 設定確認スクリプト
# Ethereum Sepolia 対応版
# ===============================================

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}🔍 Today's NFT 設定確認 (Ethereum Sepolia)${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

ALL_CHECKS_PASSED=true

# ===========================================
# システム要件チェック
# ===========================================

echo -e "${BLUE}🖥️  システム要件${NC}"

# Node.js バージョン確認
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js インストール済み: $NODE_VERSION${NC}"
    
    # バージョン確認 (v16以上推奨)
    NODE_MAJOR=$(echo $NODE_VERSION | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_MAJOR" -lt 16 ]; then
        echo -e "${YELLOW}⚠️  Node.js v16以上を推奨します（現在: $NODE_VERSION）${NC}"
    fi
else
    echo -e "${RED}❌ Node.js がインストールされていません${NC}"
    ALL_CHECKS_PASSED=false
fi

# npm 確認
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✅ npm インストール済み: $NPM_VERSION${NC}"
else
    echo -e "${RED}❌ npm がインストールされていません${NC}"
    ALL_CHECKS_PASSED=false
fi

# Git 確認
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    echo -e "${GREEN}✅ Git インストール済み: $GIT_VERSION${NC}"
else
    echo -e "${YELLOW}⚠️  Git がインストールされていません (デプロイには必須ではありません)${NC}"
fi

echo ""

# ===========================================
# プロジェクト構造チェック
# ===========================================

echo -e "${BLUE}📁 プロジェクト構造${NC}"

# 必要なディレクトリ
REQUIRED_DIRS=(
    "today_nft_contract"
    "today_nft_auction" 
    "today_nft_ui"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✅ $dir ディレクトリ存在${NC}"
    else
        echo -e "${RED}❌ $dir ディレクトリが見つかりません${NC}"
        ALL_CHECKS_PASSED=false
    fi
done

# 重要なファイル確認
echo ""
echo -e "${BLUE}📄 重要ファイル${NC}"

# コントラクトファイル
if [ -f "today_nft_contract/contracts/TodaysNFT.sol" ]; then
    echo -e "${GREEN}✅ スマートコントラクト: TodaysNFT.sol${NC}"
else
    echo -e "${RED}❌ TodaysNFT.sol が見つかりません${NC}"
    ALL_CHECKS_PASSED=false
fi

# Hardhat設定
if [ -f "today_nft_contract/hardhat.config.ts" ]; then
    echo -e "${GREEN}✅ Hardhat設定: hardhat.config.ts${NC}"
else
    echo -e "${RED}❌ hardhat.config.ts が見つかりません${NC}"
    ALL_CHECKS_PASSED=false
fi

# デプロイスクリプト
if [ -f "today_nft_contract/scripts/deploy.ts" ]; then
    echo -e "${GREEN}✅ デプロイスクリプト: deploy.ts${NC}"
else
    echo -e "${RED}❌ deploy.ts が見つかりません${NC}"
    ALL_CHECKS_PASSED=false
fi

# サーバーファイル
if [ -f "today_nft_auction/server.js" ]; then
    echo -e "${GREEN}✅ オークションサーバー: server.js${NC}"
else
    echo -e "${RED}❌ server.js が見つかりません${NC}"
    ALL_CHECKS_PASSED=false
fi

# Cronジョブ
if [ -f "today_nft_auction/cron.js" ]; then
    echo -e "${GREEN}✅ Cronジョブ: cron.js${NC}"
else
    echo -e "${RED}❌ cron.js が見つかりません${NC}"
    ALL_CHECKS_PASSED=false
fi

# Prismaスキーマ
if [ -f "today_nft_auction/prisma/schema.prisma" ]; then
    echo -e "${GREEN}✅ データベーススキーマ: schema.prisma${NC}"
else
    echo -e "${RED}❌ schema.prisma が見つかりません${NC}"
    ALL_CHECKS_PASSED=false
fi

# UIファイル
if [ -f "today_nft_ui/src/routes/+page.svelte" ]; then
    echo -e "${GREEN}✅ UI: +page.svelte${NC}"
else
    echo -e "${RED}❌ +page.svelte が見つかりません${NC}"
    ALL_CHECKS_PASSED=false
fi

echo ""

# ===========================================
# 環境変数チェック
# ===========================================

echo -e "${BLUE}🔐 環境変数${NC}"

if [[ -n "$PRIVATE_KEY" ]]; then
    echo -e "${GREEN}✅ PRIVATE_KEY 設定済み${NC}"
    
    # プライベートキーの基本形式確認
    if [[ ${#PRIVATE_KEY} -eq 64 ]] || [[ ${#PRIVATE_KEY} -eq 66 && $PRIVATE_KEY == 0x* ]]; then
        echo -e "${GREEN}✅ PRIVATE_KEY 形式正常${NC}"
    else
        echo -e "${YELLOW}⚠️  PRIVATE_KEY の形式を確認してください (64文字のhex文字列)${NC}"
    fi
else
    echo -e "${RED}❌ PRIVATE_KEY 未設定 (デプロイに必須)${NC}"
    ALL_CHECKS_PASSED=false
fi

if [[ -n "$PINATA_API_KEY" ]]; then
    echo -e "${GREEN}✅ PINATA_API_KEY 設定済み${NC}"
else
    echo -e "${YELLOW}⚠️  PINATA_API_KEY 未設定 (IPFSアップロードが失敗します)${NC}"
fi

if [[ -n "$PINATA_API_SECRET_KEY" ]]; then
    echo -e "${GREEN}✅ PINATA_API_SECRET_KEY 設定済み${NC}"
else
    echo -e "${YELLOW}⚠️  PINATA_API_SECRET_KEY 未設定 (IPFSアップロードが失敗します)${NC}"
fi

if [[ -n "$SEPOLIA_RPC_URL" ]]; then
    echo -e "${GREEN}✅ SEPOLIA_RPC_URL 設定済み${NC}"
else
    echo -e "${YELLOW}⚠️  SEPOLIA_RPC_URL 未設定 (デフォルトを使用)${NC}"
fi

if [[ -n "$ETHERSCAN_API_KEY" ]]; then
    echo -e "${GREEN}✅ ETHERSCAN_API_KEY 設定済み${NC}"
else
    echo -e "${YELLOW}⚠️  ETHERSCAN_API_KEY 未設定 (コントラクト検証ができません)${NC}"
fi

if [[ -n "$TREASURY_WALLET" ]]; then
    echo -e "${GREEN}✅ TREASURY_WALLET 設定済み${NC}"
else
    echo -e "${YELLOW}⚠️  TREASURY_WALLET 未設定 (デプロイヤーアドレスを使用)${NC}"
fi

echo ""

# ===========================================
# package.json確認
# ===========================================

echo -e "${BLUE}📦 パッケージ設定${NC}"

# コントラクト
if [ -f "today_nft_contract/package.json" ]; then
    echo -e "${GREEN}✅ コントラクト package.json 存在${NC}"
    if [ -d "today_nft_contract/node_modules" ]; then
        echo -e "${GREEN}✅ コントラクト 依存関係インストール済み${NC}"
    else
        echo -e "${YELLOW}⚠️  コントラクト 依存関係未インストール (npm install が必要)${NC}"
    fi
else
    echo -e "${RED}❌ コントラクト package.json が見つかりません${NC}"
    ALL_CHECKS_PASSED=false
fi

# オークションサーバー
if [ -f "today_nft_auction/package.json" ]; then
    echo -e "${GREEN}✅ オークションサーバー package.json 存在${NC}"
    if [ -d "today_nft_auction/node_modules" ]; then
        echo -e "${GREEN}✅ オークションサーバー 依存関係インストール済み${NC}"
    else
        echo -e "${YELLOW}⚠️  オークションサーバー 依存関係未インストール (npm install が必要)${NC}"
    fi
else
    echo -e "${RED}❌ オークションサーバー package.json が見つかりません${NC}"
    ALL_CHECKS_PASSED=false
fi

# UI
if [ -f "today_nft_ui/package.json" ]; then
    echo -e "${GREEN}✅ UI package.json 存在${NC}"
    if [ -d "today_nft_ui/node_modules" ]; then
        echo -e "${GREEN}✅ UI 依存関係インストール済み${NC}"
    else
        echo -e "${YELLOW}⚠️  UI 依存関係未インストール (npm install が必要)${NC}"
    fi
else
    echo -e "${RED}❌ UI package.json が見つかりません${NC}"
    ALL_CHECKS_PASSED=false
fi

echo ""

# ===========================================
# コンパイル済みコントラクト確認
# ===========================================

echo -e "${BLUE}🔨 コンパイル状況${NC}"

if [ -d "today_nft_contract/artifacts" ]; then
    echo -e "${GREEN}✅ コントラクト artifacts ディレクトリ存在${NC}"
    
    if [ -f "today_nft_contract/artifacts/contracts/TodaysNFT.sol/TodaysNFT.json" ]; then
        echo -e "${GREEN}✅ TodaysNFT.json コンパイル済み${NC}"
    else
        echo -e "${YELLOW}⚠️  TodaysNFT.json 未コンパイル (npx hardhat compile が必要)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  artifacts ディレクトリ未作成 (npx hardhat compile が必要)${NC}"
fi

echo ""

# ===========================================
# ネットワーク接続テスト
# ===========================================

echo -e "${BLUE}🌐 ネットワーク接続${NC}"

# Sepolia RPC テスト
SEPOLIA_TEST_URL=${SEPOLIA_RPC_URL:-"https://sepolia.infura.io/v3/YOUR_INFURA_KEY"}
if curl -s --max-time 10 -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    "$SEPOLIA_TEST_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Sepolia RPC 接続正常${NC}"
else
    echo -e "${YELLOW}⚠️  Sepolia RPC 接続テスト失敗 (RPC URLを確認してください)${NC}"
fi

# Pinata API テスト
if [[ -n "$PINATA_API_KEY" && -n "$PINATA_API_SECRET_KEY" ]]; then
    if curl -s --max-time 10 -X GET \
        -H "pinata_api_key: $PINATA_API_KEY" \
        -H "pinata_secret_api_key: $PINATA_API_SECRET_KEY" \
        "https://api.pinata.cloud/data/testAuthentication" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Pinata API 接続正常${NC}"
    else
        echo -e "${YELLOW}⚠️  Pinata API 接続テスト失敗 (API キーを確認してください)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Pinata API キー未設定のため接続テストをスキップ${NC}"
fi

echo ""

# ===========================================
# 結果サマリー
# ===========================================

echo -e "${BLUE}============================================${NC}"
if [ "$ALL_CHECKS_PASSED" = true ]; then
    echo -e "${GREEN}🎉 全ての重要なチェックをパスしました！${NC}"
    echo ""
    echo -e "${GREEN}次のステップ:${NC}"
    echo "1. 環境変数を設定："
    echo "   export PRIVATE_KEY=\"あなたのプライベートキー\""
    echo "   export PINATA_API_KEY=\"あなたのPinata APIキー\""  
    echo "   export PINATA_API_SECRET_KEY=\"あなたのPinata APIシークレット\""
    echo "   export SEPOLIA_RPC_URL=\"https://sepolia.infura.io/v3/YOUR_PROJECT_ID\""
    echo ""
    echo "2. デプロイを実行："
    echo "   sudo ./deploy.sh"
    echo ""
    echo "3. ウォレットにSepoliaのETHを送金してください"
    echo "   - Sepolia Faucet: https://sepoliafaucet.com/"
    echo ""
else
    echo -e "${RED}❌ いくつかの問題が見つかりました${NC}"
    echo ""
    echo -e "${YELLOW}修正が必要な項目:${NC}"
    echo "1. 不足しているファイルやディレクトリを確認"
    echo "2. 必要な環境変数を設定"
    echo "3. 依存関係をインストール (npm install)"
    echo "4. 問題を修正後、再度このスクリプトを実行"
fi

echo -e "${BLUE}============================================${NC}"

exit 0