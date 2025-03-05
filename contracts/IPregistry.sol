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
        // add license incentive i.e if a user needs to access the IP, they need to pay a certain amount
        uint256 licenseIncentive;
        string[] tags;
        OptionalFields optionalFields;
        address ownerAddress;
    }

    mapping(uint256 => IntellectualProperty) public ips;
    mapping(address => uint256[]) public ownerToIPs;
    mapping(uint256 => mapping(address => bool)) public hasAccess;
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

    event AccessGranted(
        uint256 indexed index,
        address indexed user,
        uint256 amount
    );

    event IncentivePaid(
        uint256 indexed index,
        address indexed payer,
        uint256 amount
    );

    function registerIP(
        string memory name,
        string memory description,
        string memory ipType,
        string memory dateOfCreation,
        string memory dateOfRegistration,
        string[] memory license,
        uint256 licenseIncentive,
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
            licenseIncentive: licenseIncentive,
            tags: tags,
            optionalFields: optionalFields,
            ownerAddress: msg.sender // set the owner
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

function grantAccess(uint256 index) public payable {
    // Check if the IP with the given index exists
    require(index < allIPIndexes.length, "IP does not exist");

    // Retrieve the IP details from the mapping
    IntellectualProperty storage ip = ips[index];

    // Ensure the payment sent with the transaction is at least the required license incentive
    require(msg.value >= ip.licenseIncentive, "Insufficient payment");

    // Ensure the user does not already have access to this IP
    require(!hasAccess[index][msg.sender], "Already has access");

    // Grant access to the user by updating the hasAccess mapping
    hasAccess[index][msg.sender] = true;

    // Transfer the payment to the owner of the IP
    address payable ownerAddress = payable(msg.sender); // This line should be corrected to transfer to the actual owner
    ownerAddress.transfer(msg.value);

    // Emit an event to log the access grant
    emit AccessGranted(index, msg.sender, msg.value);
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

