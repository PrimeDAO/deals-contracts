const { network } = require("hardhat");
const { WETH } = require("../inputs/WETH.json");

const deployFunction = async ({ getNamedAccounts, deployments, ethers }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  const WETHAddress = WETH[network.name];

  await deploy("DepositContract", {
    from: root,
    log: true,
  });

  const depositContractInstance = await ethers.getContract("DepositContract");

  await deploy("BaseContract", {
    from: root,
    log: true,
  });

  const baseContractInstance = await ethers.getContract("BaseContract");

  await baseContractInstance.setDepositContractImplementation(
    depositContractInstance.address
  );

  await baseContractInstance.setWETHAddress(WETHAddress);
};

module.exports = deployFunction;
module.exports.tags = ["BaseContract"];
