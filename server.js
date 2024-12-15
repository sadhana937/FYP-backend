require("dotenv").config();
const express = require("express");
const { ethers } = require("ethers");
const natural = require("natural"); // For text tokenization
const cosineSimilarity = require("cosine-similarity"); 


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

// // Initialize Provider, Wallet, and Contract
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

console.log("Contract initialized:", contract.address);

// Helper function for calculating cosine similarity
const calculateCosineSimilarity = (description1, description2) => {
    // Tokenizing and cleaning descriptions
    const tokenizer = new natural.WordTokenizer();
    const tokens1 = tokenizer.tokenize(description1.toLowerCase());
    const tokens2 = tokenizer.tokenize(description2.toLowerCase());

    // Create TF-IDF Vectorizer
    const TfIdf = natural.TfIdf;
    const tfidf = new TfIdf();

    // Add both descriptions to the TF-IDF model
    tfidf.addDocument(tokens1);
    tfidf.addDocument(tokens2);

    // Get the vector representations for both descriptions
    const vector1 = tfidf.listTerms(0); // First description
    const vector2 = tfidf.listTerms(1); // Second description

    // Convert terms and their scores into a format usable for cosine similarity
    const vector1Obj = {};
    vector1.forEach(term => vector1Obj[term.term] = term.tfidf);
    const vector2Obj = {};
    vector2.forEach(term => vector2Obj[term.term] = term.tfidf);

    // Combine both vectors into a common structure
    const terms = new Set([...Object.keys(vector1Obj), ...Object.keys(vector2Obj)]);
    const vector1Arr = Array.from(terms).map(term => vector1Obj[term] || 0);
    const vector2Arr = Array.from(terms).map(term => vector2Obj[term] || 0);

    // Calculate cosine similarity
    return cosineSimilarity(vector1Arr, vector2Arr);
};

// Function to check if the new description is similar to any registered IP
const checkDescriptionSimilarity = async (newDescription) => {
    const totalIPs = await contract.nextId();
    for (let i = 0; i < totalIPs; i++) {
        const existingIP = await contract.getIPDetails(i);
        const existingDescription = existingIP.description;

        const similarity = calculateCosineSimilarity(newDescription, existingDescription);
        if (similarity > 0.9) { // Threshold similarity, adjust as needed
            throw new Error("A similar IP already exists");
        }
    }
};



// Routes
app.post("/register-ip", async (req, res) => {
    const { name, description } = req.body;
    if (!name || !description) {
        return res.status(400).json({ error: "Name and description are required" });
    }

    try {
         // Check for similarity before registering
        await checkDescriptionSimilarity(description);

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
