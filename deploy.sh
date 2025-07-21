#!/bin/bash

# ===============================================
# Today's NFT デプロイスクリプト
# Ethereum Sepolia 対応版
# ===============================================

set -e

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ログ関数
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# エラー時の処理
error_exit() {
    log_error "$1"
    exit 1
}

# root確認
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error_exit "このスクリプトはroot権限で実行してください。sudo ./deploy.sh を使用してください。"
    fi
}

# 必要なコマンドの確認
check_commands() {
    log_info "必要なコマンドを確認中..."
    
    local missing_commands=()
    
    if ! command -v curl &> /dev/null; then
        missing_commands+=("curl")
    fi
    
    if ! command -v git &> /dev/null; then
        missing_commands+=("git")
    fi
    
    if [ ${#missing_commands[@]} -ne 0 ]; then
        log_warning "不足しているコマンド: ${missing_commands[*]}"
        log_info "必要なパッケージをインストール中..."
        apt update
        apt install -y curl git
    fi
    
    log_success "コマンド確認完了"
}

# Node.js インストール
install_nodejs() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log_success "Node.js は既にインストールされています: $NODE_VERSION"
        return
    fi
    
    log_info "Node.js をインストール中..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
    
    if command -v node &> /dev/null; then
        log_success "Node.js インストール完了: $(node --version)"
    else
        error_exit "Node.js のインストールに失敗しました"
    fi
}

# 環境変数チェック
check_environment() {
    log_info "環境変数を確認中..."
    
    local missing_vars=()
    
    if [[ -z "$PRIVATE_KEY" ]]; then
        missing_vars+=("PRIVATE_KEY")
    fi
    
    if [[ -z "$PINATA_API_KEY" ]]; then
        missing_vars+=("PINATA_API_KEY")
    fi
    
    if [[ -z "$PINATA_API_SECRET_KEY" ]]; then
        missing_vars+=("PINATA_API_SECRET_KEY")
    fi
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        log_error "必要な環境変数が設定されていません: ${missing_vars[*]}"
        echo ""
        echo "以下の環境変数を設定してから再実行してください:"
        echo "export PRIVATE_KEY=\"あなたのプライベートキー\""
        echo "export PINATA_API_KEY=\"あなたのPinata APIキー\""
        echo "export PINATA_API_SECRET_KEY=\"あなたのPinata APIシークレット\""
        echo "export SEPOLIA_RPC_URL=\"https://sepolia.infura.io/v3/YOUR_PROJECT_ID\" (オプション)"
        echo "export ETHERSCAN_API_KEY=\"あなたのEtherscan APIキー\" (オプション)"
        echo "export TREASURY_WALLET=\"トレジャリーウォレットアドレス\" (オプション)"
        echo ""
        exit 1
    fi
    
    # デフォルト値設定
    export NETWORK=${NETWORK:-"sepolia"}
    export SEPOLIA_RPC_URL=${SEPOLIA_RPC_URL:-"https://sepolia.infura.io/v3/YOUR_INFURA_KEY"}
    export TREASURY_WALLET=${TREASURY_WALLET:-""}
    
    log_success "環境変数確認完了"
    log_info "ネットワーク: $NETWORK"
}

# スマートコントラクトデプロイ
deploy_contract() {
    log_info "スマートコントラクトをデプロイ中..."
    
    cd today_nft_contract
    
    # 依存関係インストール
    if [[ ! -d "node_modules" ]]; then
        log_info "依存関係をインストール中..."
        npm install
    fi
    
    # .env ファイル作成
    cat > .env << EOF
PRIVATE_KEY=$PRIVATE_KEY
SEPOLIA_RPC_URL=$SEPOLIA_RPC_URL
MAINNET_RPC_URL=${MAINNET_RPC_URL:-"https://mainnet.infura.io/v3/YOUR_INFURA_KEY"}
ETHERSCAN_API_KEY=${ETHERSCAN_API_KEY:-""}
TREASURY_WALLET=$TREASURY_WALLET
NETWORK=$NETWORK
EOF

    # コンパイル
    log_info "コントラクトをコンパイル中..."
    npx hardhat compile
    
    # デプロイ
    log_info "コントラクトをデプロイ中（ネットワーク: $NETWORK）..."
    DEPLOY_OUTPUT=$(npx hardhat run scripts/deploy.ts --network $NETWORK)
    echo "$DEPLOY_OUTPUT"
    
    # コントラクトアドレス抽出
    CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP 'TodaysNFT デプロイ完了: \K0x[a-fA-F0-9]{40}')
    
    if [[ -z "$CONTRACT_ADDRESS" ]]; then
        error_exit "コントラクトアドレスの抽出に失敗しました"
    fi
    
    export CONTRACT_ADDRESS
    log_success "コントラクトデプロイ完了: $CONTRACT_ADDRESS"
    
    # ABI ファイルをオークションサーバーにコピー
    if [[ -f "artifacts/contracts/TodaysNFT.sol/TodaysNFT.json" ]]; then
        cp artifacts/contracts/TodaysNFT.sol/TodaysNFT.json ../today_nft_auction/
        log_success "ABI ファイルをコピーしました"
    fi
    
    cd ..
}

# オークションサーバーセットアップ
setup_auction_server() {
    log_info "オークションサーバーをセットアップ中..."
    
    cd today_nft_auction
    
    # 依存関係インストール
    if [[ ! -d "node_modules" ]]; then
        log_info "依存関係をインストール中..."
        npm install
    fi
    
    # Prisma セットアップ
    log_info "データベースをセットアップ中..."
    npx prisma generate
    npx prisma db push
    
    # .env ファイル作成
    cat > .env << EOF
# データベース
DATABASE_URL="file:./dev.db"

# ブロックチェーン設定
CONTRACT_ADDRESS=$CONTRACT_ADDRESS
PRIVATE_KEY=$PRIVATE_KEY
NETWORK=$NETWORK

# RPC URLs
SEPOLIA_RPC_URL=$SEPOLIA_RPC_URL
MAINNET_RPC_URL=${MAINNET_RPC_URL:-"https://mainnet.infura.io/v3/YOUR_INFURA_KEY"}

# IPFS (Pinata)
PINATA_API_KEY=$PINATA_API_KEY
PINATA_API_SECRET_KEY=$PINATA_API_SECRET_KEY

# サーバー設定
PORT=3000
NODE_ENV=production
EOF

    log_success "オークションサーバーセットアップ完了"
    cd ..
}

# UIセットアップ
setup_ui() {
    log_info "UIをセットアップ中..."
    
    cd today_nft_ui
    
    # 依存関係インストール
    if [[ ! -d "node_modules" ]]; then
        log_info "依存関係をインストール中..."
        npm install
    fi
    
    # ビルド
    log_info "UIをビルド中..."
    npm run build
    
    log_success "UIセットアップ完了"
    cd ..
}

# systemd サービス作成
create_systemd_services() {
    log_info "systemd サービスを作成中..."
    
    # オークションサーバーサービス
    cat > /etc/systemd/system/today-nft-auction.service << EOF
[Unit]
Description=Today's NFT Auction Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$(pwd)/today_nft_auction
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # UIサーバーサービス
    cat > /etc/systemd/system/today-nft-ui.service << EOF
[Unit]
Description=Today's NFT UI Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$(pwd)/today_nft_ui
Environment=NODE_ENV=production
ExecStart=/usr/bin/node build
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # サービス有効化
    systemctl daemon-reload
    systemctl enable today-nft-auction
    systemctl enable today-nft-ui
    
    log_success "systemd サービス作成完了"
}

# Nginx セットアップ
setup_nginx() {
    log_info "Nginx をセットアップ中..."
    
    # Nginx インストール
    if ! command -v nginx &> /dev/null; then
        apt update
        apt install -y nginx
    fi
    
    # Nginx 設定
    cat > /etc/nginx/sites-available/today-nft << EOF
server {
    listen 80;
    server_name _;
    
    # UI (SvelteKit)
    location / {
        proxy_pass http://localhost:4173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

    # サイト有効化
    ln -sf /etc/nginx/sites-available/today-nft /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Nginx テスト
    nginx -t
    systemctl reload nginx
    systemctl enable nginx
    
    log_success "Nginx セットアップ完了"
}

# SSL セットアップ
setup_ssl() {
    log_info "SSL セットアップの準備..."
    
    # Certbot インストール
    if ! command -v certbot &> /dev/null; then
        log_info "Certbot をインストール中..."
        apt update
        apt install -y certbot python3-certbot-nginx
    fi
    
    log_warning "SSL証明書の取得について:"
    echo ""
    echo "ドメインを設定している場合、以下のコマンドでSSL証明書を取得できます:"
    echo "sudo certbot --nginx -d yourdomain.com"
    echo ""
    echo "現在はHTTPでアクセス可能です。"
    echo ""
}

# ファイアウォール設定
setup_firewall() {
    log_info "ファイアウォールを設定中..."
    
    # UFW インストール・設定
    if ! command -v ufw &> /dev/null; then
        apt update
        apt install -y ufw
    fi
    
    # ファイアウォール設定
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    ufw allow 80
    ufw allow 443
    ufw --force enable
    
    log_success "ファイアウォール設定完了"
}

# サービス開始
start_services() {
    log_info "サービスを開始中..."
    
    # サービス開始
    systemctl start today-nft-auction
    systemctl start today-nft-ui
    systemctl start nginx
    
    # ステータス確認
    sleep 5
    
    if systemctl is-active --quiet today-nft-auction; then
        log_success "オークションサーバー: 起動中"
    else
        log_error "オークションサーバー: 起動失敗"
    fi
    
    if systemctl is-active --quiet today-nft-ui; then
        log_success "UIサーバー: 起動中"
    else
        log_error "UIサーバー: 起動失敗"
    fi
    
    if systemctl is-active --quiet nginx; then
        log_success "Nginx: 起動中"
    else
        log_error "Nginx: 起動失敗"
    fi
}

# デプロイサマリー表示
display_summary() {
    echo ""
    echo "========================================"
    echo "🎉 Today's NFT デプロイ完了！"
    echo "========================================"
    echo ""
    echo "📋 デプロイ情報:"
    echo "  📍 スマートコントラクト: $CONTRACT_ADDRESS"
    echo "  🌐 ネットワーク: $NETWORK"
    echo "  🔗 ウェブサイト: http://$(curl -s ifconfig.me)"
    echo ""
    echo "🛠️ サービス管理コマンド:"
    echo "  sudo systemctl status today-nft-auction    # オークションサーバー状態確認"
    echo "  sudo systemctl restart today-nft-auction   # オークションサーバー再起動"
    echo "  sudo systemctl status today-nft-ui         # UIサーバー状態確認"
    echo "  sudo systemctl restart today-nft-ui        # UIサーバー再起動"
    echo ""
    echo "📝 ログ確認:"
    echo "  sudo journalctl -u today-nft-auction -f    # オークションサーバーログ"
    echo "  sudo journalctl -u today-nft-ui -f         # UIサーバーログ"
    echo ""
    echo "🔐 SSL設定（ドメインがある場合）:"
    echo "  sudo certbot --nginx -d yourdomain.com"
    echo ""
    echo "⚠️ 重要な設定:"
    echo "  1. デプロイヤーウォレットにSepoliaのETHを送金してください"
    echo "  2. Pinata設定が正しいことを確認してください"
    echo "  3. プライベートキーは安全に管理してください"
    echo ""
    echo "🚀 セットアップが完了しました！ウェブサイトにアクセスしてテストしてください。"
    echo ""
}

# メイン実行関数
main() {
    echo ""
    echo "========================================"
    echo "🚀 Today's NFT デプロイ開始"
    echo "Ethereum Sepolia ネットワーク対応"
    echo "========================================"
    echo ""
    
    check_root
    check_commands
    install_nodejs
    check_environment
    deploy_contract
    setup_auction_server
    setup_ui
    create_systemd_services
    setup_nginx
    setup_ssl
    setup_firewall
    start_services
    display_summary
}

# スクリプト実行
main