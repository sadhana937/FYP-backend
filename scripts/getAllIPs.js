const hre = require("hardhat");
const fs = require("fs");


async function getAllIPs() {
  // Get signer (the address that will interact with the contract)
    const [user] = await hre.ethers.getSigners();
    console.log("Using account:", user.address);

    // Read the deployed contract address from the JSON file
    const data = fs.readFileSync("deployments.json", "utf8");
    const contractAddress = JSON.parse(data).contractAddress;

    console.log("Using contract address:", contractAddress);

    // Get the contract instance
    const IPRegistry = await hre.ethers.getContractFactory("IPregistry");
    const ipRegistry = await IPRegistry.attach(contractAddress);

    // Get the total number of registered IPs (nextId will give us the total number of IPs)
    const totalIPs = await ipRegistry.nextId();
    console.log(`Total IPs registered: ${totalIPs}`);

    // Fetch and log the details of all registered IPs
    for (let i = 0; i < totalIPs; i++) {
        const ipDetails = await ipRegistry.getIPDetails(i);
        console.log(`IP ID: ${ipDetails.id}`);
        console.log(`Name: ${ipDetails.name}`);
        console.log(`Description: ${ipDetails.description}`);
        console.log(`Owner: ${ipDetails.owner}`);
        console.log(`Creation Date: ${new Date(ipDetails.creationDate * 1000).toLocaleString()}`);
        console.log("====================================");
    }
}

getAllIPs().catch((error) => {
    console.error(error);
    process.exit(1);
});
