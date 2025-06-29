import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';

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
const PORT = 3000;
app.use(express.static('public'));
app.get('/hello', (req, res) => {
    res.send("こんにちは！サーバーが起動しました。");
})
io.on('connection', (socket) => {
    console.log("client connnected:", socket.id);

    socket.on(
        'bid',
        async (data) => {
            console.log("入札きた", data);

            const saved = await prisma.auctionBid.create(
                {
                    data: {
                        wallet: data.wallet,
                        price: parseInt(data.price)
                    },
                }
            );
            console.log("入札保存完了", saved);
            io.emit('new-bid', saved)
        }
    )

})

httpServer.listen(
    PORT,
    () => {
        console.log(`サーバーがポート ${PORT} で起動しました。http://localhost:${PORT}`);
    }
)

