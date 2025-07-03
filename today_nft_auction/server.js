import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';

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
const PORT = 3000;
app.use(express.static('public'));
app.get('/hello', (req, res) => {
    res.send("こんにちは！サーバーが起動しました。");
})
app.get("/api/winner", async (req, res) => {
    try {
        const winner = await prisma.auctionBid.findFirst(
            {
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
                createdAt: winner.createdAt
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
                            price: parseInt(data.price)
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


