<script lang="ts">
  
  import { onMount } from 'svelte';
  import { walletAddress, NativeBalance, POLBalance } from '$lib/typing/store'; 
  import { io } from 'socket.io-client';

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

  function sendBid(){
    if(!$walletAddress || !price) return;
    socket.emit(
      'bid',
      {
        wallet:$walletAddress,
        price: parseInt(price.toString())
      }

    )
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
<h2>入札履歴</h2>

<ul>
  {#each history as bid}
    <li>
      {bid.wallet}-{bid.price} 円- {new Date(bid.createdAt).toLocaleString()}
    </li>
  {/each}
</ul>





