const { network } = require("hardhat");
const { WETH } = require("../inputs/WETH.json");

const deployFunction = async ({ getNamedAccounts, deployments, ethers }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  const WETHAddress = WETH[network.name];

  await deploy("DaoDepositManager", {
    from: root,
    log: true,
  });

  const daoDepositManagerInstance = await ethers.getContract(
    "DaoDepositManager"
  );

  await deploy("DealManager", {
    from: root,
    args: [daoDepositManagerInstance.address, WETHAddress],
    log: true,
  });

  const dealManagerInstance = await ethers.getContract("DealManager");

  await dealManagerInstance.setDaoDepositManagerImplementation(
    daoDepositManagerInstance.address
  );

  await dealManagerInstance.setWETHAddress(WETHAddress);
};

module.exports = deployFunction;
module.exports.tags = ["DealManager"];
