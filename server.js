// Import dependencies
require("dotenv").config();
const express = require("express");
const { ethers } = require("ethers");
const fs = require("fs");

// Initialize Express app
const app = express();
app.use(express.json());

// Infura/Alchemy RPC URL
const RPC_URL = process.env.INFURA_URL;
// console.log(RPC_URL);
// Private Key for Signing Transactions
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
    throw new Error("Private key is required in .env file");
}


// Load Contract ABI
const CONTRACT_ABI = JSON.parse(fs.readFileSync("./artifacts/contracts/IPRegistry.json", "utf8"));

// const CONTRACT_ABI = JSON.parse(fs.readFileSync("./IPRegistry.json", "utf8"));

let CONTRACT_ADDRESS;
try {
    const deployments = JSON.parse(fs.readFileSync("./deployments.json", "utf8"));
    CONTRACT_ADDRESS = deployments.contractAddress;
} catch (error) {
    throw new Error("Failed to read contract address from deployments.json");
}

if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address is missing in deployments.json");
}

// Initialize Ethers.js Provider and Wallet
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

// Route to Register an IP
app.post("/register-ip", async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || !description) {
            return res.status(400).json({ error: "Name and description are required" });
        }

        // Call the contract's registerIP function
        const tx = await contract.registerIP(name, description);
        await tx.wait();

        res.status(200).json({ message: "IP registered successfully", txHash: tx.hash });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to register IP" });
    }
});

// Route to Retrieve Registered IPs for an Address
app.get("/get-ips/:owner", async (req, res) => {
    try {
        const { owner } = req.params;

        if (!ethers.utils.isAddress(owner)) {
            return res.status(400).json({ error: "Invalid Ethereum address" });
        }

        // Call the contract's getIPsByOwner function
        const registeredIPs = await contract.getIPsByOwner(owner);
        res.status(200).json({ owner, registeredIPs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch registered IPs" });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
