const hre = require("hardhat");
const fs = require('fs');

async function main() {
  // Get the deployer's address (the first signer from the wallet)
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // Get the ContractFactory for the IPRegistry contract
  const IPRegistry = await hre.ethers.getContractFactory("IPregistry");
    // console.log(IPRegistry);
  // Deploy the contract
  const ipRegistry = await IPRegistry.deploy();

  // Wait for the contract to be mined
  await ipRegistry.deployed();

  // Log the deployed contract address
  console.log("IPRegistry contract deployed to:", ipRegistry.address);

   // Save the deployed contract address to a JSON file
    const address = {
        contractAddress: ipRegistry.address,
    };
    fs.writeFileSync("deployments.json", JSON.stringify(address, null, 2));

//    // Register a new IP
//     console.log("Registering a new IP...");
//     const tx = await ipRegistry.registerIP("My second IP", "This is the second test IP description");
//     await tx.wait(); // Wait for the transaction to be mined
//     console.log("IP registered!");

//   // get all the registered IPs
//   const registeredIds = await ipRegistry.getIPsByOwner(deployer.address);
//     console.log("Registered IP IDs:", registeredIds);

//         // Fetch details of the first registered IP
//     if (registeredIds.length > 0) {
//         const ipDetails = await ipRegistry.getIPDetails(registeredIds[0]);
//         console.log("Details of the first registered IP:", ipDetails);
//     }


}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
