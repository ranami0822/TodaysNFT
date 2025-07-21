<script lang="ts">
  import { onMount } from 'svelte';
  import { walletAddress, NativeBalance } from '$lib/typing/store'; 
  import { io } from 'socket.io-client';
  import { ethers } from 'ethers';

  interface Bid {
    wallet: string;
    price: number;
    createdAt: Date;
    message?: string;
    date: string;
  }

  interface Winner {
    wallet: string;
    price: number;
    message?: string;
    date: string;
  }

  interface CalendarDay {
    date: string;
    day: number;
    hasWinner: boolean;
    winner?: {
      wallet: string;
      price: number;
      message?: string;
    };
    nft?: {
      tokenId?: number;
      metadataUrl: string;
      txHash?: string;
    };
    hasBids: boolean;
  }

  interface NFTCollection {
    tokenId: string;
    date: string;
  }

  // 状態管理
  let socket: any;
  let price = $state(0);
  let bidMessage = $state('');
  let today: string = $state('');
  let selectedDate: string = $state('');
  let winner: Winner | null = $state(null);
  let history: Bid[] = $state([]);
  let currentView = $state('auction'); // 'auction', 'calendar', 'collection', 'stats'
  let isLoading = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');

  // カレンダー状態
  let currentYear = $state(new Date().getFullYear());
  let currentMonth = $state(new Date().getMonth() + 1);
  let calendarData: CalendarDay[] = $state([]);
  let calendarLoading = $state(false);

  // コレクション状態
  let userCollection: NFTCollection[] = $state([]);
  let collectionLoading = $state(false);

  // 統計状態
  let stats = $state(null);

  onMount(async () => {
    const res = await fetch('/api/date');
    const data = await res.json();
    today = data.date;
    selectedDate = today;

    await loadTodayData();
    await connectWebSocket();
    
    // 初期カレンダー読み込み
    await loadCalendar(currentYear, currentMonth);
  });

  async function loadTodayData() {
    try {
      const [winnerRes, historyRes] = await Promise.all([
        fetch(`http://localhost:3000/api/winner/${selectedDate}`),
        fetch(`http://localhost:3000/api/history/${selectedDate}`)
      ]);

      if (winnerRes.ok) {
        winner = await winnerRes.json();
      } else {
        winner = null;
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        history = historyData.bids || [];
      }
    } catch (error) {
      console.error('データ読み込みエラー:', error);
    }
  }

  async function connectWebSocket() {
    socket = io('http://localhost:3000');
    
    socket.on('new-bid', (bid: Bid) => {
      if (bid.date === selectedDate) {
        history = [bid, ...history];
        if (!winner || bid.price > winner.price) {
          winner = bid;
        }
      }
    });

    socket.on('bid-error', (err: { message?: string }) => {
      showError(err.message || "入札エラーが発生しました");
    });
  }

  async function sendBid() {
    if (!$walletAddress || !price) return;
    if (price <= 0) {
      showError('価格は0.001以上で入力してください');
      price = 0;
      return;
    }

    try {
      isLoading = true;
      
      // ETH残高確認
      console.log('🔍 ETH残高を確認中...');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const balance = await provider.getBalance($walletAddress);
      const balanceInEth = parseFloat(ethers.formatEther(balance));
      
      if (balanceInEth < price) {
        showError(`ETH残高が不足しています。\n必要: ${price} ETH\n現在の残高: ${balanceInEth.toFixed(4)} ETH`);
        return;
      }

      // 署名取得
      console.log('✍️ 署名を取得中...');
      const verified = await signAndVerify();
      if (!verified.success) {
        showError('本人確認に失敗しました。');
        return;
      }

      // API経由で入札送信
      const response = await fetch('http://localhost:3000/api/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: $walletAddress,
          price: price,
          signature: verified.signature,
          message: verified.message,
          bidMessage: bidMessage,
          date: selectedDate
        })
      });

      const result = await response.json();
      
      if (result.ok) {
        showSuccess('入札が完了しました！');
        price = 0;
        bidMessage = '';
      } else {
        showError(result.message || '入札に失敗しました');
      }

    } catch (error) {
      console.error('入札エラー:', error);
      showError('入札中にエラーが発生しました');
    } finally {
      isLoading = false;
    }
  }

  async function signAndVerify(): Promise<{ success: boolean; signature?: string; message?: string }> {
    try {
      const res = await fetch("http://localhost:3000/api/request-signature", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: $walletAddress })
      });

      const { message } = await res.json();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(message);

      const verifyRes = await fetch('http://localhost:3000/api/verify-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: $walletAddress, message, signature }),
      });

      const result = await verifyRes.json();
      if (result.ok) {
        console.log('✅ 本人確認成功');
        return { success: true, signature, message };
      } else {
        console.error('❌ 検証失敗');
        return { success: false };
      }
    } catch (error) {
      console.error('署名エラー:', error);
      return { success: false };
    }
  }

  async function loadCalendar(year: number, month: number) {
    calendarLoading = true;
    try {
      const response = await fetch(`http://localhost:3000/api/calendar/${year}/${month}`);
      const data = await response.json();
      calendarData = data.calendar || [];
    } catch (error) {
      console.error('カレンダー読み込みエラー:', error);
      showError('カレンダーの読み込みに失敗しました');
    } finally {
      calendarLoading = false;
    }
  }

  async function loadUserCollection() {
    if (!$walletAddress) return;
    
    collectionLoading = true;
    try {
      const response = await fetch(`http://localhost:3000/api/collection/${$walletAddress}`);
      const data = await response.json();
      userCollection = data.blockchainNFTs || [];
    } catch (error) {
      console.error('コレクション読み込みエラー:', error);
      showError('コレクションの読み込みに失敗しました');
    } finally {
      collectionLoading = false;
    }
  }

  async function loadStats() {
    try {
      const response = await fetch('http://localhost:3000/api/stats');
      stats = await response.json();
    } catch (error) {
      console.error('統計読み込みエラー:', error);
      showError('統計の読み込みに失敗しました');
    }
  }

  function navigateMonth(direction: number) {
    const newMonth = currentMonth + direction;
    if (newMonth > 12) {
      currentMonth = 1;
      currentYear++;
    } else if (newMonth < 1) {
      currentMonth = 12;
      currentYear--;
    } else {
      currentMonth = newMonth;
    }
    loadCalendar(currentYear, currentMonth);
  }

  function selectDate(date: string) {
    selectedDate = date;
    currentView = 'auction';
    loadTodayData();
  }

  function switchView(view: string) {
    currentView = view;
    if (view === 'collection') {
      loadUserCollection();
    } else if (view === 'stats') {
      loadStats();
    }
  }

  function showError(message: string) {
    errorMessage = message;
    setTimeout(() => errorMessage = '', 5000);
  }

  function showSuccess(message: string) {
    successMessage = message;
    setTimeout(() => successMessage = '', 3000);
  }

  function formatAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('ja-JP');
  }

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
</script>

<style>
  .app-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Meiryo', sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
  }

  .header {
    text-align: center;
    margin-bottom: 30px;
    padding: 30px;
    background: rgba(255, 255, 255, 0.95);
    color: #333;
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(10px);
  }

  .nav-tabs {
    display: flex;
    justify-content: center;
    gap: 15px;
    margin-bottom: 30px;
    flex-wrap: wrap;
  }

  .nav-tab {
    padding: 15px 30px;
    background: rgba(255, 255, 255, 0.9);
    border: 2px solid transparent;
    border-radius: 50px;
    cursor: pointer;
    transition: all 0.3s ease;
    font-weight: 600;
    font-size: 14px;
    backdrop-filter: blur(10px);
  }

  .nav-tab.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  }

  .nav-tab:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  }

  .content-section {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 20px;
    padding: 30px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(10px);
    margin-bottom: 20px;
  }

  .auction-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 30px;
  }

  @media (max-width: 768px) {
    .auction-section {
      grid-template-columns: 1fr;
    }
  }

  .bid-form {
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    padding: 25px;
    border-radius: 15px;
    border: 2px solid #e9ecef;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #495057;
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 15px;
    border: 2px solid #e9ecef;
    border-radius: 10px;
    font-size: 16px;
    transition: border-color 0.3s;
    font-family: inherit;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .btn {
    padding: 15px 30px;
    border: none;
    border-radius: 50px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
  }

  .winner-info {
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    color: white;
    padding: 25px;
    border-radius: 15px;
    text-align: center;
    box-shadow: 0 4px 15px rgba(40, 167, 69, 0.4);
  }

  .winner-info h3 {
    margin: 0 0 15px 0;
    font-size: 24px;
  }

  .winner-details {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
  }

  .history-section {
    max-height: 400px;
    overflow-y: auto;
  }

  .bid-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border-radius: 10px;
    margin-bottom: 10px;
    border-left: 4px solid #667eea;
    transition: transform 0.2s ease;
  }

  .bid-item:hover {
    transform: translateX(5px);
  }

  .bid-item:first-child {
    border-left-color: #28a745;
    background: linear-gradient(135deg, #e8f5e8 0%, #d4edda 100%);
  }

  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 5px;
    margin-top: 20px;
  }

  .calendar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .calendar-day {
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 1px solid #e9ecef;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.3s ease;
    padding: 8px;
    min-height: 80px;
    position: relative;
  }

  .calendar-day:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  }

  .calendar-day.has-winner {
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(40, 167, 69, 0.4);
  }

  .calendar-day.today {
    border: 3px solid #667eea;
    font-weight: bold;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }

  .calendar-day.selected {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.6);
  }

  .collection-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 20px;
    margin-top: 20px;
  }

  .nft-card {
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border-radius: 15px;
    padding: 20px;
    text-align: center;
    border: 2px solid #e9ecef;
    transition: transform 0.3s ease;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  }

  .nft-card:hover {
    transform: translateY(-10px);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-top: 20px;
  }

  .stat-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 25px;
    border-radius: 15px;
    text-align: center;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    transition: transform 0.3s ease;
  }

  .stat-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6);
  }

  .stat-number {
    font-size: 2.5em;
    font-weight: bold;
    margin-bottom: 10px;
  }

  .alert {
    padding: 15px 25px;
    border-radius: 10px;
    margin-bottom: 20px;
    font-weight: 500;
    backdrop-filter: blur(10px);
  }

  .alert-error {
    background: rgba(248, 215, 218, 0.9);
    color: #721c24;
    border: 1px solid #f5c6cb;
  }

  .alert-success {
    background: rgba(212, 237, 218, 0.9);
    color: #155724;
    border: 1px solid #c3e6cb;
  }

  .loading {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>

<div class="app-container">
  <!-- ヘッダー -->
  <div class="header">
    <h1>🗓️ Today's NFT</h1>
    <p>毎日、その日を自分のものにする。</p>
    {#if $walletAddress}
      <p>ウォレット: {formatAddress($walletAddress)} | 残高: {$NativeBalance} ETH</p>
      <p><small>ネットワーク: Ethereum Sepolia テストネット</small></p>
    {:else}
      <p>ウォレットを接続してください</p>
    {/if}
  </div>

  <!-- アラート -->
  {#if errorMessage}
    <div class="alert alert-error">{errorMessage}</div>
  {/if}
  
  {#if successMessage}
    <div class="alert alert-success">{successMessage}</div>
  {/if}

  <!-- ナビゲーション -->
  <div class="nav-tabs">
    <button 
      class="nav-tab" 
      class:active={currentView === 'auction'}
      onclick={() => switchView('auction')}
    >
      🏆 オークション
    </button>
    <button 
      class="nav-tab" 
      class:active={currentView === 'calendar'}
      onclick={() => switchView('calendar')}
    >
      📅 カレンダー
    </button>
    {#if $walletAddress}
      <button 
        class="nav-tab" 
        class:active={currentView === 'collection'}
        onclick={() => switchView('collection')}
      >
        🖼️ コレクション
      </button>
    {/if}
    <button 
      class="nav-tab" 
      class:active={currentView === 'stats'}
      onclick={() => switchView('stats')}
    >
      📊 統計
    </button>
  </div>

  <!-- オークションビュー -->
  {#if currentView === 'auction'}
    <div class="content-section">
      <h2>📅 {formatDate(selectedDate)} のオークション</h2>
      
      <div class="auction-section">
        <!-- 入札フォーム -->
        <div>
          <h3>💰 入札する</h3>
          <div class="bid-form">
            <div class="form-group">
              <label for="price">価格（ETH）</label>
              <input 
                id="price" 
                type="number" 
                step="0.001"
                min="0.001"
                bind:value={price} 
                placeholder="0.001"
                disabled={isLoading}
              />
              <small>最小入札額: 0.001 ETH</small>
            </div>
            
            <div class="form-group">
              <label for="message">メッセージ（任意）</label>
              <textarea 
                id="message" 
                bind:value={bidMessage} 
                placeholder="あなたのメッセージを入力してください..."
                rows="3"
                disabled={isLoading}
              ></textarea>
            </div>
            
            <button 
              class="btn btn-primary"
              onclick={sendBid}
              disabled={!$walletAddress || isLoading || price <= 0}
            >
              {#if isLoading}
                <span class="loading">
                  <span class="spinner"></span>
                  処理中...
                </span>
              {:else}
                💰 入札する
              {/if}
            </button>
          </div>
        </div>

        <!-- 勝者情報 -->
        <div>
          <h3>🏆 現在の勝者</h3>
          {#if winner}
            <div class="winner-info">
              <h3>🏆 勝者</h3>
              <div class="winner-details">
                <div><strong>{formatAddress(winner.wallet)}</strong></div>
                <div>💰 {winner.price} ETH</div>
                {#if winner.message}
                  <div>💬 {winner.message}</div>
                {/if}
              </div>
            </div>
          {:else}
            <div class="winner-info" style="background: linear-gradient(135deg, #6c757d 0%, #495057 100%);">
              <h3>まだ入札がありません</h3>
              <p>最初の入札者になりませんか？</p>
            </div>
          {/if}
        </div>
      </div>

      <!-- 入札履歴 -->
      <div style="margin-top: 30px;">
        <h3>📜 入札履歴 ({history.length}件)</h3>
        <div class="history-section">
          {#each history as bid, index}
            <div class="bid-item">
              <div>
                <div><strong>{formatAddress(bid.wallet)}</strong></div>
                {#if bid.message}
                  <div style="color: #6c757d; font-size: 14px;">💬 {bid.message}</div>
                {/if}
              </div>
              <div style="text-align: right;">
                <div><strong>{bid.price} ETH</strong></div>
                <div style="color: #6c757d; font-size: 12px;">
                  {new Date(bid.createdAt).toLocaleString('ja-JP')}
                </div>
              </div>
            </div>
          {/each}
          
          {#if history.length === 0}
            <div style="text-align: center; color: #6c757d; padding: 40px;">
              まだ入札がありません
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- カレンダービュー -->
  {#if currentView === 'calendar'}
    <div class="content-section">
      <div class="calendar-header">
        <button class="btn btn-primary" onclick={() => navigateMonth(-1)}>← 前月</button>
        <h2>{currentYear}年 {monthNames[currentMonth - 1]}</h2>
        <button class="btn btn-primary" onclick={() => navigateMonth(1)}>次月 →</button>
      </div>
      
      {#if calendarLoading}
        <div style="text-align: center; padding: 40px;">
          <span class="loading">
            <span class="spinner"></span>
            読み込み中...
          </span>
        </div>
      {:else}
        <div class="calendar-grid">
          {#each ['日', '月', '火', '水', '木', '金', '土'] as day}
            <div style="text-align: center; font-weight: bold; padding: 10px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px;">{day}</div>
          {/each}
          
          {#each calendarData as day}
            <div 
              class="calendar-day"
              class:has-winner={day.hasWinner}
              class:today={day.date === today}
              class:selected={day.date === selectedDate}
              onclick={() => selectDate(day.date)}
            >
              <div style="font-weight: bold;">{day.day}</div>
              {#if day.hasWinner}
                <div style="font-size: 12px;">🏆</div>
                <div style="font-size: 10px;">{day.winner?.price}E</div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- コレクションビュー -->
  {#if currentView === 'collection' && $walletAddress}
    <div class="content-section">
      <h2>🖼️ あなたのNFTコレクション</h2>
      
      {#if collectionLoading}
        <div style="text-align: center; padding: 40px;">
          <span class="loading">
            <span class="spinner"></span>
            読み込み中...
          </span>
        </div>
      {:else if userCollection.length > 0}
        <div class="collection-grid">
          {#each userCollection as nft}
            <div class="nft-card">
              <h4>Today's NFT #{nft.tokenId}</h4>
              <p><strong>日付:</strong> {formatDate(nft.date)}</p>
              <button class="btn btn-primary" style="margin-top: 10px;">
                詳細を見る
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <div style="text-align: center; padding: 40px; color: #6c757d;">
          <h3>まだNFTを持っていません</h3>
          <p>オークションに参加してNFTを獲得しましょう！</p>
          <button class="btn btn-primary" onclick={() => switchView('auction')}>
            オークションに参加
          </button>
        </div>
      {/if}
    </div>
  {/if}

  <!-- 統計ビュー -->
  {#if currentView === 'stats'}
    <div class="content-section">
      <h2>📊 システム統計</h2>
      
      {#if stats}
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">{stats.totalBids}</div>
            <div>総入札数</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-number">{stats.uniqueBidders}</div>
            <div>ユニーク入札者</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-number">{stats.totalNFTs}</div>
            <div>総NFT数</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-number">{stats.totalPendingMints}</div>
            <div>ミント待ち</div>
          </div>
          
          {#if stats.contractStats}
            <div class="stat-card">
              <div class="stat-number">{stats.contractStats.totalMinted}</div>
              <div>ブロックチェーン上のNFT</div>
            </div>
          {/if}
        </div>
      {:else}
        <div style="text-align: center; padding: 40px;">
          <span class="loading">
            <span class="spinner"></span>
            統計を読み込み中...
          </span>
        </div>
      {/if}
    </div>
  {/if}
</div>







