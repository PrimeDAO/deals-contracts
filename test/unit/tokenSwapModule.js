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
  allDaos;
let tokenAddresses, tokenInstancesSubset;
let createSwapParameters, createSwapParametersArray;
let dealManagerInstance, tokenSwapModuleInstance, tokenInstances;
let deadline1, deadline2, deadline3;

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
const METADATA1 = formatBytes32String("Uad8AA2CFPaVdyxa805p");
const METADATA2 = formatBytes32String("pnthglKd0wFHOK6Bn78C");
const METADATA3 = formatBytes32String("TqoScXB3Dv79eDjsSvfh");
const EMPTY_METADATA = formatBytes32String("");
const METADATAS = [METADATA1, METADATA2, METADATA3];

describe("> Contract: TokenSwapModule", () => {
  before(async () => {
    const signers = await ethers.getSigners();
    [root, prime, dao1, dao2, dao3, dao4, dao5, depositer1] = signers;
    daosDeal1 = [dao1, dao2, dao3];
    daosDeal2 = [dao1, dao3, dao4];
    daosDeal3 = [dao4, dao2, dao5];
    allDaos = [...daosDeal1, dao4, dao5];
  });

  beforeEach(async () => {
    contractInstances = await setupFixture();
    ({ dealManagerInstance, tokenSwapModuleInstance, tokenInstances } =
      contractInstances);

    tokenAddresses = tokenInstances.map((token) => token.address);
    deadline1 = BigNumber.from((await time.latest()).toNumber() + DAY * 7);
    deadline2 = BigNumber.from((await time.latest()).toNumber() + DAY * 10);
    deadline3 = BigNumber.from((await time.latest()).toNumber() + DAY * 12);

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
          METADATA2,
          createSwapParameters[5],
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
          EMPTY_METADATA,
          createSwapParameters[5],
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
        ];

        await expect(
          tokenSwapModuleInstance.createSwap(...invalidParameters)
        ).to.be.revertedWith("TokenSwapModule: Error 205");
      });
      it("» should fail on input array lengths don't match", async () => {
        const mismatchLengthTokensAndPathFrom = [
          createSwapParameters[0],
          createSwapParameters[1],
          [...createSwapParameters[2], [0, 0, 0, 0]],
          createSwapParameters[3],
          createSwapParameters[4],
          createSwapParameters[5],
        ];
        const invalidLengthTokensAndPathTo = [
          createSwapParameters[0],
          createSwapParameters[1],
          createSwapParameters[2],
          [...createSwapParameters[3], [0, 0, 0, 0]],
          createSwapParameters[4],
          createSwapParameters[5],
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
            METADATA2,
            createSwapParameters[5]
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
          METADATA2,
          createSwapParameters[5],
        ];
        const createSwapParameters2 = [
          [daosDeal3[0].address, daosDeal3[1].address, daosDeal3[2].address],
          createSwapParameters[1],
          createSwapParameters[2],
          createSwapParameters[3],
          METADATA3,
          createSwapParameters[5],
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
        ).to.revertedWith("TokenSwapModule: Error 208");
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
      it("» should be false when status not ACTIVE", async () => {
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
        ).to.revertedWith("TokenSwapModule: Error 208");
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
      it("» should fail on not ACTIVE status", async () => {
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
        await expect(
          tokenSwapModuleInstance.getTokenswapFromMetadata(METADATA2)
        ).to.revertedWith("TokenSwapModule: Error 207");
      });
    });
    describe("# when able to execute", () => {
      beforeEach(async () => {
        const swapParameterDeal2 = initializeParameters(
          [daosDeal2[0].address, daosDeal2[1].address, daosDeal2[2].address],
          createSwapParameters[1],
          setupPathToDeal2(),
          setupPathFromDeal2(VESTING_CLIFF2, VESTING_DURATION2),
          METADATA2,
          BigNumber.from((await time.latest()).toNumber() + DAY * 10)
        );
        const swapParameterDeal3 = initializeParameters(
          [daosDeal3[0].address, daosDeal3[1].address, daosDeal3[2].address],
          createSwapParameters[1],
          setupPathToDeal3(),
          setupPathFromDeal3(VESTING_CLIFF3, VESTING_DURATION3),
          METADATA3,
          BigNumber.from((await time.latest()).toNumber() + DAY * 12)
        );

        const multipleCreateSwapsParameters = [
          createSwapParameters,
          swapParameterDeal2,
          swapParameterDeal3,
        ];

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
        const tokenSwap1 =
          await tokenSwapModuleInstance.getTokenswapFromMetadata(METADATA1);
        expect(tokenSwap1.daos).to.eql(createSwapParametersArray[0][0]);
        expect(tokenSwap1.tokens).to.eql(createSwapParametersArray[0][1]);
        expect(tokenSwap1.executionDate).to.equal(0);
        expect(tokenSwap1.metadata).to.equal(createSwapParametersArray[0][4]);
        expect(BigNumber.from(tokenSwap1.deadline)).to.eql(
          createSwapParametersArray[0][5]
        );
        expect(tokenSwap1.status).to.equal(1);
      });
      it("» should succeed with valid metadata2", async () => {
        const tokenSwap2 =
          await tokenSwapModuleInstance.getTokenswapFromMetadata(METADATA2);
        expect(tokenSwap2.daos).to.eql(createSwapParametersArray[1][0]);
        expect(tokenSwap2.tokens).to.eql(createSwapParametersArray[1][1]);
        expect(tokenSwap2.executionDate).to.equal(0);
        expect(tokenSwap2.metadata).to.equal(createSwapParametersArray[1][4]);
        expect(BigNumber.from(tokenSwap2.deadline)).to.eql(
          createSwapParametersArray[1][5]
        );
        expect(tokenSwap2.status).to.equal(1);
      });
      it("» should succeed with valid metadata3", async () => {
        const tokenSwap3 =
          await tokenSwapModuleInstance.getTokenswapFromMetadata(METADATA3);
        expect(tokenSwap3.daos).to.eql(createSwapParametersArray[2][0]);
        expect(tokenSwap3.tokens).to.eql(createSwapParametersArray[2][1]);
        expect(tokenSwap3.executionDate).to.equal(0);
        expect(tokenSwap3.metadata).to.equal(createSwapParametersArray[2][4]);
        expect(BigNumber.from(tokenSwap3.deadline)).to.eql(
          createSwapParametersArray[2][5]
        );
        expect(tokenSwap3.status).to.equal(1);
      });
    });
  });
});
