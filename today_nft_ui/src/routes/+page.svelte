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

  // State management
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

  // Calendar state
  let currentYear = $state(new Date().getFullYear());
  let currentMonth = $state(new Date().getMonth() + 1);
  let calendarData: CalendarDay[] = $state([]);
  let calendarLoading = $state(false);

  // Collection state
  let userCollection: NFTCollection[] = $state([]);
  let collectionLoading = $state(false);

  // Stats state
  let stats = $state(null);

  onMount(async () => {
    const res = await fetch('/api/date');
    const data = await res.json();
    today = data.date;
    selectedDate = today;

    await loadTodayData();
    await connectWebSocket();
    
    // Load initial calendar
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
      showError('価格は1以上で入力してください');
      price = 0;
      return;
    }

    try {
      isLoading = true;
      
      // Check MATIC balance
      console.log('🔍 MATIC残高を確認中...');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const balance = await provider.getBalance($walletAddress);
      const balanceInMatic = parseFloat(ethers.formatEther(balance));
      
      if (balanceInMatic < price) {
        showError(`MATIC残高が不足しています。\n必要: ${price} MATIC\n現在の残高: ${balanceInMatic.toFixed(4)} MATIC`);
        return;
      }

      // Get signature
      console.log('✍️ 署名を取得中...');
      const verified = await signAndVerify();
      if (!verified.success) {
        showError('本人確認に失敗しました。');
        return;
      }

      // Send bid via API
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
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .header {
    text-align: center;
    margin-bottom: 30px;
    padding: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 15px;
  }

  .nav-tabs {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-bottom: 30px;
    flex-wrap: wrap;
  }

  .nav-tab {
    padding: 12px 24px;
    background: #f8f9fa;
    border: 2px solid #e9ecef;
    border-radius: 25px;
    cursor: pointer;
    transition: all 0.3s ease;
    font-weight: 500;
  }

  .nav-tab.active {
    background: #007bff;
    color: white;
    border-color: #007bff;
  }

  .nav-tab:hover {
    background: #e9ecef;
  }

  .nav-tab.active:hover {
    background: #0056b3;
  }

  .content-section {
    background: white;
    border-radius: 15px;
    padding: 30px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
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
    background: #f8f9fa;
    padding: 25px;
    border-radius: 10px;
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
    padding: 12px;
    border: 2px solid #e9ecef;
    border-radius: 8px;
    font-size: 16px;
    transition: border-color 0.3s;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #007bff;
  }

  .btn {
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .btn-primary {
    background: #007bff;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #0056b3;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .winner-info {
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    color: white;
    padding: 25px;
    border-radius: 10px;
    text-align: center;
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
    background: #f8f9fa;
    border-radius: 8px;
    margin-bottom: 10px;
    border-left: 4px solid #007bff;
  }

  .bid-item:first-child {
    border-left-color: #28a745;
    background: #e8f5e8;
  }

  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
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
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    padding: 8px;
    min-height: 80px;
  }

  .calendar-day:hover {
    background: #f8f9fa;
  }

  .calendar-day.has-winner {
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    color: white;
  }

  .calendar-day.today {
    border: 3px solid #007bff;
    font-weight: bold;
  }

  .calendar-day.selected {
    background: #007bff;
    color: white;
  }

  .collection-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 20px;
    margin-top: 20px;
  }

  .nft-card {
    background: #f8f9fa;
    border-radius: 10px;
    padding: 20px;
    text-align: center;
    border: 2px solid #e9ecef;
    transition: transform 0.3s ease;
  }

  .nft-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
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
    border-radius: 10px;
    text-align: center;
  }

  .stat-number {
    font-size: 2.5em;
    font-weight: bold;
    margin-bottom: 10px;
  }

  .alert {
    padding: 12px 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    font-weight: 500;
  }

  .alert-error {
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }

  .alert-success {
    background: #d4edda;
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
    border-top: 2px solid #007bff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>

<div class="app-container">
  <!-- Header -->
  <div class="header">
    <h1>🗓️ Today's NFT</h1>
    <p>毎日、その日を自分のものにする。</p>
    {#if $walletAddress}
      <p>ウォレット: {formatAddress($walletAddress)} | 残高: {$NativeBalance} MATIC</p>
    {:else}
      <p>ウォレットを接続してください</p>
    {/if}
  </div>

  <!-- Alerts -->
  {#if errorMessage}
    <div class="alert alert-error">{errorMessage}</div>
  {/if}
  
  {#if successMessage}
    <div class="alert alert-success">{successMessage}</div>
  {/if}

  <!-- Navigation -->
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

  <!-- Auction View -->
  {#if currentView === 'auction'}
    <div class="content-section">
      <h2>📅 {formatDate(selectedDate)} の オークション</h2>
      
      <div class="auction-section">
        <!-- Bidding Form -->
        <div>
          <h3>入札</h3>
          <div class="bid-form">
            <div class="form-group">
              <label for="price">価格（MATIC）</label>
              <input 
                id="price" 
                type="number" 
                step="0.001"
                min="0.001"
                bind:value={price} 
                placeholder="0.001"
                disabled={isLoading}
              />
            </div>
            
            <div class="form-group">
              <label for="message">メッセージ（任意）</label>
              <textarea 
                id="message" 
                bind:value={bidMessage} 
                placeholder="あなたのメッセージ..."
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

        <!-- Winner Info -->
        <div>
          <h3>現在の勝者</h3>
          {#if winner}
            <div class="winner-info">
              <h3>🏆 勝者</h3>
              <div class="winner-details">
                <div><strong>{formatAddress(winner.wallet)}</strong></div>
                <div>💰 {winner.price} MATIC</div>
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

      <!-- Bid History -->
      <div style="margin-top: 30px;">
        <h3>入札履歴 ({history.length}件)</h3>
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
                <div><strong>{bid.price} MATIC</strong></div>
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

  <!-- Calendar View -->
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
            <div style="text-align: center; font-weight: bold; padding: 10px;">{day}</div>
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
                <div style="font-size: 10px;">{day.winner?.price}M</div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Collection View -->
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
        </div>
      {/if}
    </div>
  {/if}

  <!-- Stats View -->
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
            <div>Mint待ち</div>
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







