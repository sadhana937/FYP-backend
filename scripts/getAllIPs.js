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

    const allIPs = [];
        for (let i = 0; i < totalIPs; i++) {
            const ipDetails = await ipRegistry.getIPDetails(i);
            allIPs.push({
                id: ipDetails.id.toString(),
                name: ipDetails.name,
                description: ipDetails.description,
                owner: ipDetails.owner,
                creationDate: new Date(ipDetails.creationDate * 1000).toLocaleString(),
            });
        }
        console.log(allIPs);

        return allIPs;
        
    }

    // Function call
    getAllIPs().catch((error) => {
    console.error(error);
    process.exit(1);
    });

// Export the function
module.exports = getAllIPs;

