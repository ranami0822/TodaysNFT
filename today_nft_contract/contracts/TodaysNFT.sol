//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title TodaysNFT - Daily NFT Auction System
 * @dev A complete NFT system for daily auctions with calendar functionality
 */
contract TodaysNFT is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    
    Counters.Counter private _tokenIdCounter;
    
    // Core structures
    struct DailyNFT {
        uint256 tokenId;
        address winner;
        uint256 price;
        bool minted;
        string metadataUri;
        uint256 mintTimestamp;
        uint256 auctionEndTime;
    }
    
    struct AuctionConfig {
        uint256 startTime;      // Daily auction start time (in seconds since midnight)
        uint256 duration;       // Auction duration in seconds
        uint256 minBidIncrement; // Minimum bid increment in wei
        bool autoMintEnabled;   // Whether to auto-mint at auction end
    }
    
    // State variables
    mapping(string => DailyNFT) public dailyNFTs; // date => DailyNFT
    mapping(address => bool) public pendingWinners; // Addresses allowed to mint
    mapping(string => bool) public dateExists; // Track which dates have NFTs
    mapping(uint256 => string) public tokenIdToDate; // tokenId => date
    
    AuctionConfig public auctionConfig;
    address public treasuryWallet;
    uint256 public constant PLATFORM_FEE_PERCENTAGE = 5; // 5% platform fee
    
    // Events
    event NFTMinted(string indexed date, uint256 indexed tokenId, address indexed winner, uint256 price);
    event WinnerSet(string indexed date, address indexed winner, uint256 price);
    event AuctionConfigUpdated(uint256 startTime, uint256 duration, uint256 minBidIncrement);
    event TreasuryUpdated(address indexed newTreasury);
    event EmergencyMint(string indexed date, address indexed recipient, string metadataUri);
    
    constructor(address _treasuryWallet) ERC721("TodaysNFT", "TNFT") Ownable(msg.sender) {
        treasuryWallet = _treasuryWallet;
        
        // Default auction configuration
        auctionConfig = AuctionConfig({
            startTime: 0,           // Midnight
            duration: 86400,        // 24 hours
            minBidIncrement: 0.001 ether,
            autoMintEnabled: true
        });
    }
    
    // =============================================================================
    // CORE NFT FUNCTIONS
    // =============================================================================
    
    /**
     * @dev Mint NFT to auction winner
     * @param date The date string (YYYY-MM-DD format)
     * @param winner The winner's address
     * @param metadataUri IPFS URI for metadata
     */
    function mintToWinner(string memory date, address winner, string memory metadataUri) 
        external 
        payable 
        nonReentrant 
    {
        require(bytes(date).length > 0, "Date cannot be empty");
        require(winner != address(0), "Winner cannot be zero address");
        require(!dateExists[date], "NFT for this date already exists");
        require(pendingWinners[winner] || msg.sender == owner(), "Winner not authorized");
        require(msg.value > 0, "Payment must be greater than 0");
        
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();
        
        // Mint the NFT
        _mint(winner, tokenId);
        _setTokenURI(tokenId, metadataUri);
        
        // Record the daily NFT
        dailyNFTs[date] = DailyNFT({
            tokenId: tokenId,
            winner: winner,
            price: msg.value,
            minted: true,
            metadataUri: metadataUri,
            mintTimestamp: block.timestamp,
            auctionEndTime: block.timestamp
        });
        
        dateExists[date] = true;
        tokenIdToDate[tokenId] = date;
        
        // Remove from pending winners
        if (pendingWinners[winner]) {
            pendingWinners[winner] = false;
        }
        
        // Handle payments
        _handlePayment(msg.value);
        
        emit NFTMinted(date, tokenId, winner, msg.value);
    }
    
    /**
     * @dev Emergency mint function for admin
     */
    function emergencyMint(string memory date, address recipient, string memory metadataUri) 
        external 
        onlyOwner 
        nonReentrant 
    {
        require(!dateExists[date], "NFT for this date already exists");
        require(recipient != address(0), "Recipient cannot be zero address");
        
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();
        
        _mint(recipient, tokenId);
        _setTokenURI(tokenId, metadataUri);
        
        dailyNFTs[date] = DailyNFT({
            tokenId: tokenId,
            winner: recipient,
            price: 0,
            minted: true,
            metadataUri: metadataUri,
            mintTimestamp: block.timestamp,
            auctionEndTime: block.timestamp
        });
        
        dateExists[date] = true;
        tokenIdToDate[tokenId] = date;
        
        emit EmergencyMint(date, recipient, metadataUri);
    }
    
    // =============================================================================
    // AUCTION MANAGEMENT
    // =============================================================================
    
    /**
     * @dev Set pending winner for a specific date
     */
    function setPendingWinner(address winner) external onlyOwner {
        require(winner != address(0), "Winner cannot be zero address");
        pendingWinners[winner] = true;
    }
    
    /**
     * @dev Remove pending winner authorization
     */
    function removePendingWinner(address winner) external onlyOwner {
        pendingWinners[winner] = false;
    }
    
    /**
     * @dev Batch set multiple pending winners
     */
    function setPendingWinners(address[] calldata winners) external onlyOwner {
        for (uint256 i = 0; i < winners.length; i++) {
            require(winners[i] != address(0), "Winner cannot be zero address");
            pendingWinners[winners[i]] = true;
        }
    }
    
    /**
     * @dev Set winner and price for a date (for record keeping)
     */
    function setWinnerForDate(string memory date, address winner, uint256 price) 
        external 
        onlyOwner 
    {
        require(!dateExists[date], "NFT for this date already exists");
        require(winner != address(0), "Winner cannot be zero address");
        
        dailyNFTs[date] = DailyNFT({
            tokenId: 0,
            winner: winner,
            price: price,
            minted: false,
            metadataUri: "",
            mintTimestamp: 0,
            auctionEndTime: block.timestamp
        });
        
        pendingWinners[winner] = true;
        emit WinnerSet(date, winner, price);
    }
    
    // =============================================================================
    // CONFIGURATION
    // =============================================================================
    
    /**
     * @dev Update auction configuration
     */
    function updateAuctionConfig(
        uint256 _startTime,
        uint256 _duration,
        uint256 _minBidIncrement,
        bool _autoMintEnabled
    ) external onlyOwner {
        require(_duration > 0, "Duration must be greater than 0");
        require(_startTime < 86400, "Start time must be within 24 hours");
        
        auctionConfig = AuctionConfig({
            startTime: _startTime,
            duration: _duration,
            minBidIncrement: _minBidIncrement,
            autoMintEnabled: _autoMintEnabled
        });
        
        emit AuctionConfigUpdated(_startTime, _duration, _minBidIncrement);
    }
    
    /**
     * @dev Update treasury wallet
     */
    function updateTreasuryWallet(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Treasury cannot be zero address");
        treasuryWallet = _newTreasury;
        emit TreasuryUpdated(_newTreasury);
    }
    
    // =============================================================================
    // VIEW FUNCTIONS
    // =============================================================================
    
    /**
     * @dev Check if NFT exists for a specific date
     */
    function exists(string memory date) external view returns (bool) {
        return dateExists[date];
    }
    
    /**
     * @dev Get auction information for a specific date
     */
    function getAuctionInfo(string memory date) 
        external 
        view 
        returns (DailyNFT memory) 
    {
        return dailyNFTs[date];
    }
    
    /**
     * @dev Get current token counter value
     */
    function getCurrentTokenId() external view returns (uint256) {
        return _tokenIdCounter.current();
    }
    
    /**
     * @dev Get date for a specific token ID
     */
    function getDateForToken(uint256 tokenId) external view returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return tokenIdToDate[tokenId];
    }
    
    /**
     * @dev Get all NFTs owned by an address with their dates
     */
    function getNFTsByOwner(address owner) 
        external 
        view 
        returns (uint256[] memory tokenIds, string[] memory dates) 
    {
        uint256 balance = balanceOf(owner);
        tokenIds = new uint256[](balance);
        dates = new string[](balance);
        
        uint256 count = 0;
        uint256 totalSupply = _tokenIdCounter.current();
        
        for (uint256 i = 1; i <= totalSupply && count < balance; i++) {
            if (_exists(i) && ownerOf(i) == owner) {
                tokenIds[count] = i;
                dates[count] = tokenIdToDate[i];
                count++;
            }
        }
    }
    
    /**
     * @dev Get calendar data for a month (returns which dates have NFTs)
     */
    function getMonthlyCalendar(uint256 year, uint256 month) 
        external 
        view 
        returns (bool[] memory daysWithNFTs, address[] memory winners) 
    {
        require(month >= 1 && month <= 12, "Invalid month");
        
        uint256 daysInMonth = _getDaysInMonth(year, month);
        daysWithNFTs = new bool[](daysInMonth);
        winners = new address[](daysInMonth);
        
        for (uint256 day = 1; day <= daysInMonth; day++) {
            string memory date = _formatDate(year, month, day);
            daysWithNFTs[day - 1] = dateExists[date];
            if (dateExists[date]) {
                winners[day - 1] = dailyNFTs[date].winner;
            }
        }
    }
    
    // =============================================================================
    // MARKETPLACE FUNCTIONS
    // =============================================================================
    
    /**
     * @dev Transfer NFT with platform fee (for marketplace integration)
     */
    function marketplaceTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 price
    ) external payable nonReentrant {
        require(_exists(tokenId), "Token does not exist");
        require(ownerOf(tokenId) == from, "Not token owner");
        require(to != address(0), "Cannot transfer to zero address");
        require(msg.value >= price, "Insufficient payment");
        
        // Calculate platform fee
        uint256 platformFee = (price * PLATFORM_FEE_PERCENTAGE) / 100;
        uint256 sellerAmount = price - platformFee;
        
        // Transfer NFT
        _transfer(from, to, tokenId);
        
        // Handle payments
        if (sellerAmount > 0) {
            payable(from).transfer(sellerAmount);
        }
        if (platformFee > 0) {
            payable(treasuryWallet).transfer(platformFee);
        }
        
        // Refund excess payment
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
    }
    
    // =============================================================================
    // INTERNAL FUNCTIONS
    // =============================================================================
    
    /**
     * @dev Handle payment distribution
     */
    function _handlePayment(uint256 amount) internal {
        if (amount > 0 && treasuryWallet != address(0)) {
            payable(treasuryWallet).transfer(amount);
        }
    }
    
    /**
     * @dev Get number of days in a month
     */
    function _getDaysInMonth(uint256 year, uint256 month) internal pure returns (uint256) {
        if (month == 2) {
            // Check for leap year
            if ((year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)) {
                return 29;
            } else {
                return 28;
            }
        } else if (month == 4 || month == 6 || month == 9 || month == 11) {
            return 30;
        } else {
            return 31;
        }
    }
    
    /**
     * @dev Format date as YYYY-MM-DD string
     */
    function _formatDate(uint256 year, uint256 month, uint256 day) 
        internal 
        pure 
        returns (string memory) 
    {
        return string(abi.encodePacked(
            _toString(year),
            "-",
            month < 10 ? "0" : "",
            _toString(month),
            "-",
            day < 10 ? "0" : "",
            _toString(day)
        ));
    }
    
    /**
     * @dev Convert uint256 to string
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
    
    // =============================================================================
    // OVERRIDES
    // =============================================================================
    
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
    
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
    
    // =============================================================================
    // EMERGENCY FUNCTIONS
    // =============================================================================
    
    /**
     * @dev Emergency withdrawal function
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    /**
     * @dev Pause/unpause contract functionality (if needed in future)
     */
    receive() external payable {
        // Allow contract to receive ETH
    }
}