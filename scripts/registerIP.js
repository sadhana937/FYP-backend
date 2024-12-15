const hre = require("hardhat");
const fs = require("fs");
const prompt = require("prompt-sync")();

async function registerIP() {
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

    // Take input from the console
    const name = prompt("Enter IP Name: ");
    const description = prompt("Enter IP Description: ");

    // Register IP with the provided name and description
    const tx = await ipRegistry.registerIP(name, description);

    // Wait for the transaction to be mined
    await tx.wait();
    console.log("IP registered successfully!");
}

registerIP().catch((error) => {
    console.error(error);
    process.exit(1);
});
