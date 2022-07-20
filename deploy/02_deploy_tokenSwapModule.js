const { network } = require("hardhat");
const { multisig } = require("./inputs/primeMultisig.json");

const deployFunction = async ({ getNamedAccounts, deployments, ethers }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  const dealMangerInstance = await ethers.getContract("DealManager");
  const baseFee = 30;
  const feeWallet = multisig[network.name];

  await deploy("TokenSwapModule", {
    from: root,
    args: [dealMangerInstance.address, 0],
    log: true,
  });

  const tokenSwapModuleInstance = await ethers.getContract("TokenSwapModule");

  const feeTx = await tokenSwapModuleInstance.setFee(baseFee);
  console.log(
    `Setting ${baseFee} as fee in basepoints for TokenSwapModule address: ${tokenSwapModuleInstance.address} with tx: ${feeTx.hash}` +
      "\n"
  );
  await feeTx.wait();
  const setWalletTx = await tokenSwapModuleInstance.setFeeWallet(feeWallet);
  console.log(
    `Setting fee wallet with address: ${feeWallet} for TokenSwapModule address: ${tokenSwapModuleInstance.address} with tx: ${setWalletTx.hash}`
  );
  await setWalletTx.wait();
};

module.exports = deployFunction;
module.exports.tags = ["TokenSwapModule"];
