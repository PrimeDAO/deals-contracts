const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  constants: { ZERO_ADDRESS },
} = require("@openzeppelin/test-helpers");
const { setupFixture } = require("../helpers/setupFixture.js");

let root, baseContractMock, dao1, dao2, dao3, depositer1, depositer2;
let tokenAddresses;
let depositContractInstance,
  tokenInstances,
  wethInstance,
  baseContractInstance,
  tokenSwapModuleInstance,
  depositContractFactoryInstance;

describe("> Contract: BaseContract", () => {
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
    it("» should fail on executed not by the owner", async () => {
      await expect(
        baseContractInstance
          .connect(dao1)
          .setDepositContractImplementation(depositContractInstance.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("» should fail on parsing zero address", async () => {
      await expect(
        baseContractInstance.setDepositContractImplementation(ZERO_ADDRESS)
      ).to.be.revertedWith("BASECONTRACT-INVALID-IMPLEMENTATION-ADDRESS");
    });
    it("» should succeed on setting DepositContract", async () => {
      await baseContractInstance.setDepositContractImplementation(
        depositContractInstance.address
      );
      expect(
        await baseContractInstance.depositContractImplementation()
      ).to.equal(depositContractInstance.address);
    });
  });
  describe("$ When setting the WETH address", () => {
    it("» should fail on executed not by the owner", async () => {
      await expect(
        baseContractInstance.connect(dao1).setWETHAddress(wethInstance.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("» should fail on parsing zero address", async () => {
      await expect(
        baseContractInstance.setWETHAddress(ZERO_ADDRESS)
      ).to.be.revertedWith("BASECONTRACT-INVALID-WETH-ADDRESS");
    });
    it("» should succeed on setting the WETH address", async () => {
      await baseContractInstance.setWETHAddress(wethInstance.address);
      expect(await baseContractInstance.weth()).to.equal(wethInstance.address);
    });
  });
  describe("$ When registering a new Module", () => {
    it("» should fail on executed not by the owner", async () => {
      await expect(
        baseContractInstance
          .connect(dao1)
          .registerModule(tokenSwapModuleInstance.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("» should fail on parsing zero address", async () => {
      await expect(
        baseContractInstance.registerModule(ZERO_ADDRESS)
      ).to.be.revertedWith("BASECONTRACT-INVALID-MODULE-ADDRESS");
    });
    it("» should fail on invalid mdule setup", async () => {
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
    it("» should have succeeded on registering the module", async () => {
      expect(
        await baseContractInstance.addressIsModule(
          tokenSwapModuleInstance.address
        )
      ).to.be.true;
    });
  });
  describe("$ When deactivation a Module", () => {
    it("» should fail on executed not by the owner", async () => {
      await expect(
        baseContractInstance
          .connect(dao1)
          .deactivateModule(tokenSwapModuleInstance.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("» should fail on parsing zero address", async () => {
      await expect(
        baseContractInstance.deactivateModule(ZERO_ADDRESS)
      ).to.be.revertedWith("BASECONTRACT-INVALID-MODULE-ADDRESS");
    });
    it("» should succeed on rigister module", async () => {
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
    it("» should fail on DAO address is zero", async () => {
      await expect(
        baseContractInstance.createDepositContract(ZERO_ADDRESS)
      ).to.be.revertedWith("BASECONTRACT-INVALID-DAO-ADDRESS");
    });
    it("» should fail on Deposit contract implementation not set", async () => {
      const BaseContractFactory = await ethers.getContractFactory(
        "BaseContract"
      );
      const localBaseContractInstance = await BaseContractFactory.deploy();
      await expect(
        localBaseContractInstance.createDepositContract(dao1.address)
      ).to.be.revertedWith(
        "BASECONTRACT-DEPOSIT-CONTRACT-IMPLEMENTATION-IS-NOT-SET"
      );
    });
    it("» should fail on Deposit contract already exist for DAO", async () => {
      await baseContractInstance.setDepositContractImplementation(
        depositContractInstance.address
      );
      await baseContractInstance.createDepositContract(dao1.address);

      await expect(
        baseContractInstance.createDepositContract(dao1.address)
      ).to.be.revertedWith("BASECONTRACT-DEPOSIT-CONTRACT-ALREADY-EXISTS");
    });
    it("» should succeed in creating Deposit Contract", async () => {
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
