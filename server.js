require("dotenv").config();
const express = require("express");
const { ethers } = require("ethers");
const fs = require("fs");
const bodyParser = require("body-parser");
//const getAllIPs = require("./scripts/getAllIPs");


const app = express();
app.use(express.json());
app.use(require("cors")());

const RPC_URL = process.env.INFURA_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_URL;

if (!RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
    throw new Error("Please set RPC_URL, PRIVATE_KEY, and CONTRACT_ADDRESS in .env file");
}

// // Load Contract ABI
const CONTRACT_ABI = require("./IPRegistry.json").abi;
// // const CONTRACT_ABI = JSON.parse(fs.readFileSync("./IPRegistry.json", "utf8"));

// // Initialize Provider, Wallet, and Contract
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

console.log("Contract initialized:", contract.address);

// Routes
app.post("/register-ip", async (req, res) => {
    const { name, description } = req.body;
    if (!name || !description) {
        return res.status(400).json({ error: "Name and description are required" });
    }

    try {
        
        const tx = await contract.registerIP(name, description);
        await tx.wait();
        res.status(200).json({ message: "IP registered successfully", txHash: tx.hash });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to register IP" });
    }
});

app.get("/get-all-ips", async (req, res) => {
    try {
        // const ips = await getAllIPs(); // Adjust according to your contract's method

         // Get the total number of registered IPs (nextId will give us the total number of IPs)
        const totalIPs = await contract.nextId();
        console.log(`Total IPs registered: ${totalIPs}`);

        const allIPs = [];
            for (let i = 0; i < totalIPs; i++) {
                const ipDetails = await contract.getIPDetails(i);
                allIPs.push({
                    id: ipDetails.id.toString(),
                    name: ipDetails.name,
                    description: ipDetails.description,
                    owner: ipDetails.owner,
                    creationDate: new Date(ipDetails.creationDate * 1000).toLocaleString(),
                });
        }
        res.status(200).json(allIPs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch IPs" });
    }
});

// Start the Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running at http://localhost:${PORT}`));
