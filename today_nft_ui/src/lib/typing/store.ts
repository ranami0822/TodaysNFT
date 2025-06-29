
import { writable } from 'svelte/store';

export const walletAddress = writable('');
export const NativeBalance = writable('0'); // 初期値は0
export const POLBalance = writable('0'); // 初期値は0
