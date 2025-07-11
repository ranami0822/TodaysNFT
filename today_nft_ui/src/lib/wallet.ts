import { ethers } from 'ethers'
import { browser } from '$app/environment'
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethereum: any;
  }
}
export async function getNativeBalance(address: string): Promise<string> {
  if (!browser || typeof window === 'undefined' || !window.ethereum) {
    return '0'
  }
  const provider = new ethers.BrowserProvider(window.ethereum)
  const balance = await provider.getBalance(address)
  return ethers.formatEther(balance) // 小数点付きETH/MATIC表記
}


