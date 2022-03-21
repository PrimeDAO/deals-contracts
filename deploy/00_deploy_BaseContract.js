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

  await deploy("Dealmanager", {
    from: root,
    log: true,
  });

  const baseContractInstance = await ethers.getContract("Dealmanager");

  await baseContractInstance.setDaoDepositManagerImplementation(
    depositContractInstance.address
  );

  await baseContractInstance.setWETHAddress(WETHAddress);
};

module.exports = deployFunction;
module.exports.tags = ["Dealmanager"];
