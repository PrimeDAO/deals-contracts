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
  callCreateSwap,
} = require("../helpers/setupTokenSwapStates.js");

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
let depositContractInstance,
  depositContractInstances,
  baseContractInstance,
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

describe("> Contract: DepositContract", () => {
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
      baseContractInstance,
      tokenInstances,
      depositContractInstance,
      tokenSwapModuleInstance,
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
  describe("$ DepositContract solo", () => {
    describe("# When initializing with invalid parameters", () => {
      it("» should fail on invalid DAO address", async () => {
        await expect(
          depositContractInstance.initialize(ZERO_ADDRESS)
        ).to.be.revertedWith("D2D-DEPOSIT-INVALID-DAO-ADDRESS");
      });
    });
    describe("# When initializing again", () => {
      it("» should fail on initializing twice", async () => {
        await depositContractInstance.initialize(dao1.address);
        await expect(
          depositContractInstance.initialize(dao1.address)
        ).to.be.revertedWith("D2D-DEPOSIT-ALREADY-INITIALIZED");
      });
    });
  });
  // describe("$ DepositContract through TokenSwapModule (end-to-end)", () => {
  //   describe("# single deposit ", async () => {
  //     beforeEach(async () => {
  //       depositContractInstances = await callCreateSwap(
  //         baseContractInstance,
  //         tokenSwapModuleInstance,
  //         deal1Parameters
  //       );
  //     });
  //     it("» should fail on token address being ZERO and amount 0", async () => {});
  //     it("» should fail on token not being ZERO and amount being 0", async () => {});
  //     it("» should succeed in depositing token", async () => {});
  //     it("» should succeed in depositing WETH", async () => {});
  //   });
  //   describe("# multiple deposits ", async () => {
  //     beforeEach(async () => {
  //       depositContractInstances = await callCreateSwap(
  //         baseContractInstance,
  //         tokenSwapModuleInstance,
  //         deal1Parameters
  //       );
  //     });
  //     it("» should fail arrays mismatch", async () => {});
  //     it("» should succeed on depositing tokens", async () => {});
  //   });
  //   describe("# withdraw ", async () => {
  //     beforeEach(async () => {});
  //   });
  //   it("» should fail on using an invalid ID", async () => {});
  //   it("» should succeed in depositing token", async () => {});
  //   describe("# multiple deposits ", async () => {
  //     beforeEach(async () => {});
  //   });
  // });
});
