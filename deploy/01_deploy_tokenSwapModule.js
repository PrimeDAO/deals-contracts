const { network } = require("hardhat");
const { multisig } = require("../inputs/primeMultisig.json");

const deployFunction = async ({ getNamedAccounts, deployments, ethers }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  const baseContractInstance = await ethers.getContract("BaseContract");
  const baseFee = 30;
  const feeWallet = multisig[network.name];

  await deploy("TokenSwapModule", {
    from: root,
    args: [baseContractInstance.address],
    log: true,
  });

  const tokenSwapModuleInstance = await ethers.getContract("TokenSwapModule");

  await tokenSwapModuleInstance.setFee(baseFee);
  await tokenSwapModuleInstance.setFeeWallet(feeWallet);
};

module.exports = deployFunction;
module.exports.tags = ["TokenSwap"];
