const hre = require("hardhat");
const fs = require("fs");
const readline = require("readline");

// Function to get user input
function getUserInput(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => rl.question(query, (answer) => {
        rl.close();
        resolve(answer);
    }));
}


async function transferOwnership() {
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

     // Take user input for IP ID and new owner's address
        const ipId = await getUserInput("Enter the ID of the IP to transfer: ");
        const newOwner = await getUserInput("Enter the new owner's address: ");

    // Call the transferOwnership function
    const tx = await ipRegistry.transferOwnership(Number(ipId), newOwner);

    // Wait for the transaction to be mined
    await tx.wait();
    console.log(`Ownership of IP with ID ${ipId} transferred to ${newOwner} successfully!`);
}

transferOwnership().catch((error) => {
    console.error(error);
    process.exit(1);
});
