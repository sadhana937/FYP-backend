// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract IPregistry {
    struct IntellectualProperty {
        uint256 id;
        string name;
        string description;
        address owner;
        uint256 creationDate;
    }

    uint256 public nextId = 0;
    mapping(uint256 => IntellectualProperty) public ips;
    mapping(address => uint256[]) public ownerToIPs;

    event IPRegistered(uint256 id, string name, address owner, uint256 creationDate);
    event OwnershipTransferred(uint256 id, address from, address to);

    function registerIP(string memory name, string memory description) public {
        uint256 id = nextId;
        ips[id] = IntellectualProperty({
            id: id,
            name: name,
            description: description,
            owner: msg.sender,
            creationDate: block.timestamp
        });

        ownerToIPs[msg.sender].push(id);
        emit IPRegistered(id, name, msg.sender, block.timestamp);
        nextId++;
    }

    function transferOwnership(uint256 id, address newOwner) public {
        require(ips[id].owner == msg.sender, "Not the owner");
        require(newOwner != address(0), "Invalid new owner");

        // Remove from current owner's list
        uint256[] storage ownedIPs = ownerToIPs[msg.sender];
        for (uint256 i = 0; i < ownedIPs.length; i++) {
            if (ownedIPs[i] == id) {
                ownedIPs[i] = ownedIPs[ownedIPs.length - 1];
                ownedIPs.pop();
                break;
            }
        }
        // update ownership
        ips[id].owner = newOwner;
        ownerToIPs[newOwner].push(id);

        emit OwnershipTransferred(id, msg.sender, newOwner);
    }

    // function getIPsByOwner(address owner) public view returns (uint256[] memory) {
    //     return ownerToIPs[owner];
    // }

    function getIPDetails(uint256 id) public view returns (IntellectualProperty memory) {
        return ips[id];
    }

     function isRegistered(uint256 id) public view returns (bool) {
        return ips[id].owner != address(0);
    }

    function getTotalIPs() public view returns (uint256) {
        return nextId;
    }

}
