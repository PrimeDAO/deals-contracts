const { ethers, deployments } = require("hardhat");
const tokens = require("../helpers/tokens.js");

const setupFixture = deployments.createFixture(
  async ({ deployments }, options) => {
    const { deploy } = deployments;
    const { root, prime } = await ethers.getNamedSigners();

    await deploy("DaoDepositManager", {
      contract: "DaoDepositManager",
      from: root.address,
      log: true,
    });

    const daoDepositManagerInstance = await ethers.getContract(
      "DaoDepositManager"
    );

    // Set up DealManager contract
    await deploy("DealManager", {
      contract: "DealManager",
      from: root.address,
      args: [daoDepositManagerInstance.address],
      log: true,
    });

    const dealManagerInstance = await ethers.getContract("DealManager");

    // Set up TokenSwapModule contract
    await deploy("TokenSwapModule", {
      contract: "TokenSwapModule",
      from: root.address,
      args: [dealManagerInstance.address, 0],
      logs: true,
    });

    const tokenSwapModuleInstance = await ethers.getContract("TokenSwapModule");
    await tokenSwapModuleInstance.setFeeWallet(prime.address);
    await tokenSwapModuleInstance.setFee(30);

    // Register TokenSwapModule in DealManager
    await dealManagerInstance.activateModule(tokenSwapModuleInstance.address);

    // Return contract instances
    const contractInstances = {
      dealManagerInstance: await ethers.getContract("DealManager"),
      tokenInstances: await tokens.getErc20TokenInstances(10, root),
      tokenSwapModuleInstance: tokenSwapModuleInstance,
      daoDepositManagerInstance: daoDepositManagerInstance,
      daoDepositManagerFactoryInstance: await ethers.getContractFactory(
        "DaoDepositManager"
      ),
    };

    return { ...contractInstances };
  }
);

module.exports = {
  setupFixture,
};
