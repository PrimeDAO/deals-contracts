const { ethers, deployments } = require("hardhat");
const tokens = require("../helpers/tokens.js");

const setupFixture = deployments.createFixture(
  async ({ deployments }, options) => {
    const { deploy } = deployments;
    const { root, prime } = await ethers.getNamedSigners();

    // Set up DealManager contract
    await deploy("DealManager", {
      contract: "DealManager",
      from: root.address,
      log: true,
    });

    await deploy("DaoDepositManager", {
      contract: "DaoDepositManager",
      from: root.address,
      log: true,
    });

    await deploy("WETH", {
      contract: "ERC20Mock",
      from: root.address,
      args: ["Wrapped Ether", "WETH"],
      logs: true,
    });

    const daoDepositManagerInstance = await ethers.getContract(
      "DaoDepositManager"
    );
    const dealManagerInstance = await ethers.getContract("DealManager");
    const wethInstance = await ethers.getContract("WETH");

    await dealManagerInstance.setWETHAddress(wethInstance.address);
    await dealManagerInstance.setDaoDepositManagerImplementation(
      daoDepositManagerInstance.address
    );

    // Set up TokenSwapModule contract
    await deploy("TokenSwapModule", {
      contract: "TokenSwapModule",
      from: root.address,
      args: [dealManagerInstance.address],
      logs: true,
    });

    const tokenSwapModuleInstance = await ethers.getContract("TokenSwapModule");
    await tokenSwapModuleInstance.setFeeWallet(prime.address);
    await tokenSwapModuleInstance.setFee(30);

    // Register TokenSwapModule in DealManager
    await dealManagerInstance.registerModule(tokenSwapModuleInstance.address);

    // Return contract instances
    const contractInstances = {
      dealManagerInstance: await ethers.getContract("DealManager"),
      tokenInstances: await tokens.getErc20TokenInstances(4, root),
      tokenSwapModuleInstance: tokenSwapModuleInstance,
      daoDepositManagerInstance: daoDepositManagerInstance,
      daoDepositManagerFactoryInstance: await ethers.getContractFactory(
        "DaoDepositManager"
      ),
      wethInstance: wethInstance,
    };

    return { ...contractInstances };
  }
);

module.exports = {
  setupFixture,
};
