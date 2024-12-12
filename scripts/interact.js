const hre = require("hardhat");

async function interact() {
  // Get signer (the address that will interact with the contract)
  const [user] = await hre.ethers.getSigners();
  console.log("Interacting with the contract using:", user.address);

  // Address of the deployed contract (replace with your deployed address)
  const contractAddress = "0x59f073b50519f4A47F128403c0fB024B71CcbC43";

  // Get the contract instance
  const IPRegistry = await hre.ethers.getContractFactory("IPregistry");
  // console.log(IPRegistry);
  const ipRegistry = await IPRegistry.attach(contractAddress);

  // Call the registerIP function
  const name = "New IP";
  const description = "This is a new intellectual property.";
  const tx = await ipRegistry.registerIP(name, description);

  // Wait for transaction to be mined
  await tx.wait();
  console.log("IP registered successfully!");

  // Optionally, retrieve the IP details or perform other actions
}

interact().catch((error) => {
  console.error(error);
  process.exit(1);
});
