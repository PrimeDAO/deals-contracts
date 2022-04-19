const { network } = require("hardhat");
const { WETH } = require("../inputs/WETH.json");

const deployFunction = async ({ getNamedAccounts, deployments, ethers }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  const WETHAddress = WETH[network.name];

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
