require("dotenv").config();
const express = require("express");
const { ethers } = require("ethers");
const natural = require("natural"); // For text tokenization
const cosineSimilarity = require("cosine-similarity"); 
const mongoose = require("mongoose"); // Mongoose for MongoDB connection
const IntellectualProperty = require("./models/IntellectualProperty"); // Import the IntellectualProperty model
const { BigNumber } = require("ethers"); // Make sure this import exists


const app = express();
app.use(express.json());
app.use(require("cors")());

const RPC_URL = process.env.INFURA_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_URL;
const MONGODB_URI = process.env.MONGODB_URI; // MongoDB URI from .env file


if (!RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS || !MONGODB_URI) {
    throw new Error("Please set RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS, and MONGODB_URI in .env file");
}

// Load Contract ABI
const CONTRACT_ABI = require("./IPRegistry.json").abi;

// Connect to MongoDB
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => console.error("Failed to connect to MongoDB", err));


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
        const bigNumberId = BigNumber.from(id); // convert to BigNumber
        // console.log("ID inside getIPById (BigNumber):", bigNumberId);
        // console.log("ID inside getIPById:", id);
        const ipDetails = await contract.getIPDetails(bigNumberId);
        // console.log("IP Details from smart contract:", ipDetails);
//         console.log("creationDate:", ipDetails.dateOfCreation);
// console.log("typeof creationDate:", typeof ipDetails.dateOfCreation);
//         console.log("registrationDate:", ipDetails.dateOfRegistration);
// console.log("typeof registrationDate:", typeof ipDetails.dateOfRegistration);
        if (!ipDetails) {
            return { error: "IP not found" };
        }
        return {
            id: ipDetails.index.toNumber(), // Convert BigNumber to integer
            name: ipDetails.name,
            description: ipDetails.description,
            owner: {
                name: ipDetails.owner.name,
                email: ipDetails.owner.email,           
                physicalAddress: ipDetails.owner.physicalAddress
            },
            ipType: ipDetails.ipType,
            dateOfCreation: ipDetails.dateOfCreation,
            dateOfRegistration: ipDetails.dateOfRegistration,
            license: ipDetails.license,
            licenseIncentive: ipDetails.licenseIncentive.toNumber(),
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
            const bigNumberId = BigNumber.from(i); // convert to BigNumber

            const ipDetails = await contract.getIPDetails(bigNumberId);
            console.log("IP Details from smart contract:", ipDetails);
            console.log("ID inside searchIPByDescription:", ipDetails.index.toNumber());
            const description = ipDetails.description.toLowerCase();
            
            // Check for substring match
            if (description.includes(keyword.toLowerCase())) {
                matchingIPs.push({
                    id: ipDetails.index.toNumber(),
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
        // console.log(req.body);
    const {name, description, ipType, dateOfCreation, dateOfRegistration, license, licenseIncentive, tags,owner, optionalFields } = req.body;
    if (!name || !description || !owner || !ipType || !dateOfCreation || !dateOfRegistration || !license || !licenseIncentive) {
        return res.status(400).json({ error: "All required fields must be provided" });
    }

    try {
        // Check for similarity before registering
        await checkDescriptionSimilarity(description);

          // Get total number of IPs as new ID
        const idBigNumber = await contract.getTotalIPs();
        const id = idBigNumber.toNumber(); // 👈 Convert to integer
        console.log("New ID:", id);
        
        const tx = await contract.registerIP(
            name, 
            description, 
            ipType, 
            dateOfCreation, 
            dateOfRegistration, 
            license, 
            licenseIncentive,
            tags, 
            owner,
            optionalFields
        );
        const receipt = await tx.wait();
        const ownerAddress = receipt.from;

        // Save the IP to MongoDB
        const ipData = new IntellectualProperty({
            index: id,
            name,
            description,
            owner: owner,
            ipType,
            dateOfCreation,
            dateOfRegistration,
            license,
            licenseIncentive,
            tags,
            optionalFields,
            ownerAddress
        });
        await ipData.save();

        res.status(200).json({ message: "IP registered successfully", txHash: tx.hash });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to register IP" });
    }
});

// Endpoint to get all IPs from MongoDB
app.get("/get-all-ips", async (req, res) => {
    try {
        const allIPs = await IntellectualProperty.find(); // Get all IPs from MongoDB
        res.status(200).json(allIPs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch IPs" });
    }
});

// Endpoint to search an IP by ID
app.get("/search-ip/:id", async (req, res) => {
    const { id } = req.params;
    console.log("ID received:", id);

    const n = await contract.getTotalIPs();
    console.log("Total IPs:", n);
    // // Ensure the ID is a valid number
    // if (isNaN(id) || id < 0 || id > n) {
    //     return res.status(400)
    //     .json({ error: "Invalid ID format" });
    // }

    try {

    // console.log("ID inside search IP:", id);
    // Ensure the ID is a valid number
    if (isNaN(id) || id < 0 || id > n.toNumber()) {
        return res.status(400)
        .json({ error: "Invalid ID format" });
    }
        const ip = await getIPById(id);
        console.log("IP Details after passing through smart contract:", ip);
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
    console.log(req.body);
    // Validate the input
    if (!newOwnerAddress || !newOwnerDetails.name || !newOwnerDetails.email) {
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

        await IntellectualProperty.findOneAndUpdate(
    { index: id },
    { owner: newOwnerDetails }
);

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
        console.error("Error transferring ownership:", err);
        res.status(500).json({ error: "Failed to transfer ownership" });
    }
});

// Route to pay incentive and access IP
app.post("/access-ip", async (req, res) => {
    try {
    
        const { id } = req.body;
        // console.log("Received ID:", id);
        // console.log("Inside access IP:", req.body);
        // Validate the input
        // if (!incentiveAmount) {
        //     return res.status(400).json({ error: "ID and incentiveAmount are required" });
        // }

        // Convert the incentive amount to Wei
        const incentiveAmount = await contract.getLicenseIncentive(id);
        console.log("Received ID:", id);
        console.log("Incentive Amount:", incentiveAmount);
        if (!incentiveAmount) {
  return res.status(400).json({ error: "Incentive amount could not be retrieved" });
}
        const value = ethers.utils.parseEther(incentiveAmount.toString());

        // Send the transaction with the value
        const tx = await contract.grantAccess(id, { value });

        // Wait for the transaction to be mined
        await tx.wait();

        res.status(200).json({ message: "Access granted upon incentive payment", txHash: tx.hash });
    } catch (err) {
        console.error("Error accessing IP:", err);
        res.status(500).json({ error: "Failed to access IP" });
    }
});

// Endpoint to get all IPs registered by a specific owner address
app.get("/get-ips-by-owner/:ownerAddress", async (req, res) => {
    const { ownerAddress } = req.params;

    // Validate Ethereum address
    if (!ethers.utils.isAddress(ownerAddress)) {
        return res.status(400).json({ error: "Invalid Ethereum address" });
    }

    try {
        const totalIPs = await contract.getTotalIPs();
        // Console.log("Total IPs:", totalIPs.toString());
        const ownedIPs = [];

        for (let i = 0; i < totalIPs; i++) { 
            const ipDetails = await contract.getIPDetails(i);
            // console.log("IP Details:", ipDetails);
            if (ipDetails.owner &&
    ipDetails.ownerAddress && ipDetails.ownerAddress.toLowerCase() === ownerAddress.toLowerCase()) {
                ownedIPs.push({
                    id: ipDetails.index.toNumber(),
                    name: ipDetails.name,
                    description: ipDetails.description,
                    ipType: ipDetails.ipType,
                    license: ipDetails.license,
                    tags: ipDetails.tags,
                    dateOfCreation: new Date(ipDetails.creationDate * 1000).toLocaleString(),
                    dateOfRegistration: new Date(ipDetails.registrationDate * 1000).toLocaleString(),
                    optionalFields: ipDetails.optionalFields,
                    owner: ipDetails.owner
                });
            }
        }
         // console.log("Owned IPs:", ownedIPs);
        if (ownedIPs.length === 0) {
            return res.status(404).json({ error: "No IPs found for the given owner address" });
        }

        res.status(200).json(ownedIPs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch IPs by owner address" });
    }
});


// Start the Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running at http://localhost:${PORT}`));
 