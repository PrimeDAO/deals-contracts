const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");
const {
  constants: { ZERO_ADDRESS },
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

    const baseContractInstance = await ethers.getContract("BaseContract");
    await deploy("TokenSwapModule", {
      contract: "TokenSwapModule",
      from: root.address,
      args: [baseContractInstance.address],
      logs: true,
    });

    const contractInstances = {
      depositContractInstance: await ethers.getContract("DepositContract"),
      baseContractInstance: baseContractInstance,
      tokenInstances: await tokens.getErc20TokenInstances(4, root),
      wethInstance: await ethers.getContract("WETH"),
      tokenSwapModuleInstance: await ethers.getContract("TokenSwapModule"),
      depositContractFactoryInstance: await ethers.getContractFactory(
        "DepositContract"
      ),
    };

    return { ...contractInstances };
  }
);

describe("> Contract: BaseContract", () => {
  let root, baseContractMock, dao1, dao2, dao3, depositer1, depositer2;
  let tokenAddresses;
  let depositContractInstance,
    tokenInstances,
    wethInstance,
    baseContractInstance,
    tokenSwapModuleInstance,
    depositContractFactoryInstance;

  before(async () => {
    const signers = await ethers.getSigners();
    [root, baseContractMock, dao1, dao2, dao3, depositer1, depositer2] =
      signers;
  });

  beforeEach(async () => {
    contractInstances = await setupFixture();
    ({
      depositContractInstance,
      baseContractInstance,
      tokenInstances,
      wethInstance,
      tokenSwapModuleInstance,
      depositContractFactoryInstance,
    } = contractInstances);

    tokenAddresses = tokenInstances.map((token) => token.address);
  });
  describe("$ When setting the DepositContract", () => {
    it("» fails on executed not by the owner", async () => {
      await expect(
        baseContractInstance
          .connect(dao1)
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
        baseContractInstance.connect(dao1).setWETHAddress(wethInstance.address)
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
        baseContractInstance
          .connect(dao1)
          .registerModule(tokenSwapModuleInstance.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("» fails on parsing zero address", async () => {
      await expect(
        baseContractInstance.registerModule(ZERO_ADDRESS)
      ).to.be.revertedWith("BASECONTRACT-INVALID-MODULE-ADDRESS");
    });
    it("» fails on invalid mdule setup", async () => {
      const TokenSwapModuleFactory = await ethers.getContractFactory(
        "TokenSwapModule"
      );
      const tokenswapModuleInstance2 = await TokenSwapModuleFactory.deploy(
        wethInstance.address
      );

      await expect(
        baseContractInstance.registerModule(tokenswapModuleInstance2.address)
      ).to.be.revertedWith("BASECONTRACT-MODULE-SETUP-INVALID");
    });
    it("» succeeds on rigister module", async () => {
      await baseContractInstance.registerModule(
        tokenSwapModuleInstance.address
      );
      expect(
        await baseContractInstance.addressIsModule(
          tokenSwapModuleInstance.address
        )
      ).to.be.true;
    });
  });
  describe("$ When deactivation a Module", () => {
    beforeEach(async () => {
      await baseContractInstance.registerModule(
        tokenSwapModuleInstance.address
      );
    });
    it("» fails on executed not by the owner", async () => {
      await expect(
        baseContractInstance
          .connect(dao1)
          .deactivateModule(tokenSwapModuleInstance.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("» fails on parsing zero address", async () => {
      await expect(
        baseContractInstance.deactivateModule(ZERO_ADDRESS)
      ).to.be.revertedWith("BASECONTRACT-INVALID-MODULE-ADDRESS");
    });
    it("» succeeds on rigister module", async () => {
      expect(
        await baseContractInstance.addressIsModule(
          tokenSwapModuleInstance.address
        )
      ).to.be.true;

      await baseContractInstance.deactivateModule(
        tokenSwapModuleInstance.address
      );
      expect(
        await baseContractInstance.addressIsModule(
          tokenSwapModuleInstance.address
        )
      ).to.be.false;
    });
  });
  describe("$ When creating a Deposit Contract", () => {
    it("» fails on DAO address is zero", async () => {
      await expect(
        baseContractInstance.createDepositContract(ZERO_ADDRESS)
      ).to.be.revertedWith("BASECONTRACT-INVALID-DAO-ADDRESS");
    });
    it("» fails on Deposit contract implementation not set", async () => {
      await expect(
        baseContractInstance.createDepositContract(dao1.address)
      ).to.be.revertedWith(
        "BASECONTRACT-DEPOSIT-CONTRACT-IMPLEMENTATION-IS-NOT-SET"
      );
    });
    it("» fails on Deposit contract already exist for DAO", async () => {
      await baseContractInstance.setDepositContractImplementation(
        depositContractInstance.address
      );
      await baseContractInstance.createDepositContract(dao1.address);

      await expect(
        baseContractInstance.createDepositContract(dao1.address)
      ).to.be.revertedWith("BASECONTRACT-DEPOSIT-CONTRACT-ALREADY-EXISTS");
    });
    it("» succeeds in creating Deposit Contract", async () => {
      await baseContractInstance.setDepositContractImplementation(
        depositContractInstance.address
      );
      await expect(
        baseContractInstance.createDepositContract(dao1.address)
      ).to.emit(baseContractInstance, "DepositContractCreated");

      expect(await baseContractInstance.hasDepositContract(dao1.address)).to.be
        .true;

      const depositContractAddress =
        await baseContractInstance.getDepositContract(dao1.address);

      const localDepositContractInstance =
        await depositContractFactoryInstance.attach(depositContractAddress);

      expect(await localDepositContractInstance.dao()).to.equal(dao1.address);
    });
  });
});
