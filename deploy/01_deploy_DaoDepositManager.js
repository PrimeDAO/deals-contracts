const { network } = require("hardhat");
const { WETH } = require("../inputs/WETH.json");

const deployFunction = async ({ getNamedAccounts, deployments, ethers }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  await deploy("DaoDepositManager", {
    from: root,
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["DaoDepositManager"];
