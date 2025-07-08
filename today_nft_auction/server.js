import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { verifyMessage } from 'ethers';
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
const today = dayjs().format('YYYY-MM-DD');
app.use(cors())
const PORT = 3000;
app.use(express.static('public'));
app.get('/hello', (req, res) => {
    res.send("こんにちは！サーバーが起動しました。");
})
app.get("/api/winner", async (req, res) => {
    try {
        const winner = await prisma.auctionBid.findFirst(
            {
                where: {
                    date: today
                },
                orderBy: {
                    price: 'desc'
                },

            }
        );

        if (!winner) {
            return res.status(404).json({ message: "入札がありません。" });
        }
        res.json(
            {
                wallet: winner.wallet,
                price: winner.price,
                createdAt: winner.createdAt,
                message: winner.message || "",
            }
        )
    } catch (error) {
        console.error("winnner取得エラー:", error);
        res.status(500).json({ message: "内部サーバーエラー" });
    }
});

app.get('/api/history', async (req, res) => {
    try {
        const bids = await prisma.auctionBid.findMany(
            {
                where: {
                    date: today
                },
                orderBy: {
                    createdAt: 'desc'
                }
            }
        );
        res.json(
            bids
        );
    } catch (error) {
        console.error("入札履歴取得エラー:", error);
        res.status(500).json({ error: "内部サーバーエラー" });
    }
});
io.on('connection', (socket) => {
    console.log("client connnected:", socket.id);

    socket.on(
        'bid',
        async (data) => {
            try {
                console.log("入札きた", data);

                // 入力値のバリデーション
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

                const saved = await prisma.auctionBid.create(
                    {
                        data: {
                            wallet: data.wallet,
                            price: parseInt(data.price),
                            date: today,
                            message: data.message || ""
                        },
                    }
                );
                console.log("入札保存完了", saved);
                io.emit('new-bid', saved);
            } catch (err) {
                console.error("入札保存エラー:", err);
                socket.emit('bid-error', { message: 'サーバーエラー: 入札できませんでした。' });
            }
        }
    );

    // 必要ならdisconnectイベントも追加
    // socket.on('disconnect', () => {
    //     console.log("client disconnected:", socket.id);
    // });
})

httpServer.listen(
    PORT,
    () => {
        console.log(`サーバーがポート ${PORT} で起動しました。http://localhost:${PORT}`);
    }
)

app.post("/api/request-signature", express.json(), async (req, res)=> {
    const {wallet} = req.body;

    if(!wallet) return res.status(400).json({message: "ウォレットアドレスが必要です。"});

    const nonce = Math.floor(Math.random()* 1_000_000);
    const message = `ログイン確認: ${nonce}`;

    res.json({message});
});

app.post("/api/verify-signature", express.json(), async (req, res) => {
    console.log("署名検証リクエスト:", req.body);
    
    const {wallet, message, signature} = req.body;
    if (!wallet || !message || !signature) {
        return res.status(400).json({ok: false, message: "ウォレットアドレス、メッセージ、署名が必要です。"});
    }

    try{
        const signerAddress = verifyMessage(message, signature);
        if (signerAddress.toLowerCase() === wallet.toLowerCase()) {
            return res.json({ok: true});

        }else{
            return res.status(401).json({ok: false, message:"署名が一致しません。"});
        }
    }catch(error){
        console.error("署名検証エラー:", error);
        return res.status(500).json({ok: false, message:"内部サーバーエラー"});
    }
})

app.get('/api/today', async (req, res) => {
  const today = dayjs().format('YYYY-MM-DD')
  const nft = await prisma.nft.findUnique({ where: { date: today } })
  if (!nft) return res.status(404).json({ message: 'まだ生成されていません' })
  res.json(nft)
});

app.get("/api/pending/:wallet", async (req, res)=>{
    const {wallet} = req.params;
    if (!wallet){
        return res.status(400).json({message: "walletが必要だよ😵‍💫"});
    };

    try{
        const pending = await prisma.PendingMint.findFirst(
            {
                where: {
                    wallet: wallet.toLowerCase(),
                }
            },
        );
        if(!pending){
            return res.status(404).json({message: "mint対象ではありません",pending});
        }

        res.json({
            metadataUrl: pending.metadataUrl,
            date: pending.date,
            price: pending.price,
        });
    } catch(error){
        console.error("pending取得エラー:", error);
        res.status(500).json({message: "内部サーバーエラー"});
    }
})