import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { verifyMessage, ethers } from 'ethers';
import cors from 'cors';
import dayjs from 'dayjs';
import "./cron.js"; // Import the cron job to ensure it runs

const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();
const io = new Server(
    httpServer,
    {
        cors: {
            origin: "*",
        },
    }
);

app.use(cors())
app.use(express.json())
const PORT = process.env.PORT || 3000;

// ブロックチェーン設定 - Ethereum Sepolia対応
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY';
const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const NETWORK = process.env.NETWORK || 'sepolia';

// 使用するRPCを決定
const RPC_URL = NETWORK === 'mainnet' ? MAINNET_RPC_URL : SEPOLIA_RPC_URL;

// Enhanced TodaysNFT contract ABI
const NFT_CONTRACT_ABI = [
    "function mintToWinner(string memory date, address winner, string memory metadataUri) external payable",
    "function emergencyMint(string memory date, address winner, string memory metadataUri) external",
    "function exists(string memory date) external view returns (bool)",
    "function getAuctionInfo(string memory date) external view returns (tuple(uint256 tokenId, address winner, uint256 price, bool minted, string metadataUri, uint256 mintTimestamp, uint256 auctionEndTime))",
    "function setPendingWinner(address winner) external",
    "function removePendingWinner(address winner) external",
    "function pendingWinners(address) external view returns (bool)",
    "function getMonthlyCalendar(uint256 year, uint256 month) external view returns (bool[] memory daysWithNFTs, address[] memory winners)",
    "function getNFTsByOwner(address owner) external view returns (uint256[] memory tokenIds, string[] memory dates)",
    "function getCurrentTokenId() external view returns (uint256)",
    "function treasuryWallet() external view returns (address)",
    "function auctionConfig() external view returns (tuple(uint256 startTime, uint256 duration, uint256 minBidIncrement, bool autoMintEnabled))"
];

let provider, wallet, nftContract;

// ブロックチェーン接続初期化
function initializeBlockchain() {
    if (!PRIVATE_KEY || !CONTRACT_ADDRESS) {
        console.warn("⚠️  ブロックチェーン設定が不足しています。スマートコントラクト機能は無効化されます。");
        return;
    }
    
    try {
        provider = new ethers.JsonRpcProvider(RPC_URL);
        wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        nftContract = new ethers.Contract(CONTRACT_ADDRESS, NFT_CONTRACT_ABI, wallet);
        console.log("✅ ブロックチェーン接続を初期化しました");
        console.log("📍 コントラクトアドレス:", CONTRACT_ADDRESS);
        console.log("🔑 ウォレットアドレス:", wallet.address);
        console.log("🌐 ネットワーク:", NETWORK);
        console.log("🔗 RPC URL:", RPC_URL);
    } catch (error) {
        console.error("❌ ブロックチェーン接続の初期化に失敗しました:", error);
    }
}

initializeBlockchain();

// 静的ファイル提供
app.use(express.static('public'));

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        contract: CONTRACT_ADDRESS ? 'connected' : 'not configured',
        blockchain: nftContract ? 'ready' : 'not ready',
        network: NETWORK
    });
});

app.get('/hello', (req, res) => {
    res.send("こんにちは！Today's NFT サーバーが起動しました。");
})

// =============================================================================
// オークションエンドポイント
// =============================================================================

app.get("/api/winner/:date?", async (req, res) => {
    try {
        const date = req.params.date || dayjs().format('YYYY-MM-DD');
        
        const winner = await prisma.auctionBid.findFirst({
            where: { date: date },
            orderBy: { price: 'desc' }
        });

        if (!winner) {
            return res.status(404).json({ message: "まだ入札がありません。", date });
        }
        
        res.json({
            wallet: winner.wallet,
            price: winner.price,
            createdAt: winner.createdAt,
            message: winner.message || "",
            date: winner.date
        });
    } catch (error) {
        console.error("勝者情報取得エラー:", error);
        res.status(500).json({ message: "内部サーバーエラーが発生しました" });
    }
});

app.get('/api/history/:date?', async (req, res) => {
    try {
        const date = req.params.date || dayjs().format('YYYY-MM-DD');
        
        const bids = await prisma.auctionBid.findMany({
            where: { date: date },
            orderBy: { createdAt: 'desc' }
        });
        
        res.json({ bids, date, count: bids.length });
    } catch (error) {
        console.error("入札履歴取得エラー:", error);
        res.status(500).json({ error: "内部サーバーエラーが発生しました" });
    }
});

// =============================================================================
// カレンダーエンドポイント
// =============================================================================

app.get('/api/calendar/:year/:month', async (req, res) => {
    try {
        const year = parseInt(req.params.year);
        const month = parseInt(req.params.month);
        
        if (year < 2020 || year > 2030 || month < 1 || month > 12) {
            return res.status(400).json({ message: "無効な年月が指定されました" });
        }
        
        // ブロックチェーンからカレンダーデータ取得（利用可能な場合）
        let blockchainCalendar = null;
        if (nftContract) {
            try {
                const [daysWithNFTs, winners] = await nftContract.getMonthlyCalendar(year, month);
                blockchainCalendar = {
                    daysWithNFTs: daysWithNFTs.map(Boolean),
                    winners: winners
                };
            } catch (error) {
                console.warn("ブロックチェーンカレンダー取得エラー:", error);
            }
        }
        
        // データベースからカレンダーデータ取得
        const daysInMonth = dayjs(`${year}-${month.toString().padStart(2, '0')}-01`).daysInMonth();
        const databaseCalendar = [];
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            
            // この日の勝者を取得
            const winner = await prisma.auctionBid.findFirst({
                where: { date },
                orderBy: { price: 'desc' }
            });
            
            // NFT情報を取得（存在する場合）
            const nft = await prisma.nft.findUnique({
                where: { date }
            });
            
            databaseCalendar.push({
                date,
                day,
                hasWinner: !!winner,
                winner: winner ? {
                    wallet: winner.wallet,
                    price: winner.price,
                    message: winner.message
                } : null,
                nft: nft ? {
                    tokenId: nft.tokenId,
                    metadataUrl: nft.metadataUrl,
                    txHash: nft.txHash
                } : null,
                hasBids: !!winner
            });
        }
        
        res.json({
            year,
            month,
            daysInMonth,
            calendar: databaseCalendar,
            blockchainCalendar
        });
        
    } catch (error) {
        console.error("カレンダー取得エラー:", error);
        res.status(500).json({ error: "内部サーバーエラーが発生しました" });
    }
});

// 現在の月のカレンダー取得
app.get('/api/calendar/current', async (req, res) => {
    const now = dayjs();
    const year = now.year();
    const month = now.month() + 1;
    
    // 特定のカレンダーエンドポイントにリダイレクト
    req.params.year = year.toString();
    req.params.month = month.toString();
    
    // カレンダーエンドポイントロジックを呼び出し
    const response = await fetch(`${req.protocol}://${req.get('host')}/api/calendar/${year}/${month}`);
    const data = await response.json();
    res.json(data);
});

// =============================================================================
// NFTエンドポイント
// =============================================================================

app.get('/api/today', async (req, res) => {
    const today = dayjs().format('YYYY-MM-DD');
    try {
        // まずデータベースを確認
        const nft = await prisma.nft.findUnique({ where: { date: today } });
        
        // データベースにない場合、ブロックチェーンを確認
        let blockchainInfo = null;
        if (nftContract) {
            try {
                const exists = await nftContract.exists(today);
                if (exists) {
                    blockchainInfo = await nftContract.getAuctionInfo(today);
                }
            } catch (error) {
                console.warn("ブロックチェーンNFT確認エラー:", error);
            }
        }
        
        if (!nft && !blockchainInfo) {
            return res.status(404).json({ message: 'まだ生成されていません', date: today });
        }
        
        res.json({
            database: nft,
            blockchain: blockchainInfo,
            date: today
        });
    } catch (error) {
        console.error("今日のNFT取得エラー:", error);
        res.status(500).json({ message: "内部サーバーエラーが発生しました" });
    }
});

app.get("/api/pending/:wallet", async (req, res) => {
    const { wallet } = req.params;
    if (!wallet) {
        return res.status(400).json({ message: "ウォレットアドレスが必要です" });
    }

    try {
        const pending = await prisma.pendingMint.findFirst({
            where: { wallet: wallet.toLowerCase() }
        });
        
        if (!pending) {
            return res.status(404).json({ message: "ミント対象ではありません" });
        }

        // ブロックチェーン状態確認（利用可能な場合）
        let blockchainStatus = null;
        if (nftContract) {
            try {
                const isPending = await nftContract.pendingWinners(wallet);
                blockchainStatus = { isPendingOnContract: isPending };
            } catch (error) {
                console.warn("ブロックチェーン状態確認エラー:", error);
            }
        }

        res.json({
            metadataUrl: pending.metadataUrl,
            date: pending.date,
            price: pending.price,
            minted: pending.minted,
            txHash: pending.txHash,
            blockchainStatus
        });
    } catch (error) {
        console.error("Pending情報取得エラー:", error);
        res.status(500).json({ message: "内部サーバーエラーが発生しました" });
    }
});

// ユーザーのNFTコレクション取得
app.get('/api/collection/:wallet', async (req, res) => {
    const { wallet } = req.params;
    
    if (!wallet || !ethers.isAddress(wallet)) {
        return res.status(400).json({ message: "有効なウォレットアドレスが必要です" });
    }
    
    try {
        let blockchainNFTs = [];
        
        if (nftContract) {
            try {
                const [tokenIds, dates] = await nftContract.getNFTsByOwner(wallet);
                blockchainNFTs = tokenIds.map((tokenId, index) => ({
                    tokenId: tokenId.toString(),
                    date: dates[index]
                }));
            } catch (error) {
                console.warn("ブロックチェーンコレクション取得エラー:", error);
            }
        }
        
        // このウォレットのデータベースNFTを取得
        const databaseNFTs = await prisma.nft.findMany({
            where: { winner: wallet.toLowerCase() },
            orderBy: { createdAt: 'desc' }
        });
        
        res.json({
            wallet,
            blockchainNFTs,
            databaseNFTs,
            totalCount: blockchainNFTs.length
        });
        
    } catch (error) {
        console.error("コレクション取得エラー:", error);
        res.status(500).json({ message: "内部サーバーエラーが発生しました" });
    }
});

// =============================================================================
// 入札エンドポイント
// =============================================================================

app.post("/api/request-signature", express.json(), async (req, res) => {
    const { wallet } = req.body;

    if (!wallet || !ethers.isAddress(wallet)) {
        return res.status(400).json({ message: "有効なウォレットアドレスが必要です。" });
    }

    const nonce = Math.floor(Math.random() * 1_000_000);
    const timestamp = Date.now();
    const message = `Today's NFT ログイン確認\nNonce: ${nonce}\nTimestamp: ${timestamp}\nWallet: ${wallet}`;

    res.json({ message, nonce, timestamp });
});

app.post("/api/verify-signature", express.json(), async (req, res) => {
    console.log("署名検証リクエスト:", req.body);
    
    const { wallet, message, signature } = req.body;
    if (!wallet || !message || !signature) {
        return res.status(400).json({ ok: false, message: "ウォレットアドレス、メッセージ、署名が必要です。" });
    }

    try {
        const signerAddress = verifyMessage(message, signature);
        if (signerAddress.toLowerCase() === wallet.toLowerCase()) {
            return res.json({ ok: true });
        } else {
            return res.status(401).json({ ok: false, message: "署名が一致しません。" });
        }
    } catch (error) {
        console.error("署名検証エラー:", error);
        return res.status(500).json({ ok: false, message: "内部サーバーエラーが発生しました" });
    }
});

app.post('/api/bid', async (req, res) => {
    const { wallet, price, signature, message, bidMessage, date } = req.body;
    
    const targetDate = date || dayjs().format('YYYY-MM-DD');
    
    if (!wallet || !price || !signature || !message) {
        return res.status(400).json({ ok: false, message: '必要な情報が不足しています' });
    }
    
    if (price <= 0) {
        return res.status(400).json({ ok: false, message: '価格は1以上である必要があります' });
    }
    
    try {
        // まず署名を検証
        const signerAddress = verifyMessage(message, signature);
        if (signerAddress.toLowerCase() !== wallet.toLowerCase()) {
            return res.status(401).json({ ok: false, message: '署名が一致しません' });
        }
        
        // オークションがまだアクティブかどうか確認（時間ベースのロジックをここに追加可能）
        const auctionEndTime = dayjs(targetDate).add(1, 'day').startOf('day');
        if (dayjs().isAfter(auctionEndTime)) {
            return res.status(400).json({ ok: false, message: 'オークション時間が終了しています' });
        }
        
        // データベースに入札を保存
        const saved = await prisma.auctionBid.create({
            data: {
                wallet: wallet.toLowerCase(),
                price: parseInt(price),
                date: targetDate,
                message: bidMessage || ""
            }
        });
        
        console.log("✅ 入札保存完了", saved);
        
        // 全クライアントにブロードキャスト
        io.emit('new-bid', {
            ...saved,
            isNewHighest: true // 最高額かどうかを判定するロジックを追加可能
        });
        
        res.json({ ok: true, bid: saved });
        
    } catch (error) {
        console.error('入札エラー:', error);
        res.status(500).json({ ok: false, message: 'サーバーエラー: 入札できませんでした' });
    }
});

// =============================================================================
// ミンティングエンドポイント
// =============================================================================

app.post('/api/execute-mint', async (req, res) => {
    const { date } = req.body;
    
    if (!date) {
        return res.status(400).json({ ok: false, message: '日付が必要です' });
    }
    
    if (!nftContract) {
        return res.status(503).json({ ok: false, message: 'スマートコントラクト接続が利用できません' });
    }
    
    try {
        // この日付のペンディングミントがあるか確認
        const pendingMint = await prisma.pendingMint.findUnique({
            where: { date: date }
        });
        
        if (!pendingMint) {
            return res.status(404).json({ ok: false, message: '指定された日付のPendingMintが見つかりません' });
        }
        
        // ブロックチェーン上で既にミント済みかどうか確認
        const exists = await nftContract.exists(date);
        if (exists) {
            return res.status(400).json({ ok: false, message: 'この日付のNFTは既にミント済みです' });
        }
        
        // ミントトランザクション実行
        console.log(`🔄 ${date}のNFTを${pendingMint.wallet}にミント中...`);
        
        const priceWei = ethers.parseEther(pendingMint.price.toString());
        const tx = await nftContract.mintToWinner(
            date,
            pendingMint.wallet,
            pendingMint.metadataUrl,
            { value: priceWei }
        );
        
        console.log(`⏳ トランザクション送信済み: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`✅ NFTミント成功！ブロック: ${receipt.blockNumber}`);
        
        // データベースをミント済みとして更新
        await prisma.pendingMint.update({
            where: { date: date },
            data: { 
                minted: true,
                txHash: tx.hash,
                mintedAt: new Date()
            }
        });
        
        // NFTレコード作成
        await prisma.nft.upsert({
            where: { date: date },
            update: {
                txHash: tx.hash
            },
            create: {
                date: date,
                winner: pendingMint.wallet,
                price: pendingMint.price,
                metadataUrl: pendingMint.metadataUrl,
                txHash: tx.hash
            }
        });
        
        res.json({
            ok: true,
            message: 'NFTのミントが完了しました',
            txHash: tx.hash,
            blockNumber: receipt.blockNumber
        });
        
    } catch (error) {
        console.error('NFTミントエラー:', error);
        
        if (error.message.includes('insufficient funds')) {
            res.status(400).json({ ok: false, message: 'ETH残高が不足しています' });
        } else if (error.message.includes('Payment must be greater than 0')) {
            res.status(400).json({ ok: false, message: '支払い額は0より大きい必要があります' });
        } else {
            res.status(500).json({ ok: false, message: 'NFTのミントに失敗しました', error: error.message });
        }
    }
});

// 日付のミント状態取得
app.get('/api/mint-status/:date', async (req, res) => {
    const { date } = req.params;
    
    try {
        const pendingMint = await prisma.pendingMint.findUnique({
            where: { date: date }
        });
        
        let blockchainStatus = null;
        if (nftContract) {
            try {
                const exists = await nftContract.exists(date);
                if (exists) {
                    const auctionInfo = await nftContract.getAuctionInfo(date);
                    blockchainStatus = {
                        exists: true,
                        tokenId: auctionInfo.tokenId.toString(),
                        winner: auctionInfo.winner,
                        price: ethers.formatEther(auctionInfo.price),
                        minted: auctionInfo.minted,
                        metadataUri: auctionInfo.metadataUri,
                        mintTimestamp: auctionInfo.mintTimestamp.toString()
                    };
                }
            } catch (error) {
                console.warn('ブロックチェーン状態確認エラー:', error);
            }
        }
        
        res.json({
            date,
            pendingMint,
            blockchainStatus
        });
        
    } catch (error) {
        console.error('ミント状態確認エラー:', error);
        res.status(500).json({ ok: false, message: '内部サーバーエラーが発生しました' });
    }
});

// =============================================================================
// 統計エンドポイント
// =============================================================================

app.get('/api/stats', async (req, res) => {
    try {
        const totalBids = await prisma.auctionBid.count();
        const totalPendingMints = await prisma.pendingMint.count();
        const totalNFTs = await prisma.nft.count();
        const uniqueBidders = await prisma.auctionBid.groupBy({
            by: ['wallet'],
            _count: true
        });
        
        let contractStats = null;
        if (nftContract) {
            try {
                const currentTokenId = await nftContract.getCurrentTokenId();
                const treasuryWallet = await nftContract.treasuryWallet();
                contractStats = {
                    totalMinted: currentTokenId.toString(),
                    treasuryWallet
                };
            } catch (error) {
                console.warn("コントラクト統計取得エラー:", error);
            }
        }
        
        res.json({
            totalBids,
            totalPendingMints,
            totalNFTs,
            uniqueBidders: uniqueBidders.length,
            contractStats,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('統計取得エラー:', error);
        res.status(500).json({ error: '内部サーバーエラーが発生しました' });
    }
});

// =============================================================================
// WebSocketハンドリング
// =============================================================================

io.on('connection', (socket) => {
    console.log("クライアント接続:", socket.id);

    socket.on('bid', async (data) => {
        try {
            console.log("入札データ受信", data);

            // 入力値の検証
            if (
                !data.wallet ||
                typeof data.wallet !== 'string' ||
                !data.price ||
                isNaN(Number(data.price)) ||
                Number(data.price) <= 0
            ) {
                socket.emit('bid-error', { message: 'ウォレットアドレスと価格を正しく入力してください。' });
                return;
            }

            const targetDate = data.date || dayjs().format('YYYY-MM-DD');

            const saved = await prisma.auctionBid.create({
                data: {
                    wallet: data.wallet.toLowerCase(),
                    price: parseInt(data.price),
                    date: targetDate,
                    message: data.message || ""
                }
            });
            
            console.log("入札保存完了", saved);
            io.emit('new-bid', saved);
        } catch (err) {
            console.error("入札保存エラー:", err);
            socket.emit('bid-error', { message: 'サーバーエラー: 入札できませんでした。' });
        }
    });

    socket.on('disconnect', () => {
        console.log("クライアント切断:", socket.id);
    });
});

// =============================================================================
// サーバー起動
// =============================================================================

httpServer.listen(PORT, () => {
    console.log(`🚀 Today's NFT サーバーがポート ${PORT} で起動しました。`);
    console.log(`📱 UI: http://localhost:${PORT}`);
    console.log(`🔗 API: http://localhost:${PORT}/api/`);
    console.log(`💰 コントラクト: ${CONTRACT_ADDRESS || '未設定'}`);
    console.log(`🌐 ネットワーク: ${NETWORK}`);
    
    if (!CONTRACT_ADDRESS || !PRIVATE_KEY) {
        console.warn("⚠️  警告: ブロックチェーン設定が不完全です。.envファイルを確認してください。");
    }
});
