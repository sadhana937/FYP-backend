// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract IPregistry {
    struct OwnerDetails {
        string name;
        string email;
        string physicalAddress;
    }

    struct OptionalFields {
        string workType;
        string classOfGoods;
        string[] inventors;
        string domainName;
        string publicationDate;
    }

    struct IntellectualProperty {
        uint256 index;
        string name;
        string description;
        OwnerDetails owner;
        string ipType;
        string dateOfCreation;
        string dateOfRegistration;
        string[] license;
        string[] tags;
        OptionalFields optionalFields;
    }

    mapping(uint256 => IntellectualProperty) public ips;
    mapping(address => uint256[]) public ownerToIPs;
    uint256[] private allIPIndexes;

    event IPRegistered(
        uint256 indexed index,
        string name,
        address indexed owner,
        string dateOfRegistration
    );
    event OwnershipTransferred(
        uint256 indexed index,
        address indexed from,
        address indexed to
    );

    function registerIP(
        string memory name,
        string memory description,
        string memory ipType,
        string memory dateOfCreation,
        string memory dateOfRegistration,
        string[] memory license,
        string[] memory tags,
        OwnerDetails memory ownerDetails,
        OptionalFields memory optionalFields
    ) public {
        uint256 newIndex = allIPIndexes.length;

        ips[newIndex] = IntellectualProperty({
            index: newIndex,
            name: name,
            description: description,
            owner: ownerDetails,
            ipType: ipType,
            dateOfCreation: dateOfCreation,
            dateOfRegistration: dateOfRegistration,
            license: license,
            tags: tags,
            optionalFields: optionalFields
        });

        ownerToIPs[msg.sender].push(newIndex);
        allIPIndexes.push(newIndex); // Add the new IP ID to the global list

        emit IPRegistered(newIndex, name, msg.sender, dateOfRegistration);
    }

    function transferOwnership(
    uint256 index,
    address newOwner,
    string memory newOwnerName,
    string memory newOwnerEmail,
    string memory newOwnerPhysicalAddress
) public {
    require(index < allIPIndexes.length, "IP does not exist");
    // require(
    //     keccak256(abi.encodePacked(ips[index].owner.name)) == keccak256(abi.encodePacked(msg.sender)),
    //     "Not the current owner"
    // );
    // require(msg.sender == ips[index].newOwner, "Not the current owner");
    require(newOwner != address(0), "Invalid new owner");

    // Remove IP from the current owner's list
    uint256[] storage ownerIPList = ownerToIPs[msg.sender];
    for (uint256 i = 0; i < ownerIPList.length; i++) {
        if (ownerIPList[i] == index) {
            ownerIPList[i] = ownerIPList[ownerIPList.length - 1];
            ownerIPList.pop();
            break;
        }
    }

    // Add IP to the new owner's list
    ownerToIPs[newOwner].push(index);

    // Update owner details in the IP registry
    ips[index].owner = OwnerDetails({
        name: newOwnerName,
        email: newOwnerEmail,
        physicalAddress: newOwnerPhysicalAddress
    });

    // Emit OwnershipTransferred event
    emit OwnershipTransferred(index, msg.sender, newOwner);
}

    function getIPDetails(uint256 index) public view returns (IntellectualProperty memory) {
        require(index < allIPIndexes.length, "IP does not exist");
        return ips[index];
    }

    function getOwnerIPs(address owner) public view returns (uint256[] memory) {
        return ownerToIPs[owner];
    }

    function isRegistered(uint256 index) public view returns (bool) {
        return index < allIPIndexes.length;
    }

    function getTotalIPs() public view returns (uint256) {
        return allIPIndexes.length;
    }

    // New function: Return all registered IPs
    function getAllRegisteredIPs() public view returns (IntellectualProperty[] memory) {
        IntellectualProperty[] memory ipList = new IntellectualProperty[](allIPIndexes.length);
        for (uint256 i = 0; i < allIPIndexes.length; i++) {
            ipList[i] = ips[allIPIndexes[i]];
        }
        return ipList;
    }
}
