const { network } = require("hardhat");
const { WETH } = require("./inputs/WETH.json");

const deployFunction = async ({ getNamedAccounts, deployments, ethers }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  const WETHAddress = WETH[network.name];
  // WETH addresses for verifying the contract
  // Rinkeby = 0xc778417E063141139Fce010982780140Aa0cD5Ab
  // Mainnet = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2

  const daoDepositManagerInstance = await ethers.getContract(
    "DaoDepositManager"
  );

  await deploy("DealManager", {
    from: root,
    args: [daoDepositManagerInstance.address, WETHAddress],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["DealManager"];
