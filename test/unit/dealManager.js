const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  constants: { ZERO_ADDRESS },
} = require("@openzeppelin/test-helpers");
const { setupFixture } = require("../helpers/setupFixture.js");

let root, baseContractMock, dao1, dao2, dao3, depositer1, depositer2;
let tokenAddresses;
let daoDepositManagerInstance,
  tokenInstances,
  wethInstance,
  dealManagerInstance,
  tokenSwapModuleInstance,
  daoDepositManagerFactoryInstance;

describe("> Contract: DealManager", () => {
  before(async () => {
    const signers = await ethers.getSigners();
    [root, baseContractMock, dao1, dao2, dao3, depositer1, depositer2] =
      signers;
  });

  beforeEach(async () => {
    contractInstances = await setupFixture();
    ({
      daoDepositManagerInstance,
      dealManagerInstance,
      tokenInstances,
      Instance,
      tokenSwapModuleInstance,
      daoDepositManagerFactoryInstance,
      wethInstance,
    } = contractInstances);

    tokenAddresses = tokenInstances.map((token) => token.address);
  });
  describe("$ When deploying the DealManager", () => {
    it("» should fail on Dao Deposit Manager zero address", async () => {
      const deployArgs = [ZERO_ADDRESS, wethInstance.address];
      const DealManagerFactory = await ethers.getContractFactory("DealManager");
      await expect(DealManagerFactory.deploy(...deployArgs)).to.be.revertedWith(
        "DealManager: Error 100"
      );
    });
    it("» should fail on weth zero address", async () => {
      const deployArgs = [daoDepositManagerInstance.address, ZERO_ADDRESS];
      const DealManagerFactory = await ethers.getContractFactory("DealManager");
      await expect(DealManagerFactory.deploy(...deployArgs)).to.be.revertedWith(
        "DealManager: Error 100"
      );
    });
  });
  describe("$ When setting the DaoDepositManager", () => {
    it("» should fail on executed not by the owner", async () => {
      await expect(
        dealManagerInstance
          .connect(dao1)
          .setDaoDepositManagerImplementation(daoDepositManagerInstance.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("» should fail on parsing zero address", async () => {
      await expect(
        dealManagerInstance.setDaoDepositManagerImplementation(ZERO_ADDRESS)
      ).to.be.revertedWith("DealManager: Error 100");
    });
    it("» should succeed on setting DaoDepositManager", async () => {
      await dealManagerInstance.setDaoDepositManagerImplementation(
        daoDepositManagerInstance.address
      );
      expect(
        await dealManagerInstance.daoDepositManagerImplementation()
      ).to.equal(daoDepositManagerInstance.address);
    });
  });
  describe("$ When registering a new Module", () => {
    it("» should fail on executed not by the owner", async () => {
      await expect(
        dealManagerInstance
          .connect(dao1)
          .activateModule(tokenSwapModuleInstance.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("» should fail on parsing zero address", async () => {
      await expect(
        dealManagerInstance.activateModule(ZERO_ADDRESS)
      ).to.be.revertedWith("DealManager: Error 100");
    });
    it("» should fail on invalid mdule setup", async () => {
      const TokenSwapModuleFactory = await ethers.getContractFactory(
        "TokenSwapModule"
      );
      const tokenswapModuleInstance2 = await TokenSwapModuleFactory.deploy(
        wethInstance.address
      );

      await expect(
        dealManagerInstance.activateModule(tokenswapModuleInstance2.address)
      ).to.be.revertedWith("DealManager: Error 260");
    });
    it("» should have succeeded on registering the module", async () => {
      expect(
        await dealManagerInstance.addressIsModule(
          tokenSwapModuleInstance.address
        )
      ).to.be.true;
    });
  });
  describe("$ When deactivation a Module", () => {
    it("» should fail on executed not by the owner", async () => {
      await expect(
        dealManagerInstance
          .connect(dao1)
          .deactivateModule(tokenSwapModuleInstance.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("» should fail on parsing zero address", async () => {
      await expect(
        dealManagerInstance.deactivateModule(ZERO_ADDRESS)
      ).to.be.revertedWith("DealManager: Error 100");
    });
    it("» should succeed on rigister module", async () => {
      expect(
        await dealManagerInstance.addressIsModule(
          tokenSwapModuleInstance.address
        )
      ).to.be.true;

      await dealManagerInstance.deactivateModule(
        tokenSwapModuleInstance.address
      );
      expect(
        await dealManagerInstance.addressIsModule(
          tokenSwapModuleInstance.address
        )
      ).to.be.false;
    });
  });
  describe("$ When creating a Dao Deposit Manager", () => {
    it("» should fail on DAO address is zero", async () => {
      await expect(
        dealManagerInstance.createDaoDepositManager(ZERO_ADDRESS)
      ).to.be.revertedWith("DealManager: Error 100");
    });
    it("» should fail on Dao Deposit Manager already exist for DAO", async () => {
      await dealManagerInstance.setDaoDepositManagerImplementation(
        daoDepositManagerInstance.address
      );
      await dealManagerInstance.createDaoDepositManager(dao1.address);

      await expect(
        dealManagerInstance.createDaoDepositManager(dao1.address)
      ).to.be.revertedWith("DealManager: Error 001");
    });
    it("» should succeed in creating Dao Deposit Manager", async () => {
      await dealManagerInstance.setDaoDepositManagerImplementation(
        daoDepositManagerInstance.address
      );
      await expect(
        dealManagerInstance.createDaoDepositManager(dao1.address)
      ).to.emit(dealManagerInstance, "DaoDepositManagerCreated");

      expect(await dealManagerInstance.hasDaoDepositManager(dao1.address)).to.be
        .true;

      const depositContractAddress =
        await dealManagerInstance.getDaoDepositManager(dao1.address);

      const localdaoDepositManagerInstance =
        await daoDepositManagerFactoryInstance.attach(depositContractAddress);

      expect(await localdaoDepositManagerInstance.dao()).to.equal(dao1.address);
    });
  });
});
