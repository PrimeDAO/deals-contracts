require("dotenv").config({ path: "./.env" });
require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require("solidity-coverage");
require("hardhat-deploy");
require("hardhat-deploy-ethers");
require("@nomiclabs/hardhat-etherscan");

const { INFURA_KEY, MNEMONIC, ETHERSCAN_API_KEY, PK } = process.env;
const DEFAULT_MNEMONIC = "hello darkness my old friend";

const sharedNetworkConfig = {};
if (PK) {
  sharedNetworkConfig.accounts = [PK];
} else {
  sharedNetworkConfig.accounts = {
    mnemonic: MNEMONIC || DEFAULT_MNEMONIC,
  };
}

module.exports = {
  paths: {
    artifacts: "build/artifacts",
    cache: "build/cache",
    deploy: "deploy",
    sources: "contracts",
  },
  defaultNetwork: "hardhat",
  networks: {
    localhost: {
      ...sharedNetworkConfig,
      blockGasLimit: 100000000,
      gas: 2000000,
      saveDeployments: false,
    },
    hardhat: {
      blockGasLimit: 10000000000000,
      gas: 200000000000,
      saveDeployments: false,
      initialBaseFeePerGas: 0,
      hardfork: "london",
    },
    mainnet: {
      ...sharedNetworkConfig,
      url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
      saveDeployments: true,
    },
    rinkeby: {
      ...sharedNetworkConfig,
      url: `https://rinkeby.infura.io/v3/${INFURA_KEY}`,
      saveDeployments: true,
    },
    kovan: {
      ...sharedNetworkConfig,
      url: `https://kovan.infura.io/v3/${INFURA_KEY}`,
      saveDeployments: true,
    },
    ganache: {
      ...sharedNetworkConfig,
      url: "http://127.0.0.1:7545",
      saveDeployments: false,
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.10",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.9",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      { version: "0.6.12" },
      { version: "0.5.16" },
    ],
  },
  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY,
      rinkeby: ETHERSCAN_API_KEY,
    },
  },
  namedAccounts: {
    root: 0,
    prime: 1,
    beneficiary: 2,
  },
};
