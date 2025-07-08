<script lang="ts">
  
  import { onMount } from 'svelte';
  import { walletAddress, NativeBalance, POLBalance } from '$lib/typing/store'; 
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
      // Step 1: Check payment capability
      console.log('🔍 支払い能力を確認中...');
      const paymentCheck = await fetch('http://localhost:3000/api/check-payment-capability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: $walletAddress, amount: price })
      });
      
      const paymentResult = await paymentCheck.json();
      
      if (!paymentResult.ok) {
        alert(`エラー: ${paymentResult.message}`);
        return;
      }
      
      if (!paymentResult.canPay) {
        if (parseFloat(paymentResult.balance) < price) {
          alert(`POL残高が不足しています。\n必要: ${price} POL\n現在の残高: ${paymentResult.balance} POL`);
          return;
        }
        
        if (parseFloat(paymentResult.allowance) < price) {
          alert(`POLの使用許可が不足しています。\n必要: ${price} POL\n現在の許可: ${paymentResult.allowance} POL\n\nまず、POLトークンのapproveを実行してください。`);
          return;
        }
      }

      // Step 2: Get signature
      console.log('✍️ 署名を取得中...');
      const verified = await signAndVerify();
      if(!verified.success) {
        alert('本人確認に失敗しました。');
        return;
      }

      // Step 3: Submit bid with payment verification
      console.log('💰 支払い確認付き入札を送信中...');
      const bidResponse = await fetch('http://localhost:3000/api/bid-with-payment', {
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
        if (bidResult.needsApproval) {
          alert(`${bidResult.message}\n\nコントラクトアドレス: ${bidResult.contractAddress}`);
        } else {
          alert(`入札エラー: ${bidResult.message}`);
        }
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

  // POL token approval function
  async function approvePOL() {
    if (!$walletAddress) {
      alert('ウォレットを接続してください');
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // POL token contract address on Polygon
      const POL_TOKEN_ADDRESS = '0x455e53BAaC5d24EeD4b1424D9B1a26fF6B8Eef9C';
      const NFT_CONTRACT_ADDRESS = 'YOUR_CONTRACT_ADDRESS'; // TODO: Set actual contract address
      
      // POL token ABI for approve function
      const POL_TOKEN_ABI = [
        "function approve(address spender, uint256 amount) returns (bool)",
        "function balanceOf(address owner) view returns (uint256)",
        "function allowance(address owner, address spender) view returns (uint256)"
      ];
      
      const polContract = new ethers.Contract(POL_TOKEN_ADDRESS, POL_TOKEN_ABI, signer);
      
      // Approve maximum amount (or specific amount based on user input)
      const maxAmount = ethers.parseUnits('1000000', 18); // 1M POL max approval
      
      console.log('🔄 POL使用許可を実行中...');
      const tx = await polContract.approve(NFT_CONTRACT_ADDRESS, maxAmount);
      
      console.log('⏳ トランザクション送信済み:', tx.hash);
      alert(`POL使用許可のトランザクションを送信しました。\nハッシュ: ${tx.hash}\n\n確認をお待ちください...`);
      
      const receipt = await tx.wait();
      console.log('✅ POL使用許可完了!', receipt);
      alert('POL使用許可が完了しました！これで入札が可能になります。');
      
    } catch (error) {
      console.error('POL使用許可エラー:', error);
      if (error.message.includes('user rejected')) {
        alert('ユーザーによってトランザクションが拒否されました。');
      } else {
        alert(`POL使用許可エラー: ${error.message}`);
      }
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
      <p>残高: {$NativeBalance} ETH</p>
      <p>残高: {$POLBalance} POL</p>
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
  <label for="price">価格（POL）</label>
</div>
<button onclick={sendBid}>入札</button>
<button onclick={signAndVerify}>本人確認</button>
<button onclick={approvePOL}>POL使用許可</button>
<h2>入札履歴</h2>

<ul>
  {#each history as bid}
    <li>
      {bid.wallet}-{bid.price} 円- {new Date(bid.createdAt).toLocaleString()}
    </li>
  {/each}
</ul>





