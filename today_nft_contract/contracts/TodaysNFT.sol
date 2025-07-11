//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TodaysNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    
    // Mapping from date string to token ID
    mapping(string => uint256) public dateToTokenId;
    
    // Mapping from token ID to date string
    mapping(uint256 => string) public tokenIdToDate;
    
    // Mapping from date to auction info
    mapping(string => AuctionInfo) public auctions;
    
    struct AuctionInfo {
        address winner;
        uint256 price;
        bool minted;
        string metadataUri;
    }
    
    event AuctionCompleted(string indexed date, address indexed winner, uint256 price);
    event NFTMinted(string indexed date, uint256 indexed tokenId, address indexed winner);
    
    constructor() 
        ERC721("Today NFT", "TODAY") 
        Ownable(msg.sender) 
    {
        _nextTokenId = 1; // Start token IDs from 1
    }
    
    /**
     * @dev MATIC支払いでオークション勝者にNFTをmintする
     * @param date The date string (YYYY-MM-DD format)
     * @param winner The winner's address
     * @param metadataUri The IPFS metadata URI
     */
    function mintToWinner(
        string memory date,
        address winner,
        string memory metadataUri
    ) external payable onlyOwner {
        require(winner != address(0), "Winner cannot be zero address");
        require(msg.value > 0, "Payment must be greater than 0");
        require(dateToTokenId[date] == 0, "NFT for this date already minted");
        
        // Transfer received MATIC to contract owner
        payable(owner()).transfer(msg.value);
        
        uint256 tokenId = _nextTokenId++;
        
        // Mint NFT to winner
        _safeMint(winner, tokenId);
        _setTokenURI(tokenId, metadataUri);
        
        // Update mappings
        dateToTokenId[date] = tokenId;
        tokenIdToDate[tokenId] = date;
        
        // Store auction info
        auctions[date] = AuctionInfo({
            winner: winner,
            price: msg.value,
            minted: true,
            metadataUri: metadataUri
        });
        
        emit AuctionCompleted(date, winner, msg.value);
        emit NFTMinted(date, tokenId, winner);
    }
    
    /**
     * Emergency mint function (in case of issues with payment flow)
     * @param date The date string
     * @param winner The winner's address
     * @param metadataUri The metadata URI
     */
    function emergencyMint(
        string memory date,
        address winner,
        string memory metadataUri
    ) external onlyOwner {
        require(winner != address(0), "Winner cannot be zero address");
        require(dateToTokenId[date] == 0, "NFT for this date already minted");
        
        uint256 tokenId = _nextTokenId++;
        
        _safeMint(winner, tokenId);
        _setTokenURI(tokenId, metadataUri);
        
        dateToTokenId[date] = tokenId;
        tokenIdToDate[tokenId] = date;
        
        auctions[date] = AuctionInfo({
            winner: winner,
            price: 0, // Emergency mint without payment
            minted: true,
            metadataUri: metadataUri
        });
        
        emit NFTMinted(date, tokenId, winner);
    }
    
    /**
     * Check if NFT exists for a specific date
     */
    function exists(string memory date) external view returns (bool) {
        return dateToTokenId[date] != 0;
    }
    
    /**
     * Get auction info for a specific date
     */
    function getAuctionInfo(string memory date) external view returns (AuctionInfo memory) {
        return auctions[date];
    }
    
    /**
     * Get total number of minted NFTs
     */
    function totalSupply() external view returns (uint256) {
        return _nextTokenId - 1;
    }
    
    // Override required functions
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
}