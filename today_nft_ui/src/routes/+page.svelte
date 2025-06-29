<script lang="ts">
  
  import { onMount } from 'svelte';
  import { walletAddress, NativeBalance, POLBalance } from '$lib/typing/store'; // Quoted: SvelteKit 最新推奨
  let today = $state('');
  onMount(async () => {
    const res = await fetch('/api/date');
    const data = await res.json();
    today = data.date;
  });


  


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

