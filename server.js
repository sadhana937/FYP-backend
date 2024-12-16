require("dotenv").config();
const express = require("express");
const { ethers } = require("ethers");
const natural = require("natural"); // For text tokenization
const cosineSimilarity = require("cosine-similarity"); 
// const { v4: uuidv4 } = require('uuid');


const app = express();
app.use(express.json());
app.use(require("cors")());

const RPC_URL = process.env.INFURA_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_URL;

if (!RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
    throw new Error("Please set RPC_URL, PRIVATE_KEY, and CONTRACT_ADDRESS in .env file");
}

// Load Contract ABI
const CONTRACT_ABI = require("./IPRegistry.json").abi;

// Initialize Provider, Wallet, and Contract
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
    const totalIPs = await contract.getTotalIPs();
    for (let i = 0; i < totalIPs; i++) {
        const existingIP = await contract.getIPDetails(i);
        const existingDescription = existingIP.description;

        const similarity = calculateCosineSimilarity(newDescription, existingDescription);
        if (similarity > 0.9) { // Threshold similarity, adjust as needed
            throw new Error("A similar IP already exists");
        }
    }
};

// Function to search an IP by ID
const getIPById = async (id) => {
    try {
        const ipDetails = await contract.getIPDetails(id);
        if (!ipDetails) {
            return { error: "IP not found" };
        }
        return {
            id: ipDetails.id,
            name: ipDetails.name,
            description: ipDetails.description,
            owner: {
                name: ipDetails.owner.name,
                email: ipDetails.owner.email,
                address: ipDetails.owner.address
            },
            ipType: ipDetails.ipType,
            dateOfCreation: new Date(ipDetails.creationDate * 1000).toLocaleString(),
            dateOfRegistration: new Date(ipDetails.registrationDate * 1000).toLocaleString(),
            license: ipDetails.license,
            tags: ipDetails.tags,
            optionalFields: ipDetails.optionalFields
        };
    } catch (err) {
        console.error(err);
        return { error: "Failed to fetch IP details by ID" };
    }
};

// Function to search an IP by Description or Keyword
const searchIPByDescription = async (keyword) => {
    try {
        const totalIPs = await contract.getTotalIPs();
        const matchingIPs = [];

        for (let i = 0; i < totalIPs; i++) {
            const ipDetails = await contract.getIPDetails(i);
            const description = ipDetails.description.toLowerCase();
            
            // Check for substring match
            if (description.includes(keyword.toLowerCase())) {
                matchingIPs.push({
                    id: ipDetails.id,
                    name: ipDetails.name,
                    description: ipDetails.description,
                    owner: ipDetails.owner,
                    creationDate: new Date(ipDetails.creationDate * 1000).toLocaleString(),
                });
            }
        }
        return matchingIPs.length > 0 ? matchingIPs : { error: "No matching IPs found" };
    } catch (err) {
        console.error(err);
        return { error: "Failed to search IPs by description or keyword" };
    }
};

// Routes
// Endpoint to register an IP
app.post("/register-ip", async (req, res) => {
    const {name, description, ipType, dateOfCreation, dateOfRegistration, license, tags,ownerDetails, optionalFields } = req.body;
    if (!name || !description || !ownerDetails || !ipType || !dateOfCreation || !dateOfRegistration || !license) {
        return res.status(400).json({ error: "All required fields must be provided" });
    }

    try {
        // Check for similarity before registering
        await checkDescriptionSimilarity(description);

        // Using the total number of IPs as the new ID index
        const id = await contract.getTotalIPs();
        // const { name, email, physicalAddress } = ipData.ownerDetails;

        const tx = await contract.registerIP(
            name, 
            description, 
            ipType, 
            dateOfCreation, 
            dateOfRegistration, 
            license, 
            tags, 
            ownerDetails,
            optionalFields
        );
        await tx.wait();
        res.status(200).json({ message: "IP registered successfully", txHash: tx.hash });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to register IP" });
    }
});

// Endpoint to get all IPs
app.get("/get-all-ips", async (req, res) => {
    try {
        // Get the total number of registered IPs
        const totalIPs = await contract.getTotalIPs();
        const allIPs = [];

        for (let i = 0; i < totalIPs; i++) {
            //const id = await contract.getIPIdByIndex(i);
            const ipDetails = await contract.getIPDetails(i);
            allIPs.push({
                id: ipDetails.id,
                name: ipDetails.name,
                description: ipDetails.description,
                owner: ipDetails.owner,
                ipType: ipDetails.ipType,
                dateOfCreation: new Date(ipDetails.creationDate * 1000).toLocaleString(),
                dateOfRegistration: new Date(ipDetails.registrationDate * 1000).toLocaleString(),
                license: ipDetails.license,
                tags: ipDetails.tags,
                optionalFields: ipDetails.optionalFields
            });
        }
        res.status(200).json(allIPs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch IPs" });
    }
});

// Endpoint to search an IP by ID
app.get("/search-ip/:id", async (req, res) => {
    const { id } = req.params;
    const n = await contract.getTotalIPs();
    
    // Ensure the ID is a valid number
    if (isNaN(id) || id < 0 || id > n) {
        return res.status(400).json({ error: "Invalid ID format" });
    }

    try {
        const ip = await getIPById(id);

        // If the IP is not found, return a 404 error
        if (ip.error) {
            return res.status(404).json({ error: "IP not found" });
        }

        res.status(200).json(ip);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "An error occurred while fetching IP details" });
    }
});

// Endpoint to search an IP by Keyword
app.get("/search-ip-by-description/:keyword", async (req, res) => {
    const { keyword } = req.params;
    const result = await searchIPByDescription(keyword);
    res.status(200).json(result);
});

// Route to transfer ownership of an IP
app.post("/transfer-ownership", async (req, res) => {
    const { id, newOwnerAddress, newOwnerDetails } = req.body;

    // Validate the input
    if (!id || !newOwnerAddress || !newOwnerDetails || !newOwnerDetails.name || !newOwnerDetails.email) {
        return res.status(400).json({ error: "ID, newOwnerAddress, and newOwnerDetails are required" });
    }

    // Check if the newOwner address is valid
    if (!ethers.utils.isAddress(newOwnerAddress)) {
        return res.status(400).json({ error: "Invalid newOwner address" });
    }

    try {
        // Interact with the smart contract to transfer ownership
        const tx = await contract.transferOwnership(id, newOwnerAddress, newOwnerDetails.name, newOwnerDetails.email, newOwnerDetails.physicalAddress);

        // Wait for the transaction to be mined
        await tx.wait();

        // Return the response with the new owner details
        res.status(200).json({
            message: "Ownership transferred successfully",
            txHash: tx.hash,
            newOwner: {
                address: newOwnerAddress,
                name: newOwnerDetails.name,
                email: newOwnerDetails.email,
                physicalAddress: newOwnerDetails.physicalAddress || "Not provided"
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to transfer ownership" });
    }
});


// Start the Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running at http://localhost:${PORT}`));
