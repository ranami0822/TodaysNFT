<script lang="ts">

   let { children } = $props();
  import '../app.css';
  import { onMount } from 'svelte';
  import { defaultEvmStores , defaultEvmStores as evm} from "ethers-svelte";
  import { connected, signerAddress, provider } from "ethers-svelte";
  import { walletAddress, NativeBalance , POLBalance} from '$lib/typing/store'; // Quoted: SvelteKit 最新推奨
  import { getNativeBalance, getPOLBalance } from '$lib/wallet';




  onMount(() => {
    defaultEvmStores.setProvider(); // ブラウザ環境なら自動的に window.ethereum を使う
    evm.setProvider();
    evm.signerAddress.subscribe(addr => {
      walletAddress.set(addr); // グローバルストアにアドレスを保存
    });
  });

  async function connect() {
    // MetaMask の接続をトリガー（setProvider で自動的に）
    await defaultEvmStores.setProvider();
    walletAddress.set($signerAddress); // グローバルストアにアドレスを保存
    NativeBalance.set(
      await getNativeBalance($signerAddress) // アドレスの残高を取得して保存
    ); // 初期化時に残高を0に設定
    POLBalance.set(
      await getPOLBalance($signerAddress) // アドレスの残高を取得して保存
    ); // 初期化時に残高を0に設定
    
  }


</script>

<div class="toolbar-wrapper">
  <nav class="toolbar fill">
    <a href="/calendar">
      <i>calendar_clock</i>
    </a>
    <a href="/">
      <i>home</i>
    </a>
    <a href="/stacks">
      <i>stacks</i>
    </a>
    <button onclick={connect} >
      <i>wallet</i>
      {#if $connected}
       <div class="tooltip no-space">Connected: {$signerAddress}</div>
      {:else}
        <div class="tooltip no-space">Connect Wallet</div>
      {/if}
    </button>
    
  </nav>
</div>


{@render children()}

<style>
  .toolbar-wrapper {
    position: fixed;
    top: 1rem;    /* ← 上から少し浮かせる */
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
  }
</style>
