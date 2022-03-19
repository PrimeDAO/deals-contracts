const { ethers, deployments } = require("hardhat");
const tokens = require("../helpers/tokens.js");

const setupFixture = deployments.createFixture(
  async ({ deployments }, options) => {
    const { deploy } = deployments;
    const { root, prime } = await ethers.getNamedSigners();

    // Set up BaseContract contract
    await deploy("BaseContract", {
      contract: "BaseContract",
      from: root.address,
      log: true,
    });

    await deploy("DepositContract", {
      contract: "DepositContract",
      from: root.address,
      log: true,
    });

    await deploy("WETH", {
      contract: "ERC20Mock",
      from: root.address,
      args: ["Wrapped Ether", "WETH"],
      logs: true,
    });

    const depositContractInstance = await ethers.getContract("DepositContract");
    const baseContractInstance = await ethers.getContract("BaseContract");
    const wethInstance = await ethers.getContract("WETH");

    await baseContractInstance.setWETHAddress(wethInstance.address);
    await baseContractInstance.setDepositContractImplementation(
      depositContractInstance.address
    );

    // Set up TokenSwapModule contract
    await deploy("TokenSwapModule", {
      contract: "TokenSwapModule",
      from: root.address,
      args: [baseContractInstance.address],
      logs: true,
    });

    const tokenSwapModuleInstance = await ethers.getContract("TokenSwapModule");
    await tokenSwapModuleInstance.setFeeWallet(prime.address);
    await tokenSwapModuleInstance.setFee(30);

    // Register TokenSwapModule in BaseContract
    await baseContractInstance.registerModule(tokenSwapModuleInstance.address);

    // Return contract instances
    const contractInstances = {
      baseContractInstance: await ethers.getContract("BaseContract"),
      tokenInstances: await tokens.getErc20TokenInstances(4, root),
      tokenSwapModuleInstance: tokenSwapModuleInstance,
      depositContractInstance: depositContractInstance,
      depositContractFactoryInstance: await ethers.getContractFactory(
        "DepositContract"
      ),
      wethInstance: wethInstance,
    };

    return { ...contractInstances };
  }
);

module.exports = {
  setupFixture,
};
