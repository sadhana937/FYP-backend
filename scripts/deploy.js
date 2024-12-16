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


}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
