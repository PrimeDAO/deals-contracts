const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");
const { parseEther, parseUnits } = ethers.utils;
const {
  constants: { ZERO_ADDRESS },
  time,
} = require("@openzeppelin/test-helpers");
const { BigNumber } = require("@ethersproject/bignumber");

const tokens = require("../helpers/tokens.js");

const setupFixture = deployments.createFixture(
  async ({ deployments }, options) => {
    const { deploy } = deployments;
    const { root } = await ethers.getNamedSigners();

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

    const contractInstances = {
      depositContractInstance: await ethers.getContract("DepositContract"),
      baseContractInstance: await ethers.getContract("BaseContract"),
      tokenInstances: await tokens.getErc20TokenInstances(2, root),
      wethInstance: await ethers.getContract("WETH"),
    };

    return { ...contractInstances };
  }
);

describe("> Contract: BaseContract", () => {
  let root, baseContractMock, dao, depositer1, depositer2;
  let tokenAddresses;
  let depositContractInstance,
    tokenInstances,
    wethInstance,
    baseContractInstance;

  before(async () => {
    const signers = await ethers.getSigners();
    [root, baseContractMock, dao, depositer1, depositer2] = signers;
  });

  beforeEach(async () => {
    contractInstances = await setupFixture();
    ({
      depositContractInstance,
      baseContractInstance,
      tokenInstances,
      wethInstance,
    } = contractInstances);

    tokenAddresses = tokenInstances.map((token) => token.address);
  });
  describe("$ When setting the DepositContract", () => {
    it("» fails on executed not by the owner", async () => {
      await expect(
        baseContractInstance
          .connect(dao)
          .setDepositContractImplementation(depositContractInstance.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("» fails on parsing zero address", async () => {
      await expect(
        baseContractInstance.setDepositContractImplementation(ZERO_ADDRESS)
      ).to.be.revertedWith("BASECONTRACT-INVALID-IMPLEMENTATION-ADDRESS");
    });
    it("» succeeds on setting DepositContract", async () => {
      await baseContractInstance.setDepositContractImplementation(
        depositContractInstance.address
      );
      expect(
        await baseContractInstance.depositContractImplementation()
      ).to.equal(depositContractInstance.address);
    });
  });
  describe("$ When setting the WETH address", () => {
    it("» fails on executed not by the owner", async () => {
      await expect(
        baseContractInstance.connect(dao).setWETHAddress(wethInstance.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("» fails on parsing zero address", async () => {
      await expect(
        baseContractInstance.setWETHAddress(ZERO_ADDRESS)
      ).to.be.revertedWith("BASECONTRACT-INVALID-WETH-ADDRESS");
    });
    it("» succeeds on setting the WETH address", async () => {
      await baseContractInstance.setWETHAddress(wethInstance.address);
      expect(await baseContractInstance.weth()).to.equal(wethInstance.address);
    });
  });
  describe("$ When registering a new Module", () => {
    it("» fails on executed not by the owner", async () => {
      await expect(
        baseContractInstance.connect(dao).registerModule(wethInstance.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("» fails on parsing zero address", async () => {
      await expect(
        baseContractInstance.setWETHAddress(ZERO_ADDRESS)
      ).to.be.revertedWith("BASECONTRACT-INVALID-WETH-ADDRESS");
    });
    it("» succeeds on setting the WETH address", async () => {
      await baseContractInstance.setWETHAddress(wethInstance.address);
      expect(await baseContractInstance.weth()).to.equal(wethInstance.address);
    });
  });
});
