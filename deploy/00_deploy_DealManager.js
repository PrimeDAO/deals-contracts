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

  const depositContractInstance = await ethers.getContract("DaoDepositManager");

  await deploy("DealManager", {
    from: root,
    log: true,
  });

  const dealManagerInstance = await ethers.getContract("DealManager");

  await dealManagerInstance.setDaoDepositManagerImplementation(
    depositContractInstance.address
  );

  await dealManagerInstance.setWETHAddress(WETHAddress);
};

module.exports = deployFunction;
module.exports.tags = ["DealManager"];
