<script lang="ts">
  
  import { onMount } from 'svelte';
  import { walletAddress, NativeBalance } from '$lib/typing/store'; 
  import { io } from 'socket.io-client';
  import { ethers } from 'ethers';

  interface Bid {
    wallet: string;
    price: number;
    createdAt: Date;
  }

  interface Winner {
    wallet: string;
    price: number;
  }
  let socket: any;
  let price = $state(0);
  let today: string = $state('');
  let winner: Winner | null = $state(null);
  let history: Bid[] = $state([]);


  onMount(async () => {
    const res = await fetch('/api/date');

    const data = await res.json();
    today = data.date;

    const w = await fetch('http://localhost:3000/api/winner').then((res) => res.json());
    winner = w;

    const h = await fetch('http://localhost:3000/api/history').then((res) => res.json());
    history = h;

    socket = io('http://localhost:3000');
    socket.on('new-bid', (bid: Bid)=>{
      history = [bid, ...history];
      if(!winner || bid.price > winner.price){
        winner = bid;
      }
    })
  });

  async function sendBid(){
    if(!$walletAddress || !price) return;
    if(price <= 0){
      alert('価格は1以上で入力してください');
      price = 0; // Reset price to 0 to avoid negative or zero bids
      return;
    }

    try {
      // Step 1: Check MATIC balance
      console.log('🔍 MATIC残高を確認中...');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const balance = await provider.getBalance($walletAddress);
      const balanceInMatic = parseFloat(ethers.formatEther(balance));
      
      if (balanceInMatic < price) {
        alert(`MATIC残高が不足しています。\n必要: ${price} MATIC\n現在の残高: ${balanceInMatic.toFixed(4)} MATIC`);
        return;
      }

      // Step 2: Get signature
      console.log('✍️ 署名を取得中...');
      const verified = await signAndVerify();
      if(!verified.success) {
        alert('本人確認に失敗しました。');
        return;
      }

      // Step 3: Submit bid
      console.log('� 入札を送信中...');
      const bidResponse = await fetch('http://localhost:3000/api/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: $walletAddress,
          price: parseInt(price.toString()),
          signature: verified.signature,
          message: verified.message
        })
      });

      const bidResult = await bidResponse.json();

      if (bidResult.ok) {
        console.log('✅ 入札成功!', bidResult.bid);
        alert('入札が完了しました！');
        price = 0; // Reset price after successful bid
      } else {
        alert(`入札エラー: ${bidResult.message}`);
      }

    } catch (error) {
      console.error('入札エラー:', error);
      alert('入札中にエラーが発生しました。');
    }
  };

  async function signAndVerify(): Promise<{success: boolean, signature?: string, message?: string}> {
    try {
      const res = await fetch("http://localhost:3000/api/request-signature", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          wallet:$walletAddress,
        })
      });

      const {message} = await res.json();
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner() // ← addressは取得済みでもsignerは使う必要あり
      const signature = await signer.signMessage(message)

      const verifyRes = await fetch('http://localhost:3000/api/verify-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({wallet: $walletAddress, message, signature }),
      })

      const result = await verifyRes.json()
      if (result.ok) {
        console.log('✅ 本人確認成功')
        return { success: true, signature, message };
      } else {
        console.error('❌ 検証失敗')
        return { success: false };
      }
    } catch (error) {
      console.error('署名エラー:', error);
      return { success: false };
    }
  }   



</script>




<div style="
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
">
  <article class="border primary-container">
    <h1>{today}-NFT</h1>
    <p>今日を自分のものにする。</p>
    <p>こんな風にuser.addressでaddressがファイルのどこでもわかるように</p>
    <p>BY {$walletAddress}</p>
      <p>残高: {$NativeBalance} MATIC</p>
    </article>
</div>

<h1>Today's winner</h1>

{#if winner}
  <p><strong>{winner.wallet}</strong>が{winner.price}で入札しました</p>
{:else}
  <p>まだ入札がありません</p>
{/if}

<h2>入札</h2>
<div class="field border label">
  <input id="price" type="number" bind:value={price} />
  <label for="price">価格（MATIC）</label>
</div>
<button onclick={sendBid}>入札</button>
<button onclick={signAndVerify}>本人確認</button>
<h2>入札履歴</h2>

<ul>
  {#each history as bid}
    <li>
      {bid.wallet}-{bid.price} 円- {new Date(bid.createdAt).toLocaleString()}
    </li>
  {/each}
</ul>





