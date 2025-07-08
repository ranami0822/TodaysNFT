<script lang="ts">
  import { mintNFT } from "$lib/contract";
  import {get} from 'svelte/store';
  import { walletAddress } from '$lib/typing/store';

  async function tryMint(){
    const address = get(walletAddress);
    const res = await fetch(`http://localhost:3000/api/pending/${address}`);

    if(res.status !== 200){
      alert(`Mint できません。ステータスコード: ${res.status}`);
      return;
    }

    const {metadataUrl} = await res.json();
    try {
      await mintNFT(metadataUrl);
      alert("Mint 成功！");
      //TODO: mintedでtrueにしよう

    } catch(e){
      console.error("Mint 失敗:", e);
      alert("Mint に失敗しました。,");

    }
  }
  
</script>

<button onclick={tryMint}>
  Mint NFT
</button>

<style>
    :root{
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
    }
</style>



