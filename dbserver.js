require("dotenv").config();
const express = require("express");
const { ethers } = require("ethers");
const natural = require("natural"); // For text tokenization
const cosineSimilarity = require("cosine-similarity"); 
const mongoose = require("mongoose"); // Mongoose for MongoDB connection
const IntellectualProperty = require("./models/IntellectualProperty"); // Import the IntellectualProperty model
const IPAccess = require("./models/IPAccess");
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
    const TfIdf = natural.TfIdf;
    const tfidf = new TfIdf();

    // Clean and normalize
    const cleaned1 = description1.toLowerCase();
    const cleaned2 = description2.toLowerCase();

    tfidf.addDocument(cleaned1); // ✅ Add raw cleaned text
    tfidf.addDocument(cleaned2);

    const vector1 = tfidf.listTerms(0);
    const vector2 = tfidf.listTerms(1);

    const vector1Obj = {};
    vector1.forEach(term => vector1Obj[term.term] = term.tfidf);
    const vector2Obj = {};
    vector2.forEach(term => vector2Obj[term.term] = term.tfidf);

    const terms = new Set([...Object.keys(vector1Obj), ...Object.keys(vector2Obj)]);
    const vector1Arr = Array.from(terms).map(term => vector1Obj[term] || 0);
    const vector2Arr = Array.from(terms).map(term => vector2Obj[term] || 0);

    return cosineSimilarity(vector1Arr, vector2Arr);
};


// Function to check if the new description is similar to any registered IP
const checkDescriptionSimilarity = async (newDescription) => {
    const totalIPs = await contract.getTotalIPs();
    for (let i = 0; i < totalIPs - 1; i++) {
        const existingIP = await contract.getIPDetails(i);
        const existingDescription = existingIP.description;

        const similarity = calculateCosineSimilarity(newDescription, existingDescription);
        // console.log(`Similarity between new description and IP ${i}:`, similarity);
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
        const ipDetails = await contract.getIPDetails(bigNumberId);

        if (!ipDetails) {
            return { error: "IP not found" };
        }
        return {
            id: ipDetails.index.toString(), // Convert BigNumber to integer
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
            licenseIncentive: ethers.utils.formatUnits(ipDetails.licenseIncentive, 18),
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
            // console.log("IP Details from smart contract:", ipDetails);
            // console.log("ID inside searchIPByDescription:", ipDetails.index.toNumber());
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
        // console.log("request body",req.body);
    const {name, description, ipType, dateOfCreation, dateOfRegistration, license, licenseIncentive, tags,owner, optionalFields, ownerAddress } = req.body;
    if (!name || !description || !owner || !ipType || !dateOfCreation || !dateOfRegistration || !license || !licenseIncentive) {
        return res.status(400).json({ error: "All required fields must be provided" });
    }
    try {
        // Check for similarity before registering
        await checkDescriptionSimilarity(description);
        
          // Get total number of IPs as new ID
        const idBigNumber = await contract.getTotalIPs();
        const id = idBigNumber.toNumber(); // 👈 Convert to integer
        // console.log("New ID:", id);

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

        res.status(200).json({ message: "IP registered successfully"});
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
    // console.log("ID received:", id);

    const n = await contract.getTotalIPs();
    // console.log("Total IPs:", n);
    try {

    const idNum = parseInt(id);
    if (isNaN(idNum) || idNum < 0 || idNum >= parseInt(n.toString())) {
        return res.status(400).json({ error: "Invalid ID format" });
    }
    
        const ip = await getIPById(idNum);
        // console.log("IP Details after passing through smart contract:", ip);
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
    // console.log(req.body);
    // Validate the input
    if (!newOwnerAddress || !newOwnerDetails.name || !newOwnerDetails.email) {
        return res.status(400).json({ error: "ID, newOwnerAddress, and newOwnerDetails are required" });
    }

    // Check if the newOwner address is valid
    if (!ethers.utils.isAddress(newOwnerAddress)) {
        return res.status(400).json({ error: "Invalid newOwner address" });
    }

    try {

        await IntellectualProperty.findOneAndUpdate(
    { index: id },
    { owner: newOwnerDetails,
    ownerAddress: newOwnerAddress
}
);

        // Return the response with the new owner details
        res.status(200).json({ 
            message: "Ownership transferred successfully",
            // txHash: tx.hash,
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

app.post("/access-ip", async (req, res) => {
    try {
      const { id, userAddress, txHash } = req.body;
  
      if (!id || !userAddress || !txHash) {
        return res.status(400).json({ error: "Missing required fields" });
      }
  
      // Check if user already has access to this IP
      const existingAccess = await IPAccess.findOne({ userAddress, ipId: id });
      if (existingAccess) {
        return res.status(200).json({ message: "Already has access" });
      }
  
      // Save access to DB
      const newAccess = new IPAccess({
        userAddress,
        ipId: id,
        txHash,
      });
  
      await newAccess.save();
  
      res.status(200).json({ message: "Access granted and recorded" });
  
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

app.get("/licensed-ips/:userAddress", async (req, res) => {
    const { userAddress } = req.params;
  
    // Validate Ethereum address
    if (!ethers.utils.isAddress(userAddress)) {
      return res.status(400).json({ error: "Invalid Ethereum address" });
    }
    console.log("User Address:", userAddress);

    try {
      // Get access records
      const allRecords = await IPAccess.find({});
console.log("All Records:", allRecords); // Sanity check

      //const accessRecords = await IPAccess.find({ userAddress: userAddress });
      const accessRecords = await IPAccess.find({
        userAddress: new RegExp(`^${userAddress}$`, "i")
      });
      
        console.log("Access Records:", accessRecords);
      if (accessRecords.length === 0) {
        return res.status(404).json({ error: "No licensed IPs found for this user." });
      }
  
      const licensedIPs = [];
  
      for (const record of accessRecords) {
        try {
          const ipDetails = await contract.getIPDetails(record.ipId);
  
          licensedIPs.push({
            id: ipDetails.index.toNumber(),
            name: ipDetails.name,
            description: ipDetails.description,
            ipType: ipDetails.ipType,
            license: ipDetails.license,
            tags: ipDetails.tags,
            dateOfCreation: new Date(ipDetails.creationDate * 1000).toLocaleString(),
            dateOfRegistration: new Date(ipDetails.registrationDate * 1000).toLocaleString(),
            optionalFields: ipDetails.optionalFields,
            owner: ipDetails.owner,
          });
        } catch (err) {
          console.error(`Error fetching IP with id ${record.ipId}:`, err);
        }
      }
  
      res.status(200).json(licensedIPs);
    } catch (err) {
      console.error("Error fetching licensed IPs:", err);
      res.status(500).json({ error: "Failed to fetch licensed IPs" });
    }
  });


// Start the Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running at http://localhost:${PORT}`));
 