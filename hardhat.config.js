require("@nomiclabs/hardhat-ethers");
require("dotenv").config();


module.exports = {
    solidity: {
        compilers: [
      {
        version: "0.8.20",
      },
      {
        version: "0.8.0",
      },
    ],
    },
    networks: {
        fuji: {
            url: process.env.INFURA_URL,
            accounts: [`0x${process.env.PRIVATE_KEY}`] // Add your private key
        }
    }
};
