const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");
const { parseEther, parseUnits, formatBytes32String } = ethers.utils;
const {
  constants: { ZERO_ADDRESS },
  time,
} = require("@openzeppelin/test-helpers");
const { BigNumber } = require("@ethersproject/bignumber");

const { setupFixture } = require("../helpers/setupFixture.js");
const {
  setupPathFromDeal1,
  setupPathToDeal1,
  setupPathToDeal2,
  setupPathFromDeal2,
  setupPathFromDeal3,
  setupPathToDeal3,
} = require("../helpers/setupPaths.js");
const {
  fundDepositContracts,
  initializeParameters,
  getTokenInstancesForSingleDeal,
  callCreateSwap,
  setupCreateSwapStateForSingleDeal,
  fundDepositerWithToken,
  transferTokenToDaoDepositManager,
  approveTokenForDaoDepositManager,
  approveMultipleTokensForDaoDepositSingleManager,
  fundDaoDepositManagersForSingelDeal,
} = require("../helpers/setupTokenSwapStates.js");
const { parse } = require("dotenv");

let root,
  dao1,
  dao2,
  dao3,
  dao4,
  dao5,
  daosDeal1,
  daosDeal2,
  daosDeal3,
  allDaos,
  depositer1,
  depositer2;
let tokenAddresses;
let deal1Parameters, deal2Parameters, deal3Parameters;
let daoDepositManagerDao1, daoDepositManagerDao2, daoDepositManagerDao3;
let daoDepositManagerInstance,
  daoDepositManagerFactoryInstance,
  dealManagerInstance,
  tokenSwapModuleInstance;
let tokenInstances, wethInstance;
let deadline;

const DAY = 60 * 60 * 24;
const HOUR = 60 * 60;
const VESTING_CLIFF1 = HOUR * 2;
const VESTING_CLIFF2 = HOUR * 4;
const VESTING_CLIFF3 = HOUR * 6;
const VESTING_DURATION1 = DAY;
const VESTING_DURATION2 = DAY * 2;
const VESTING_DURATION3 = DAY * 3;
const SWAP1 = 0;
const SWAP2 = 1;
const SWAP3 = 2;
const INVALID_SWAP = 20;
const METADATA1 = formatBytes32String("hello");
const METADATA2 = formatBytes32String("helloao");
const METADATA3 = formatBytes32String("helloaodfs");
const METADATAS = [METADATA1, METADATA2, METADATA3];

describe.only("> Contract: DaoDepositManager", () => {
  before(async () => {
    const signers = await ethers.getSigners();
    [root, prime, dao1, dao2, dao3, dao4, dao5, depositer1, depositer2] =
      signers;
    daosDeal1 = [dao1, dao2, dao3];
    daosDeal2 = [dao1, dao3, dao4];
    daosDeal3 = [dao4, dao2, dao5];
    allDaos = [...daosDeal1, dao4, dao5];
  });

  beforeEach(async () => {
    contractInstances = await setupFixture();
    ({
      dealManagerInstance,
      tokenInstances,
      daoDepositManagerInstance,
      tokenSwapModuleInstance,
      daoDepositManagerFactoryInstance,
    } = contractInstances);
    deadline = BigNumber.from((await time.latest()).toNumber() + DAY * 7);
    tokenAddresses = tokenInstances.map((token) => token.address);

    deal1Parameters = initializeParameters(
      [daosDeal1[0].address, daosDeal1[1].address, daosDeal1[2].address],
      [
        tokenAddresses[0],
        tokenAddresses[1],
        tokenAddresses[2],
        tokenAddresses[3],
      ],
      setupPathFromDeal1(),
      setupPathToDeal1(VESTING_CLIFF1, VESTING_DURATION1),
      METADATA1,
      deadline
    );
    deal2Parameters = initializeParameters(
      [daosDeal2[0].address, daosDeal2[1].address, daosDeal2[2].address],
      [
        tokenAddresses[4],
        tokenAddresses[5],
        tokenAddresses[6],
        tokenAddresses[7],
      ],
      setupPathFromDeal2(),
      setupPathToDeal2(VESTING_CLIFF2, VESTING_DURATION2),
      METADATA2,
      deadline
    );
    deal3Parameters = initializeParameters(
      [daosDeal3[0].address, daosDeal3[1].address, daosDeal3[2].address],
      [
        tokenAddresses[0],
        tokenAddresses[1],
        tokenAddresses[4],
        tokenAddresses[5],
      ],
      setupPathFromDeal3(),
      setupPathToDeal3(VESTING_CLIFF3, VESTING_DURATION3),
      METADATA3,
      deadline
    );
    dealParametersArray = [deal1Parameters, deal2Parameters, deal3Parameters];
  });
  describe("$ DaoDepositManager solo", () => {
    describe("# When initializing with invalid parameters", () => {
      it("» should fail on invalid DAO address", async () => {
        await expect(
          daoDepositManagerInstance.initialize(ZERO_ADDRESS)
        ).to.be.revertedWith("D2D-DEPOSIT-INVALID-DAO-ADDRESS");
      });
    });
    describe("# When initializing again", () => {
      it("» should fail on initializing twice", async () => {
        await daoDepositManagerInstance.initialize(dao1.address);
        await expect(
          daoDepositManagerInstance.initialize(dao1.address)
        ).to.be.revertedWith("D2D-DEPOSIT-ALREADY-INITIALIZED");
      });
    });
  });
  describe("$ DaoDepositManager through TokenSwapModule (end-to-end)", () => {
    describe("# single deposit ", async () => {
      beforeEach(async () => {
        const localContractInstances = {
          tokenSwapModuleInstance,
          dealManagerInstance,
          daoDepositManagerFactoryInstance,
        };
        ({ daoDepositManagerInstances } =
          await setupCreateSwapStateForSingleDeal(
            localContractInstances,
            daosDeal1,
            deal1Parameters
          ));
        [daoDepositManagerDao1, daoDepositManagerDao2, daoDepositManagerDao3] =
          daoDepositManagerInstances;
      });
      it("» should fail on token address being ZERO and msg.value = 0", async () => {
        const depositParam = [
          tokenSwapModuleInstance.address,
          SWAP1,
          ZERO_ADDRESS,
          parseEther("2"),
        ];
        await expect(
          daoDepositManagerDao1.connect(depositer1).deposit(...depositParam)
        ).to.revertedWith("D2D-DEPOSIT-INVALID-ETH-VALUE");
      });
      it("» should fail on token address being ZERO and amount = 0", async () => {
        const depositParam = [
          tokenSwapModuleInstance.address,
          SWAP1,
          ZERO_ADDRESS,
          0,
        ];
        await expect(
          daoDepositManagerDao1.connect(depositer1).deposit(...depositParam)
        ).to.revertedWith("D2D-DEPOSIT-INVALID-AMOUNT");
      });
      it("» should fail on token not being ZERO and amount = 0", async () => {
        const depositParam = [
          tokenSwapModuleInstance.address,
          SWAP1,
          deal1Parameters[1][0],
          0,
        ];
        await expect(
          daoDepositManagerDao1.connect(depositer1).deposit(...depositParam)
        ).to.revertedWith("D2D-DEPOSIT-INVALID-AMOUNT");
      });
      it("» should succeed in depositing token", async () => {
        const token = tokenInstances[0];
        const fundDepositerAmount = parseEther("4");
        const depositAmount = parseEther("2");
        const depositParam = [
          tokenSwapModuleInstance.address,
          SWAP1,
          token.address,
          depositAmount,
        ];
        await fundDepositerWithToken(token, depositer1, fundDepositerAmount);
        await approveTokenForDaoDepositManager(
          token,
          depositer1,
          daoDepositManagerDao1,
          depositAmount
        );

        await expect(
          daoDepositManagerDao1.connect(depositer1).deposit(...depositParam)
        )
          .to.emit(daoDepositManagerDao1, "Deposited")
          .withArgs(
            tokenSwapModuleInstance.address,
            SWAP1,
            depositer1.address,
            0,
            token.address,
            depositAmount
          );
      });
      it("» should succeed in depositing ETH", async () => {
        const token = ZERO_ADDRESS;
        const amount = parseEther("2");
        const depositParam = [
          tokenSwapModuleInstance.address,
          SWAP1,
          ZERO_ADDRESS,
          amount,
        ];

        await expect(
          daoDepositManagerDao1
            .connect(depositer1)
            .deposit(...depositParam, { value: amount })
        )
          .to.emit(daoDepositManagerDao1, "Deposited")
          .withArgs(
            tokenSwapModuleInstance.address,
            SWAP1,
            depositer1.address,
            0,
            token,
            amount
          );
      });
    });
    describe("# multiple deposits ", async () => {
      beforeEach(async () => {
        const localContractInstances = {
          tokenSwapModuleInstance,
          dealManagerInstance,
          daoDepositManagerFactoryInstance,
        };
        ({ daoDepositManagerInstances } =
          await setupCreateSwapStateForSingleDeal(
            localContractInstances,
            daosDeal1,
            deal1Parameters
          ));
      });
      it("» should fail arrays mismatch", async () => {
        // ToDo
      });
      it("» should succeed on depositing multiple tokens", async () => {
        const token1 = tokenInstances[0];
        const token2 = tokenInstances[1];
        const token3 = tokenInstances[2];
        const fundDepositerAmount1 = parseEther("4");
        const fundDepositerAmount2 = parseEther("6");
        const fundDepositerAmount3 = parseEther("8");
        const depositAmount1 = parseEther("2");
        const depositAmount2 = parseEther("4");
        const depositAmount3 = parseEther("6");
        const tokensList = [token1, token2, token3];
        const tokenListAddresses = tokensList.map((token) => token.address);
        const depositAmountList = [
          depositAmount1,
          depositAmount2,
          depositAmount3,
        ];
        const depositorList = [depositer1, depositer1, depositer1];
        const depositParam = [
          tokenSwapModuleInstance.address,
          SWAP1,
          tokenListAddresses,
          depositAmountList,
        ];
        await fundDepositerWithToken(token1, depositer1, fundDepositerAmount1);
        await fundDepositerWithToken(token2, depositer1, fundDepositerAmount2);
        await fundDepositerWithToken(token3, depositer1, fundDepositerAmount3);
        await approveMultipleTokensForDaoDepositSingleManager(
          tokensList,
          depositorList,
          depositAmountList,
          daoDepositManagerDao1
        );

        await expect(
          daoDepositManagerDao1
            .connect(depositer1)
            .multipleDeposits(...depositParam)
        ).to.emit(daoDepositManagerDao1, "Deposited");
      });
      it("» should succeed on depositing tokens and ETH", async () => {
        const token1 = tokenInstances[0];
        const token2 = tokenInstances[1];
        const token3 = ZERO_ADDRESS;
        const fundDepositerAmount1 = parseEther("4");
        const fundDepositerAmount2 = parseEther("6");
        const depositAmount1 = parseEther("2");
        const depositAmount2 = parseEther("4");
        const depositAmount3 = parseEther("6");
        const etherDeposit = parseEther("6");
        const tokenListAddresses = [token1.address, token2.address, token3];
        const depositAmountList = [
          depositAmount1,
          depositAmount2,
          depositAmount3,
        ];
        const depositParam = [
          tokenSwapModuleInstance.address,
          SWAP1,
          tokenListAddresses,
          depositAmountList,
        ];
        await fundDepositerWithToken(token1, depositer1, fundDepositerAmount1);
        await fundDepositerWithToken(token2, depositer1, fundDepositerAmount2);
        await approveMultipleTokensForDaoDepositSingleManager(
          [token1, token2],
          [depositer1, depositer1],
          [depositAmount1, depositAmount2],
          daoDepositManagerDao1
        );

        await expect(
          daoDepositManagerDao1
            .connect(depositer1)
            .multipleDeposits(...depositParam, { value: etherDeposit })
        ).to.emit(daoDepositManagerDao1, "Deposited");
      });
    });
    describe("# register deposit ", async () => {
      beforeEach(async () => {
        const localContractInstances = {
          tokenSwapModuleInstance,
          dealManagerInstance,
          daoDepositManagerFactoryInstance,
        };
        ({ daoDepositManagerInstances } =
          await setupCreateSwapStateForSingleDeal(
            localContractInstances,
            daosDeal1,
            deal1Parameters
          ));
        [daoDepositManagerDao1, daoDepositManagerDao2, daoDepositManagerDao3] =
          daoDepositManagerInstances;
      });
      it("» should succeed on registering token deposit", async () => {
        const token1 = tokenInstances[0];
        const fundDepositerAmount = parseEther("4");
        const depositAmount = parseEther("2");

        await fundDepositerWithToken(token1, depositer1, fundDepositerAmount);
        await token1
          .connect(depositer1)
          .transfer(daoDepositManagerDao1.address, depositAmount);

        const depositParam = [
          tokenSwapModuleInstance.address,
          SWAP1,
          token1.address,
        ];
        await expect(daoDepositManagerDao1.registerDeposit(...depositParam))
          .to.emit(daoDepositManagerDao1, "Deposited")
          .withArgs(
            tokenSwapModuleInstance.address,
            SWAP1,
            dao1.address,
            0,
            token1.address,
            depositAmount
          );
      });
      it("» should succeed on registering ETH deposit", async () => {
        const token1 = ZERO_ADDRESS;
        const depositAmount = parseEther("2");

        await depositer1.sendTransaction({
          to: daoDepositManagerDao1.address,
          value: depositAmount,
        });

        const depositParam = [tokenSwapModuleInstance.address, SWAP1, token1];
        await expect(daoDepositManagerDao1.registerDeposit(...depositParam))
          .to.emit(daoDepositManagerDao1, "Deposited")
          .withArgs(
            tokenSwapModuleInstance.address,
            SWAP1,
            dao1.address,
            0,
            token1.address,
            depositAmount
          );
      });
    });
    describe("# withdraw ", async () => {
      beforeEach(async () => {
        const localContractInstances = {
          tokenSwapModuleInstance,
          dealManagerInstance,
          daoDepositManagerFactoryInstance,
        };
        ({ daoDepositManagerInstances } =
          await setupCreateSwapStateForSingleDeal(
            localContractInstances,
            daosDeal1,
            deal1Parameters
          ));

        const tokenInstancesSubset = getTokenInstancesForSingleDeal(
          tokenInstances,
          deal1Parameters
        );

        ({ daoDepositManagerInstances } =
          await fundDaoDepositManagersForSingelDeal(
            tokenInstancesSubset,
            deal1Parameters,
            daoDepositManagerInstances,
            tokenSwapModuleInstance.address,
            SWAP1,
            depositer1
          ));

        [daoDepositManagerDao1, daoDepositManagerDao2, daoDepositManagerDao3] =
          daoDepositManagerInstances;
      });
      it("» should fail on using an invalid ID", async () => {
        const params = [tokenSwapModuleInstance.address, SWAP1, SWAP2];
        await expect(
          daoDepositManagerDao1.withdraw(...params)
        ).to.be.revertedWith("D2D-DEPOSIT-INVALID-DEPOSIT-ID");
      });
      it("» should fail on invalid msg.sender", async () => {
        const params = [tokenSwapModuleInstance.address, SWAP1, SWAP1];
        await expect(
          daoDepositManagerDao1.withdraw(...params)
        ).to.be.revertedWith("D2D-WITHDRAW-NOT-AUTHORIZED");
      });
      it("» should fail on call by dao, but not expired", async () => {});
      it("» should fail on freeAmount not available", async () => {
        // Will test after execution tests have been done to copy paste setup
      });
      it("» should succeed on withdrawing", async () => {});
    });

    describe("# claimVesting ", async () => {
      beforeEach(async () => {
        const localContractInstances = {
          tokenSwapModuleInstance,
          dealManagerInstance,
          daoDepositManagerFactoryInstance,
        };

        // Use funtion s'setupExecuteSwapStateSingleDeal
      });
    });
    describe("# claimDealVesting ", async () => {
      beforeEach(async () => {});
    });
  });
});
