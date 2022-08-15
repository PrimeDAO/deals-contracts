const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseEther, formatBytes32String, formatUnits, parseBytes32String } =
  ethers.utils;
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
  initializeParameters,
  setupMultipleCreateSwapStates,
  setupExecuteSwapStateSingleDeal,
  setupFundingStateSingleDeal,
  getdaoDepositManagerFromDAOArray,
} = require("../helpers/setupTokenSwapStates.js");
const { parseUnits, joinSignature } = require("ethers/lib/utils.js");

let root,
  prime,
  dao1,
  dao2,
  dao3,
  dao4,
  dao5,
  depositer1,
  daosDeal1,
  daosDeal2,
  daosDeal3,
  allDaos,
  daoplomat1,
  daoplomat2,
  daoplomat3,
  daoplomat4,
  allDaoplomats;
let tokenAddresses, tokenInstancesSubset, allDaoplomatsAddresses;
let rewardPathTo;
let createSwapParameters, createSwapParametersArray;
let dealManagerInstance, tokenSwapModuleInstance, tokenInstances;
let deadline1, deadline2, deadline3;

const DAY = 60 * 60 * 24;
const HOUR = 60 * 60;
const MONTH = 30 * DAY;
const YEAR = 12 * MONTH;
const VESTING_CLIFF1 = HOUR * 2;
const VESTING_CLIFF2 = HOUR * 4;
const VESTING_CLIFF3 = HOUR * 6;
const VESTING_DURATION1 = DAY;
const VESTING_DURATION2 = DAY * 2;
const VESTING_DURATION3 = DAY * 3;
const SWAP1 = 1;
const SWAP2 = 2;
const SWAP3 = 3;
const INVALID_SWAP = 20;
const METADATA1 = formatBytes32String("Uad8AA2CFPaVdyxa805p");
const METADATA2 = formatBytes32String("pnthglKd0wFHOK6Bn78C");
const METADATA3 = formatBytes32String("TqoScXB3Dv79eDjsSvfh");
const EMPTY_METADATA = formatBytes32String("");
const METADATAS = [METADATA1, METADATA2, METADATA3];

describe.only("> Contract: TokenSwapModule", () => {
  before(async () => {
    const signers = await ethers.getSigners();
    [
      root,
      prime,
      dao1,
      dao2,
      dao3,
      dao4,
      dao5,
      depositer1,
      daoplomat1,
      daoplomat2,
      daoplomat3,
      daoplomat4,
    ] = signers;
    daosDeal1 = [dao1, dao2, dao3];
    daosDeal2 = [dao1, dao3, dao4];
    daosDeal3 = [dao4, dao2, dao5];
    allDaos = [...daosDeal1, dao4, dao5];
    allDaoplomats = [daoplomat1, daoplomat2, daoplomat3, daoplomat4];
  });

  beforeEach(async () => {
    contractInstances = await setupFixture();
    ({ dealManagerInstance, tokenSwapModuleInstance, tokenInstances } =
      contractInstances);

    tokenAddresses = tokenInstances.map((token) => token.address);
    deadline1 = DAY * 7;
    deadline2 = DAY * 10;
    deadline3 = DAY * 12;
    // DAOplomat Rewards
    rewardPathTo = [[2000], [10000, 30000, 40000, 20000]];
    allDaoplomatsAddresses = allDaoplomats.map(
      (daoplomat) => daoplomat.address
    );

    createSwapParameters = initializeParameters(
      [daosDeal1[0].address, daosDeal1[1].address, daosDeal1[2].address],
      [
        tokenAddresses[0],
        tokenAddresses[1],
        tokenAddresses[2],
        tokenAddresses[3],
      ],
      setupPathFromDeal1(),
      setupPathToDeal1(VESTING_CLIFF1, VESTING_DURATION1),
      allDaoplomatsAddresses,
      rewardPathTo,
      METADATA1,
      deadline1
    );
  });
  describe("$ Function: createSwap", () => {
    describe("# when initializing with invalid parameters", () => {
      it("» should fail on invalid DAO address", async () => {
        const invalidParameters = [
          [dao1.address, ZERO_ADDRESS],
          createSwapParameters[1],
          createSwapParameters[2],
          createSwapParameters[3],
          createSwapParameters[4],
          createSwapParameters[5],
          createSwapParameters[6],
          createSwapParameters[7],
        ];

        await expect(
          tokenSwapModuleInstance.createSwap(...invalidParameters)
        ).to.be.revertedWith("DealManager: Error 100");
      });
      it("» should fail on number of DAOs has to be bigger then 1", async () => {
        const invalidParameters = [
          [dao1.address],
          createSwapParameters[1],
          createSwapParameters[2],
          createSwapParameters[3],
          createSwapParameters[4],
          createSwapParameters[5],
          createSwapParameters[6],
          createSwapParameters[7],
        ];

        await expect(
          tokenSwapModuleInstance.createSwap(...invalidParameters)
        ).to.be.revertedWith("TokenSwapModule: Error 204");
      });
      it("» should fail on metadata not unique", async () => {
        await tokenSwapModuleInstance.createSwap(...createSwapParameters);

        const createSwapParameters1 = [
          [daosDeal2[0].address, daosDeal2[1].address, daosDeal2[2].address],
          createSwapParameters[1],
          createSwapParameters[2],
          createSwapParameters[3],
          createSwapParameters[4],
          createSwapParameters[5],
          METADATA2,
          createSwapParameters[7],
        ];
        await tokenSwapModuleInstance.createSwap(...createSwapParameters1);

        await expect(
          tokenSwapModuleInstance.createSwap(...createSwapParameters)
        ).to.be.revertedWith("TokenSwapModule: Error 203");
      });
      it("» should fail on metadata being empty", async () => {
        const createSwapParameters1 = [
          [daosDeal2[0].address, daosDeal2[1].address, daosDeal2[2].address],
          createSwapParameters[1],
          createSwapParameters[2],
          createSwapParameters[3],
          createSwapParameters[4],
          createSwapParameters[5],
          EMPTY_METADATA,
          createSwapParameters[7],
        ];

        await expect(
          tokenSwapModuleInstance.createSwap(...createSwapParameters1)
        ).to.be.revertedWith("TokenSwapModule: Error 101");
      });
      it("» should fail on deadline being empty", async () => {
        const createSwapParameters1 = [
          [daosDeal2[0].address, daosDeal2[1].address, daosDeal2[2].address],
          createSwapParameters[1],
          createSwapParameters[2],
          createSwapParameters[3],
          createSwapParameters[4],
          createSwapParameters[5],
          createSwapParameters[6],
          0,
        ];

        await expect(
          tokenSwapModuleInstance.createSwap(...createSwapParameters1)
        ).to.be.revertedWith("TokenSwapModule: Error 101");
      });
      it("» should fail on number of tokens is 0", async () => {
        const invalidParameters = [
          createSwapParameters[0],
          [],
          createSwapParameters[2],
          createSwapParameters[3],
          createSwapParameters[4],
          createSwapParameters[5],
          createSwapParameters[6],
          createSwapParameters[7],
        ];

        await expect(
          tokenSwapModuleInstance.createSwap(...invalidParameters)
        ).to.be.revertedWith("TokenSwapModule: Error 205");
      });
      it("» should fail on dubplicates in token", async () => {
        const invalidParameters = [
          createSwapParameters[0],
          [
            tokenAddresses[0],
            tokenAddresses[1],
            tokenAddresses[1],
            tokenAddresses[3],
          ],
          createSwapParameters[2],
          createSwapParameters[3],
          createSwapParameters[4],
          createSwapParameters[5],
          createSwapParameters[6],
          createSwapParameters[7],
        ];

        await expect(
          tokenSwapModuleInstance.createSwap(...invalidParameters)
        ).to.be.revertedWith("TokenSwapModule: Error 104");
      });
      it("» should fail on number of daoplomat > 8", async () => {
        const invalidNumberOfDaoplomats = [
          ...daosDeal1,
          ...daosDeal2,
          ...daosDeal3,
        ].map((daoplomat) => daoplomat.address);
        const invalidParameters = [
          createSwapParameters[0],
          createSwapParameters[1],
          createSwapParameters[2],
          createSwapParameters[3],
          invalidNumberOfDaoplomats,
          createSwapParameters[5],
          createSwapParameters[6],
          createSwapParameters[7],
        ];

        await expect(
          tokenSwapModuleInstance.createSwap(...invalidParameters)
        ).to.be.revertedWith("TokenSwapModule: Error 267");
      });
      it("» should fail on daoplomat reward array mismatch", async () => {
        const invalidRewardPathTo = [[100], [5000, 5000]];
        const invalidParameters = [
          createSwapParameters[0],
          createSwapParameters[1],
          createSwapParameters[2],
          createSwapParameters[3],
          createSwapParameters[4],
          invalidRewardPathTo,
          createSwapParameters[6],
          createSwapParameters[7],
        ];

        await expect(
          tokenSwapModuleInstance.createSwap(...invalidParameters)
        ).to.be.revertedWith("TokenSwapModule: Error 102");
      });
      it("» should fail on daoplomat reward to small", async () => {
        const invalidRewardPathTo = [
          [parseUnits("0.0001")],
          [1000, 3000, 4000, 2000],
        ];
        const invalidParameters = [
          createSwapParameters[0],
          createSwapParameters[1],
          createSwapParameters[2],
          createSwapParameters[3],
          createSwapParameters[4],
          invalidRewardPathTo,
          createSwapParameters[6],
          createSwapParameters[7],
        ];

        await expect(
          tokenSwapModuleInstance.createSwap(...invalidParameters)
        ).to.be.revertedWith("TokenSwapModule: Error 268");
      });
      it("» should fail on daoplomats array not empty", async () => {
        const validRewardParameter = [[0], []];
        const invalidParameters = [
          createSwapParameters[0],
          createSwapParameters[1],
          createSwapParameters[2],
          createSwapParameters[3],
          createSwapParameters[4],
          validRewardParameter,
          createSwapParameters[6],
          createSwapParameters[7],
        ];

        await expect(
          tokenSwapModuleInstance.createSwap(...invalidParameters)
        ).to.be.revertedWith("TokenSwapModule: Error 102");
      });
      it("» should fail on daoplomat reward to big", async () => {
        const invalidRewardPathTo = [[5001], [1000, 3000, 4000, 2000]];
        const invalidParameters = [
          createSwapParameters[0],
          createSwapParameters[1],
          createSwapParameters[2],
          createSwapParameters[3],
          createSwapParameters[4],
          invalidRewardPathTo,
          createSwapParameters[6],
          createSwapParameters[7],
        ];

        await expect(
          tokenSwapModuleInstance.createSwap(...invalidParameters)
        ).to.be.revertedWith("TokenSwapModule: Error 268");
      });
      it("» should fail on combined reward > 100%", async () => {
        const invalidRewardPathTo = [[500], [2000, 3000, 4000, 2000]];
        const invalidParameters = [
          createSwapParameters[0],
          createSwapParameters[1],
          createSwapParameters[2],
          createSwapParameters[3],
          createSwapParameters[4],
          invalidRewardPathTo,
          createSwapParameters[6],
          createSwapParameters[7],
        ];

        await expect(
          tokenSwapModuleInstance.createSwap(...invalidParameters)
        ).to.be.revertedWith("TokenSwapModule: Error 103");
      });
      it("» should fail on combined reward > 100%", async () => {
        const invalidRewardPathTo = [
          [100, 100],
          [1000, 3000, 4000, 2000],
        ];
        const invalidParameters = [
          createSwapParameters[0],
          createSwapParameters[1],
          createSwapParameters[2],
          createSwapParameters[3],
          createSwapParameters[4],
          invalidRewardPathTo,
          createSwapParameters[6],
          createSwapParameters[7],
        ];

        await expect(
          tokenSwapModuleInstance.createSwap(...invalidParameters)
        ).to.be.revertedWith("TokenSwapModule: Error 105");
      });
      it("» should fail on input array lengths don't match", async () => {
        const mismatchLengthTokensAndPathFrom = [
          createSwapParameters[0],
          createSwapParameters[1],
          [...createSwapParameters[2], [0, 0, 0, 0]],
          createSwapParameters[3],
          createSwapParameters[4],
          createSwapParameters[5],
          createSwapParameters[6],
          createSwapParameters[7],
        ];
        const invalidLengthTokensAndPathTo = [
          createSwapParameters[0],
          createSwapParameters[1],
          createSwapParameters[2],
          [...createSwapParameters[3], [0, 0, 0, 0]],
          createSwapParameters[4],
          createSwapParameters[5],
          createSwapParameters[6],
          createSwapParameters[7],
        ];
        const invalidPathFromLength = [
          createSwapParameters[0],
          createSwapParameters[1],
          [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
          ],
          createSwapParameters[3],
          createSwapParameters[4],
          createSwapParameters[5],
          createSwapParameters[6],
          createSwapParameters[7],
        ];
        const invalidPathToLength = [
          createSwapParameters[0],
          createSwapParameters[1],
          createSwapParameters[2],
          [
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          ],
          createSwapParameters[4],
          createSwapParameters[5],
          createSwapParameters[6],
          createSwapParameters[7],
        ];

        await expect(
          tokenSwapModuleInstance.createSwap(...mismatchLengthTokensAndPathFrom)
        ).to.be.revertedWith("TokenSwapModule: Error 102");

        await expect(
          tokenSwapModuleInstance.createSwap(...invalidLengthTokensAndPathTo)
        ).to.be.revertedWith("TokenSwapModule: Error 102");

        await expect(
          tokenSwapModuleInstance.createSwap(...invalidPathFromLength)
        ).to.be.revertedWith("TokenSwapModule: Error 102");

        await expect(
          tokenSwapModuleInstance.createSwap(...invalidPathToLength)
        ).to.be.revertedWith("TokenSwapModule: Error 102");
      });
    });
    describe("# when initializing with valid parameters", () => {
      it("» should succeed in creating the swap", async () => {
        await expect(
          tokenSwapModuleInstance.createSwap(...createSwapParameters)
        ).to.emit(tokenSwapModuleInstance, "TokenSwapCreated");

        expect(await dealManagerInstance.daoDepositManager(dao1.address)).to.not
          .be.empty;
        expect(await dealManagerInstance.daoDepositManager(dao2.address)).to.not
          .be.empty;
        expect(await dealManagerInstance.daoDepositManager(dao3.address)).to.not
          .be.empty;

        expect(
          (await tokenSwapModuleInstance.tokenSwaps(SWAP1)).metadata
        ).to.equal(METADATA1);
      });
      it("» should succeed emitting right metadata event", async () => {
        const tx = await tokenSwapModuleInstance.createSwap(
          ...createSwapParameters
        );
        const receipt = await tx.wait();

        const events = receipt.events.filter((x) => {
          return x.event == "TokenSwapCreated";
        });
        const localMetadata = events[0].args[2];
        expect(METADATA1).to.equal(
          formatBytes32String(parseBytes32String(localMetadata))
        );
      });
      it("» should succeed in creating 2 swaps", async () => {
        await expect(
          tokenSwapModuleInstance.createSwap(
            [daosDeal2[0].address, daosDeal2[1].address, daosDeal2[2].address],
            createSwapParameters[1],
            createSwapParameters[2],
            createSwapParameters[3],
            createSwapParameters[4],
            createSwapParameters[5],
            METADATA2,
            createSwapParameters[7]
          )
        ).to.emit(tokenSwapModuleInstance, "TokenSwapCreated");
        await expect(
          tokenSwapModuleInstance.createSwap(...createSwapParameters)
        ).to.emit(tokenSwapModuleInstance, "TokenSwapCreated");

        expect(await dealManagerInstance.daoDepositManager(dao1.address)).to.not
          .be.empty;
        expect(await dealManagerInstance.daoDepositManager(dao2.address)).to.not
          .be.empty;
        expect(await dealManagerInstance.daoDepositManager(dao3.address)).to.not
          .be.empty;
        expect(await dealManagerInstance.daoDepositManager(dao4.address)).to.not
          .be.empty;
      });
      it("» should succeed in creating 3 swaps", async () => {
        const createSwapParameters1 = [
          [daosDeal2[0].address, daosDeal2[1].address, daosDeal2[2].address],
          createSwapParameters[1],
          createSwapParameters[2],
          createSwapParameters[3],
          createSwapParameters[4],
          createSwapParameters[5],
          METADATA2,
          createSwapParameters[7],
        ];
        const createSwapParameters2 = [
          [daosDeal3[0].address, daosDeal3[1].address, daosDeal3[2].address],
          createSwapParameters[1],
          createSwapParameters[2],
          createSwapParameters[3],
          createSwapParameters[4],
          createSwapParameters[5],
          METADATA3,
          createSwapParameters[7],
        ];

        await expect(
          tokenSwapModuleInstance.createSwap(...createSwapParameters)
        ).to.emit(tokenSwapModuleInstance, "TokenSwapCreated");
        await expect(
          tokenSwapModuleInstance.createSwap(...createSwapParameters1)
        ).to.emit(tokenSwapModuleInstance, "TokenSwapCreated");
        await expect(
          tokenSwapModuleInstance.createSwap(...createSwapParameters2)
        ).to.emit(tokenSwapModuleInstance, "TokenSwapCreated");

        expect(await dealManagerInstance.daoDepositManager(dao1.address)).to.not
          .be.empty;
        expect(await dealManagerInstance.daoDepositManager(dao2.address)).to.not
          .be.empty;
        expect(await dealManagerInstance.daoDepositManager(dao3.address)).to.not
          .be.empty;
        expect(await dealManagerInstance.daoDepositManager(dao4.address)).to.not
          .be.empty;
        expect(await dealManagerInstance.daoDepositManager(dao5.address)).to.not
          .be.empty;

        const swap1 = await tokenSwapModuleInstance.tokenSwaps(SWAP1);
        expect(swap1.metadata).to.eql(METADATA1);
        const swap2 = await tokenSwapModuleInstance.tokenSwaps(SWAP2);
        expect(swap2.metadata).to.eql(METADATA2);
        const swap3 = await tokenSwapModuleInstance.tokenSwaps(SWAP3);
        expect(swap3.metadata).to.eql(METADATA3);
      });
    });
  });
  describe("$ Function: checkExecutability", () => {
    describe("# invalid parameters", () => {
      beforeEach(async () => {
        await setupFundingStateSingleDeal(
          contractInstances,
          daosDeal1,
          createSwapParameters
        );
      });
      it("» should revert when using an invalid ID", async () => {
        await expect(
          tokenSwapModuleInstance.checkExecutability(INVALID_SWAP)
        ).to.revertedWith("TokenSwapModule: Error 207");
      });
    });
    describe("# return false", () => {
      beforeEach(async () => {
        await setupFundingStateSingleDeal(
          contractInstances,
          daosDeal1,
          createSwapParameters
        );
      });
      it("» should be false when deadline exeeded", async () => {
        await time.increase(DAY * 8);
        expect(
          await tokenSwapModuleInstance.checkExecutability(SWAP1)
        ).to.equal(false);
      });
      it("» should be false when not fully funded", async () => {
        expect(
          await tokenSwapModuleInstance.checkExecutability(SWAP1)
        ).to.equal(false);
      });
      it("» should be false when the deal has already been executed", async () => {
        const createNewSwapParameters = initializeParameters(
          [dao1.address, dao2.address, dao3.address],
          [
            tokenAddresses[0],
            tokenAddresses[1],
            tokenAddresses[2],
            tokenAddresses[3],
          ],
          setupPathFromDeal1(),
          setupPathToDeal1(VESTING_CLIFF1, VESTING_DURATION1),
          allDaoplomatsAddresses,
          rewardPathTo,
          METADATA2,
          deadline1
        );

        ({ tokenSwapModuleInstance } = await setupExecuteSwapStateSingleDeal(
          contractInstances,
          daosDeal1,
          createNewSwapParameters,
          tokenInstances,
          depositer1,
          SWAP1
        ));

        await tokenSwapModuleInstance.executeSwap(SWAP1);
        expect(
          await tokenSwapModuleInstance.checkExecutability(SWAP1)
        ).to.equal(false);
      });
    });
    describe("# return true", () => {
      beforeEach(async () => {
        ({ tokenSwapModuleInstance } = await setupExecuteSwapStateSingleDeal(
          contractInstances,
          daosDeal1,
          createSwapParameters,
          tokenInstances,
          depositer1,
          SWAP1
        ));
      });
      it("» should be true when funded", async () => {
        expect(
          await tokenSwapModuleInstance.checkExecutability(SWAP1)
        ).to.equal(true);
      });
    });
  });
  describe("$ Function: executeSwap with tokens", () => {
    describe("# when not able to execute", () => {
      beforeEach(async () => {
        ({ depositContractInstances } = await setupFundingStateSingleDeal(
          contractInstances,
          daosDeal1,
          createSwapParameters
        ));
      });
      it("» should fail on invalid ID", async () => {
        await expect(
          tokenSwapModuleInstance.executeSwap(INVALID_SWAP)
        ).to.revertedWith("TokenSwapModule: Error 207");
      });
      it("» should fail on DepositContracts not funded", async () => {
        await expect(
          tokenSwapModuleInstance.executeSwap(SWAP1)
        ).to.revertedWith("TokenSwapModule: Error 265");
      });
      it("» should fail on deadline exeeded", async () => {
        await time.increase(DAY * 10);

        await expect(
          tokenSwapModuleInstance.executeSwap(SWAP1)
        ).to.revertedWith("TokenSwapModule: Error 265");
      });
      it("» should fail on the deal already been executed", async () => {
        const createNewSwapParameters = initializeParameters(
          [dao1.address, dao2.address, dao3.address],
          [
            tokenAddresses[0],
            tokenAddresses[1],
            tokenAddresses[2],
            tokenAddresses[3],
          ],
          setupPathFromDeal1(),
          setupPathToDeal1(VESTING_CLIFF1, VESTING_DURATION1),
          allDaoplomatsAddresses,
          rewardPathTo,
          METADATA2,
          deadline1
        );

        ({ tokenSwapModuleInstance } = await setupExecuteSwapStateSingleDeal(
          contractInstances,
          daosDeal1,
          createNewSwapParameters,
          tokenInstances,
          depositer1,
          SWAP1
        ));

        await tokenSwapModuleInstance.executeSwap(SWAP1);
        await expect(
          tokenSwapModuleInstance.executeSwap(SWAP1)
        ).to.revertedWith("TokenSwapModule: Error 266");
      });
    });
    describe("# when able to execute", () => {
      beforeEach(async () => {
        ({ tokenInstancesSubset, tokenSwapModuleInstance } =
          await setupExecuteSwapStateSingleDeal(
            contractInstances,
            daosDeal1,
            createSwapParameters,
            tokenInstances,
            depositer1,
            SWAP1
          ));
      });
      it("» should succeed in executing the swap", async () => {
        // Balance before swap
        expect(
          await tokenInstances[0].balanceOf(daosDeal1[0].address)
        ).to.equal(parseEther("0"));
        expect(
          await tokenInstances[1].balanceOf(daosDeal1[1].address)
        ).to.equal(parseEther("0"));
        expect(
          await tokenInstances[2].balanceOf(daosDeal1[2].address)
        ).to.equal(parseEther("0"));
        expect(
          await tokenInstances[3].balanceOf(daosDeal1[2].address)
        ).to.equal(parseEther("0"));

        // Execute swap
        await expect(tokenSwapModuleInstance.executeSwap(SWAP1))
          .to.emit(tokenSwapModuleInstance, "TokenSwapExecuted")
          .withArgs(tokenSwapModuleInstance.address, SWAP1, METADATA1);

        const tokenSwap1 =
          await tokenSwapModuleInstance.getTokenswapFromMetadata(METADATA1);
        expect(tokenSwap1.isExecuted).to.equal(true);

        // Balance after swap

        // Token 1
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[0].balanceOf(daosDeal1[0].address),
              "ether"
            )
          )
        ).to.equal(0);
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[0].balanceOf(daosDeal1[1].address),
              "ether"
            )
          )
        ).to.equal(1);
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[0].balanceOf(daosDeal1[2].address),
              "ether"
            )
          )
        ).to.equal(1);

        // Token 2
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[1].balanceOf(daosDeal1[0].address),
              "ether"
            )
          )
        ).to.equal(1);
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[1].balanceOf(daosDeal1[1].address),
              "ether"
            )
          )
        ).to.equal(0);
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[1].balanceOf(daosDeal1[2].address),
              "ether"
            )
          )
        ).to.equal(1);

        // Token 3
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[2].balanceOf(daosDeal1[0].address),
              "ether"
            )
          )
        ).to.equal(3);
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[2].balanceOf(daosDeal1[1].address),
              "ether"
            )
          )
        ).to.equal(3);
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[2].balanceOf(daosDeal1[2].address),
              "ether"
            )
          )
        ).to.equal(0);

        // Token 4
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[3].balanceOf(daosDeal1[0].address),
              "ether"
            )
          )
        ).to.equal(5);
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[3].balanceOf(daosDeal1[1].address),
              "ether"
            )
          )
        ).to.equal(5);
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[3].balanceOf(daosDeal1[2].address),
              "ether"
            )
          )
        ).to.equal(0);
      });
    });
  });
  describe("$ Frontend values test", () => {
    beforeEach(async () => {
      const primaryDao = dao1.address;
      const partneredDao = dao2.address;
      const dealTokens = [tokenAddresses[0], tokenAddresses[1]];
      const dealPathFrom = [
        [parseEther("1500"), 0],
        [0, parseEther("4000")],
      ];
      const dealPathTo = [
        [0, 0, 0, 0, 0, parseEther("1500"), 6 * MONTH, 3 * YEAR],
        [parseEther("4000"), 0, 0, 0, 0, 0, 0, 0],
      ];
      const fundingDeadline = 2 * DAY;
      const createNewSwapParameters = initializeParameters(
        [primaryDao, partneredDao],
        dealTokens,
        dealPathFrom,
        dealPathTo,
        allDaoplomatsAddresses,
        rewardPathTo,
        METADATA1,
        fundingDeadline
      );
      ({ tokenInstancesSubset, tokenSwapModuleInstance } =
        await setupExecuteSwapStateSingleDeal(
          contractInstances,
          daosDeal1,
          createNewSwapParameters,
          tokenInstances,
          depositer1,
          SWAP1
        ));
    });
    it("» should be able to execute the swap", async () => {
      await tokenSwapModuleInstance.executeSwap(SWAP1);
    });
  });
  describe("$ Function: executeSwap with ETH", () => {
    describe("# when able to execute", () => {
      beforeEach(async () => {
        const createNewSwapParameters = initializeParameters(
          [dao1.address, dao2.address, dao3.address],
          [
            ZERO_ADDRESS,
            tokenAddresses[1],
            tokenAddresses[2],
            tokenAddresses[3],
          ],
          setupPathFromDeal1(),
          setupPathToDeal1(VESTING_CLIFF1, VESTING_DURATION1),
          allDaoplomatsAddresses,
          rewardPathTo,
          METADATA2,
          deadline1
        );

        ({ tokenInstancesSubset, tokenSwapModuleInstance } =
          await setupExecuteSwapStateSingleDeal(
            contractInstances,
            daosDeal1,
            createNewSwapParameters,
            tokenInstances,
            depositer1,
            SWAP1
          ));
      });
      it("» should succeed in executing the swap", async () => {
        // Balance before swap
        let ethBeforeDao1 = Math.round(
          formatUnits(
            await ethers.provider.getBalance(daosDeal1[0].address),
            "ether"
          )
        );
        expect(ethBeforeDao1).to.equal(10000);
        let ethBeforeDao2 = Math.round(
          formatUnits(
            await ethers.provider.getBalance(daosDeal1[1].address),
            "ether"
          )
        );
        expect(ethBeforeDao2).to.equal(10000);
        let ethBeforeDao3 = Math.round(
          formatUnits(
            await ethers.provider.getBalance(daosDeal1[2].address),
            "ether"
          )
        );
        expect(ethBeforeDao3).to.equal(10000);
        expect(
          await tokenInstances[1].balanceOf(daosDeal1[1].address)
        ).to.equal(parseEther("0"));
        expect(
          await tokenInstances[2].balanceOf(daosDeal1[2].address)
        ).to.equal(parseEther("0"));
        expect(
          await tokenInstances[3].balanceOf(daosDeal1[2].address)
        ).to.equal(parseEther("0"));

        // Execute swap
        await expect(tokenSwapModuleInstance.executeSwap(SWAP1))
          .to.emit(tokenSwapModuleInstance, "TokenSwapExecuted")
          .withArgs(tokenSwapModuleInstance.address, SWAP1, METADATA2);

        // Balance after swap

        // Token 1
        let ethAfterDao1 = Math.round(
          formatUnits(
            await ethers.provider.getBalance(daosDeal1[0].address),
            "ether"
          )
        );
        expect(ethAfterDao1 - ethBeforeDao1, "ether").to.equal(0);

        let ethAfterDao2 = Math.round(
          formatUnits(
            await ethers.provider.getBalance(daosDeal1[1].address),
            "ether"
          )
        );
        expect(ethAfterDao2 - ethBeforeDao2, "ether").to.equal(1);

        let ethAfterDao3 = Math.round(
          formatUnits(
            await ethers.provider.getBalance(daosDeal1[2].address),
            "ether"
          )
        );
        expect(ethAfterDao3 - ethBeforeDao3, "ether").to.equal(1);

        // Token 2
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[1].balanceOf(daosDeal1[0].address),
              "ether"
            )
          )
        ).to.equal(1);
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[1].balanceOf(daosDeal1[1].address),
              "ether"
            )
          )
        ).to.equal(0);
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[1].balanceOf(daosDeal1[2].address),
              "ether"
            )
          )
        ).to.equal(1);

        // Token 3
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[2].balanceOf(daosDeal1[0].address),
              "ether"
            )
          )
        ).to.equal(3);
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[2].balanceOf(daosDeal1[1].address),
              "ether"
            )
          )
        ).to.equal(3);
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[2].balanceOf(daosDeal1[2].address),
              "ether"
            )
          )
        ).to.equal(0);

        // Token 4
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[3].balanceOf(daosDeal1[0].address),
              "ether"
            )
          )
        ).to.equal(5);
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[3].balanceOf(daosDeal1[1].address),
              "ether"
            )
          )
        ).to.equal(5);
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[3].balanceOf(daosDeal1[2].address),
              "ether"
            )
          )
        ).to.equal(0);
      });
    });
  });
  describe("$ Function: getTokenswapFromMetadata", () => {
    describe("# when not able to execute", () => {
      beforeEach(async () => {
        ({ depositContractInstances } = await setupFundingStateSingleDeal(
          contractInstances,
          daosDeal1,
          createSwapParameters
        ));
      });
      it("» should fail with invalid metadata", async () => {
        expect(
          (await tokenSwapModuleInstance.getTokenswapFromMetadata(METADATA2))
            .metadata
        ).to.equal(formatBytes32String(""));
      });
    });
    describe("# when able to execute", () => {
      beforeEach(async () => {
        ({ depositContractInstances, createSwapParametersArray } =
          await setupMultipleCreateSwapStates(
            contractInstances,
            allDaos,
            METADATAS,
            tokenAddresses,
            createSwapParameters
          ));
      });
      it("» should succeed with valid metadata1", async () => {
        const currentTime = (await time.latest()).toNumber();
        const delta = 5;
        const tokenSwap1 =
          await tokenSwapModuleInstance.getTokenswapFromMetadata(METADATA1);
        expect(tokenSwap1.daos).to.eql(createSwapParametersArray[0][0]);
        expect(tokenSwap1.tokens).to.eql(createSwapParametersArray[0][1]);
        expect(tokenSwap1.executionDate).to.equal(0);
        expect(tokenSwap1.metadata).to.eql(createSwapParametersArray[0][6]);
        expect(tokenSwap1.deadline).to.be.closeTo(
          createSwapParametersArray[0][7] + currentTime,
          delta
        );
        expect(tokenSwap1.isExecuted).to.equal(false);
      });
      it("» should succeed with valid metadata2", async () => {
        const currentTime = (await time.latest()).toNumber();
        const delta = 5;
        const tokenSwap2 =
          await tokenSwapModuleInstance.getTokenswapFromMetadata(METADATA2);
        expect(tokenSwap2.daos).to.eql(createSwapParametersArray[1][0]);
        expect(tokenSwap2.tokens).to.eql(createSwapParametersArray[1][1]);
        expect(tokenSwap2.executionDate).to.equal(0);
        expect(tokenSwap2.metadata).to.equal(createSwapParametersArray[1][6]);
        expect(tokenSwap2.deadline).to.be.closeTo(
          createSwapParametersArray[1][7] + currentTime,
          delta
        );
        expect(tokenSwap2.isExecuted).to.equal(false);
      });
      it("» should succeed with valid metadata3", async () => {
        const currentTime = (await time.latest()).toNumber();
        const delta = 5;
        const tokenSwap3 =
          await tokenSwapModuleInstance.getTokenswapFromMetadata(METADATA3);
        expect(tokenSwap3.daos).to.eql(createSwapParametersArray[2][0]);
        expect(tokenSwap3.tokens).to.eql(createSwapParametersArray[2][1]);
        expect(tokenSwap3.executionDate).to.equal(0);
        expect(tokenSwap3.metadata).to.equal(createSwapParametersArray[2][6]);
        expect(tokenSwap3.deadline).to.be.closeTo(
          createSwapParametersArray[2][7] + currentTime,
          delta
        );
        expect(tokenSwap3.isExecuted).to.equal(false);
      });
    });
  });

  describe("$ Daoplomat Reward Mechanism", () => {
    describe("# when able to execute", () => {
      let primaryDao,
        partneredDao,
        dealTokens,
        daoplomats,
        dealPathFrom,
        dealPathTo,
        fundingDeadline;
      beforeEach(async () => {
        await tokenSwapModuleInstance.connect(root).setFee(0);
        expect(await tokenSwapModuleInstance.feeInBasisPoints()).to.eql(0);

        primaryDao = dao1.address;
        partneredDao = dao2.address;
        dealTokens = [tokenAddresses[0], tokenAddresses[1]];
        daoplomats = [daoplomat1.address, daoplomat2.address];
        dealPathFrom = [
          [parseEther("2000"), 0],
          [0, parseEther("4000")],
        ];
        dealPathTo = [
          [0, 0, 0, 0, parseEther("2000"), 0, 0, 0],
          [parseEther("4000"), 0, 0, 0, 0, 0, 0, 0],
        ];
        fundingDeadline = 2 * DAY;
      });
      it(" should sent the correct centi DAOplomat reward", async () => {
        const daoplmatReward = [[50], [50000, 50000]];

        const createNewSwapParameters = initializeParameters(
          [primaryDao, partneredDao],
          dealTokens,
          dealPathFrom,
          dealPathTo,
          daoplomats,
          daoplmatReward,
          METADATA1,
          fundingDeadline
        );

        ({ tokenInstancesSubset, tokenSwapModuleInstance } =
          await setupExecuteSwapStateSingleDeal(
            contractInstances,
            daosDeal1,
            createNewSwapParameters,
            tokenInstances,
            depositer1,
            SWAP1
          ));
        expect(await tokenInstances[0].balanceOf(daoplomat1.address)).to.equal(
          parseEther("0")
        );
        expect(await tokenInstances[1].balanceOf(daoplomat1.address)).to.equal(
          parseEther("0")
        );
        expect(await tokenInstances[0].balanceOf(daoplomat2.address)).to.equal(
          parseEther("0")
        );
        expect(await tokenInstances[1].balanceOf(daoplomat2.address)).to.equal(
          parseEther("0")
        );

        // Execute swap
        await expect(tokenSwapModuleInstance.executeSwap(SWAP1))
          .to.emit(tokenSwapModuleInstance, "TokenSwapExecuted")
          .withArgs(tokenSwapModuleInstance.address, SWAP1, METADATA1);

        const tokenSwap1 =
          await tokenSwapModuleInstance.getTokenswapFromMetadata(METADATA1);
        expect(tokenSwap1.isExecuted).to.equal(true);
        expect(await tokenInstances[0].balanceOf(daoplomat1.address)).to.equal(
          parseEther("0.5")
        );
        expect(await tokenInstances[0].balanceOf(daoplomat2.address)).to.equal(
          parseEther("0.5")
        );
        expect(await tokenInstances[1].balanceOf(daoplomat1.address)).to.equal(
          parseEther("1")
        );
        expect(await tokenInstances[1].balanceOf(daoplomat2.address)).to.equal(
          parseEther("1")
        );
      });

      it(" should sent the correct mill DAOplomat reward", async () => {
        const daoplmatReward = [[5], [50000, 50000]];

        const createNewSwapParameters = initializeParameters(
          [primaryDao, partneredDao],
          dealTokens,
          dealPathFrom,
          dealPathTo,
          daoplomats,
          daoplmatReward,
          METADATA1,
          fundingDeadline
        );

        ({ tokenInstancesSubset, tokenSwapModuleInstance } =
          await setupExecuteSwapStateSingleDeal(
            contractInstances,
            daosDeal1,
            createNewSwapParameters,
            tokenInstances,
            depositer1,
            SWAP1
          ));
        expect(await tokenInstances[0].balanceOf(daoplomat1.address)).to.equal(
          parseEther("0")
        );
        expect(await tokenInstances[1].balanceOf(daoplomat1.address)).to.equal(
          parseEther("0")
        );
        expect(await tokenInstances[0].balanceOf(daoplomat2.address)).to.equal(
          parseEther("0")
        );
        expect(await tokenInstances[1].balanceOf(daoplomat2.address)).to.equal(
          parseEther("0")
        );

        // Execute swap
        await expect(tokenSwapModuleInstance.executeSwap(SWAP1))
          .to.emit(tokenSwapModuleInstance, "TokenSwapExecuted")
          .withArgs(tokenSwapModuleInstance.address, SWAP1, METADATA1);

        const tokenSwap1 =
          await tokenSwapModuleInstance.getTokenswapFromMetadata(METADATA1);
        expect(tokenSwap1.isExecuted).to.equal(true);
        expect(await tokenInstances[0].balanceOf(daoplomat1.address)).to.equal(
          parseEther("0.05")
        );
        expect(await tokenInstances[0].balanceOf(daoplomat2.address)).to.equal(
          parseEther("0.05")
        );
        expect(await tokenInstances[1].balanceOf(daoplomat1.address)).to.equal(
          parseEther("0.1")
        );
        expect(await tokenInstances[1].balanceOf(daoplomat2.address)).to.equal(
          parseEther("0.1")
        );
      });
    });
  });
  describe("$ Fee Mechanism", () => {
    describe("# when able to execute", () => {
      it("» should not be able to change fee as non-admin", async () => {
        await expect(await tokenSwapModuleInstance.feeInBasisPoints()).to.eql(
          30
        );

        await expect(
          tokenSwapModuleInstance.connect(depositer1).setFee(50)
        ).to.be.revertedWith("ModuleBaseWithFee: Error 221");

        await expect(await tokenSwapModuleInstance.feeInBasisPoints()).to.eql(
          30
        );
      });
      it("» should be able to change fee as admin", async () => {
        await expect(await tokenSwapModuleInstance.feeInBasisPoints()).to.eql(
          30
        );

        // Setting the same value that currently is the fee, should not do anything
        // and hence not emit an event
        await expect(
          tokenSwapModuleInstance.connect(root).setFee(30)
        ).to.not.emit(tokenSwapModuleInstance, "FeeChanged");

        await expect(tokenSwapModuleInstance.connect(root).setFee(40)).to.emit(
          tokenSwapModuleInstance,
          "FeeChanged"
        );

        await expect(await tokenSwapModuleInstance.feeInBasisPoints()).to.eql(
          40
        );
      });
      it("» should not be able to change feewallet as non-admin", async () => {
        await expect(await tokenSwapModuleInstance.feeWallet()).to.eql(
          prime.address
        );

        await expect(
          tokenSwapModuleInstance
            .connect(depositer1)
            .setFeeWallet(depositer1.address)
        ).to.be.revertedWith("ModuleBaseWithFee: Error 221");

        await expect(await tokenSwapModuleInstance.feeWallet()).to.eql(
          prime.address
        );
      });
      it("» should be able to change feewallet as admin", async () => {
        await expect(await tokenSwapModuleInstance.feeWallet()).to.eql(
          prime.address
        );

        // Setting the same value that currently is the feewallet, should
        // not do anything and hence not emit an event
        await expect(
          tokenSwapModuleInstance.connect(root).setFeeWallet(prime.address)
        ).to.not.emit(tokenSwapModuleInstance, "FeeWalletChanged");

        await expect(
          tokenSwapModuleInstance.connect(root).setFeeWallet(depositer1.address)
        ).to.emit(tokenSwapModuleInstance, "FeeWalletChanged");

        await expect(await tokenSwapModuleInstance.feeWallet()).to.eql(
          depositer1.address
        );
      });
      it("» should not charge any fee with fee = 0", async () => {
        await tokenSwapModuleInstance.connect(root).setFee(0);
        expect(await tokenSwapModuleInstance.feeInBasisPoints()).to.eql(0);

        const primaryDao = dao1.address;
        const partneredDao = dao2.address;
        const dealTokens = [tokenAddresses[0], tokenAddresses[1]];
        const daoplomats = [];
        const daoplmatReward = [[0], []];
        const dealPathFrom = [
          [parseEther("1500"), 0],
          [0, parseEther("4000")],
        ];
        const dealPathTo = [
          [0, 0, 0, 0, parseEther("1500"), 0, 0, 0],
          [parseEther("4000"), 0, 0, 0, 0, 0, 0, 0],
        ];
        const fundingDeadline = 2 * DAY;

        const createNewSwapParameters = initializeParameters(
          [primaryDao, partneredDao],
          dealTokens,
          dealPathFrom,
          dealPathTo,
          daoplomats,
          daoplmatReward,
          METADATA1,
          fundingDeadline
        );

        ({ tokenInstancesSubset, tokenSwapModuleInstance } =
          await setupExecuteSwapStateSingleDeal(
            contractInstances,
            daosDeal1,
            createNewSwapParameters,
            tokenInstances,
            depositer1,
            SWAP1
          ));

        // Balance before swap
        expect(await tokenInstances[0].balanceOf(prime.address)).to.equal(
          parseEther("0")
        );
        expect(await tokenInstances[1].balanceOf(prime.address)).to.equal(
          parseEther("0")
        );

        // Execute swap
        await expect(tokenSwapModuleInstance.executeSwap(SWAP1))
          .to.emit(tokenSwapModuleInstance, "TokenSwapExecuted")
          .withArgs(tokenSwapModuleInstance.address, SWAP1, METADATA1);

        const tokenSwap1 =
          await tokenSwapModuleInstance.getTokenswapFromMetadata(METADATA1);
        expect(tokenSwap1.isExecuted).to.equal(true);

        // Balance after swap

        // Token 1
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[0].balanceOf(prime.address),
              "ether"
            )
          )
        ).to.equal(0);

        expect(
          Math.round(
            formatUnits(
              await tokenInstances[0].balanceOf(partneredDao),
              "ether"
            )
          )
        ).to.equal(1500);

        // Token 2
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[1].balanceOf(prime.address),
              "ether"
            )
          )
        ).to.equal(0);

        expect(
          Math.round(
            formatUnits(await tokenInstances[1].balanceOf(primaryDao), "ether")
          )
        ).to.equal(4000);
      });
      it("» should charge correct fee with fee = 30", async () => {
        expect(await tokenSwapModuleInstance.feeInBasisPoints()).to.eql(30);

        const primaryDao = dao1.address;
        const partneredDao = dao2.address;
        const dealTokens = [tokenAddresses[0], tokenAddresses[1]];
        const daoplomats = [];
        const daoplmatReward = [[0], []];
        const dealPathFrom = [
          [parseEther("1500"), 0],
          [0, parseEther("4000")],
        ];
        const dealPathTo = [
          [0, 0, 0, 0, parseEther("1500"), 0, 0, 0],
          [parseEther("4000"), 0, 0, 0, 0, 0, 0, 0],
        ];
        const fundingDeadline = 2 * DAY;

        const createNewSwapParameters = initializeParameters(
          [primaryDao, partneredDao],
          dealTokens,
          dealPathFrom,
          dealPathTo,
          daoplomats,
          daoplmatReward,
          METADATA1,
          fundingDeadline
        );

        ({ tokenInstancesSubset, tokenSwapModuleInstance } =
          await setupExecuteSwapStateSingleDeal(
            contractInstances,
            daosDeal1,
            createNewSwapParameters,
            tokenInstances,
            depositer1,
            SWAP1
          ));

        // Balance before swap
        expect(await tokenInstances[0].balanceOf(prime.address)).to.equal(
          parseEther("0")
        );
        expect(await tokenInstances[1].balanceOf(prime.address)).to.equal(
          parseEther("0")
        );

        // Execute swap
        await expect(tokenSwapModuleInstance.executeSwap(SWAP1))
          .to.emit(tokenSwapModuleInstance, "TokenSwapExecuted")
          .withArgs(tokenSwapModuleInstance.address, SWAP1, METADATA1);

        const tokenSwap1 =
          await tokenSwapModuleInstance.getTokenswapFromMetadata(METADATA1);
        expect(tokenSwap1.isExecuted).to.equal(true);

        // Balance after swap

        // Token 1
        // Note: 16 decimals, so 1 ETH is represented as 100 for more accuracy
        expect(
          Math.round(
            formatUnits(await tokenInstances[0].balanceOf(prime.address), 16)
          )
        ).to.equal(450); // swap of 1500, 0.3% is 4.5 -> 450

        // Note: 16 decimals, so 1 ETH is represented as 100 for more accuracy
        expect(
          Math.round(
            formatUnits(await tokenInstances[0].balanceOf(partneredDao), 16)
          )
        ).to.equal(149550); // swap of 1500, 0.3% deducted so 1495.5 -> 149550

        // Token 2
        expect(
          Math.round(
            formatUnits(await tokenInstances[1].balanceOf(prime.address), 16)
          )
        ).to.equal(1200); // swap of 4000, 0.3% is 12 -> 1200

        // Note: 16 decimals, so 1 ETH is represented as 100 for more accuracy
        expect(
          Math.round(
            formatUnits(await tokenInstances[1].balanceOf(primaryDao), 16)
          )
        ).to.equal(398800); // swap of 4000, 0.3% deducted so 3988 -> 398800
      });
    });
  });
});
