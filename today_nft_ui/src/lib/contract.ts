/* eslint-disable @typescript-eslint/no-explicit-any */
import {ethers} from 'ethers';


const CONTRACT_ADDRESS = "0xCc415217415A062c65BeED0973302a35F66DAB36";
const ABI = [
  {
    "inputs": [
      { "internalType": "string", "name": "tokenURI", "type": "string" }
    ],
    "name": "mintNFT",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

export async function mintNFT(tokenURI: string){
  if(!((window as unknown) as { ethereum: any }).ethereum) {
    alert("MetaMaskをインストールしてください");
    return;
  }

  const provider = new ethers.BrowserProvider((window as any).ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
  // 1引数で呼び出す
  const tx = await contract.mintNFT(tokenURI);
  console.log("トランザクションの送信中。。。.😶‍🌫️😶‍🌫️",tx.hash);
  await tx.wait();
  console.log("mint完了👍😎",tx.hash);
}
