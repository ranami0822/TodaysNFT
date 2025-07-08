//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TodaysNFT is ERC721URIStorage, Ownable {
    uint256 public tokenCounter;
    mapping (address => bool) public pendingWinners;

    function setPendingWinner(address _address) public onlyOwner {
        pendingWinners[_address] = true;
    }

    constructor() ERC721("TodaysNFT", "TDN") {
        tokenCounter = 0;
    }

    function mintNFT(string memory tokenURI) public returns (uint256) {
        // pendingWinners チェックを有効化する場合はコメントアウトを外す
        // require(pendingWinners[msg.sender], "You are not a winner");

        uint256 newItemId = tokenCounter;
        _safeMint(msg.sender, newItemId);
        _setTokenURI(newItemId, tokenURI);
        tokenCounter += 1;

        // pendingWinners チェックを有効化した場合は、mint後にfalseにする
        // pendingWinners[msg.sender] = false;

        return newItemId;
    }
}