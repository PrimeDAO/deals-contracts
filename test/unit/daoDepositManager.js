const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseEther, formatUnits, formatBytes32String } = ethers.utils;
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
  setupFundingStateSingleDeal,
  fundDepositerWithToken,
  approveTokenForDaoDepositManager,
  approveAllDealTokensForDaoDepositManagerSingleDeal,
  setupClaimStateSingleDeal,
  setupExecuteSwapStateSingleDeal,

  setupClaimStateMultipleDeals,
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
let deal1Parameters, deal2Parameters, deal3Parameters, dealParametersArray;
let daoDepositManagerDao1, daoDepositManagerDao2, daoDepositManagerDao3;
let daoDepositManagerInstance,
  daoDepositManagerFactoryInstance,
  dealManagerInstance,
  tokenSwapModuleInstance,
  tokenInstancesAllDeals,
  daoDepositManagerInstancesAllDeal;
let tokenInstances, tokenInstancesSubset, wethInstance;
let deadline, currTime;

const DAY = 60 * 60 * 24;
const HOUR = 60 * 60;
const VESTING_CLIFF1 = HOUR * 2;
const VESTING_CLIFF2 = HOUR * 4;
const VESTING_CLIFF3 = HOUR * 6;
const VESTING_DURATION1 = DAY;
const VESTING_DURATION2 = DAY * 2;
const VESTING_DURATION3 = DAY * 3;
const DEPOSIT1 = 0;
const DEPOSIT2 = 1;
const SWAP1 = 1;
const SWAP2 = 2;
const SWAP3 = 3;
const SWAPS_ARRAY = [SWAP1, SWAP2, SWAP3];
const INVALID_SWAP = 20;
const METADATA1 = formatBytes32String("hello");
const METADATA2 = formatBytes32String("helloao");
const METADATA3 = formatBytes32String("helloaodfs");

describe("> Contract: DaoDepositManager", () => {
  before(async () => {
    const signers = await ethers.getSigners();
    [root, prime, dao1, dao2, dao3, dao4, dao5, depositer1, depositer2] =
      signers;
    daosDeal1 = [dao1, dao2, dao3];
    daosDeal2 = [dao1, dao3, dao4];
    daosDeal3 = [dao4, dao2, dao5];
    allDaos = [daosDeal1, daosDeal2, daosDeal3];
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
        ).to.be.revertedWith("DaoDepositManager: Error 100");
      });
    });
    describe("# When initializing again", () => {
      it("» should fail on initializing twice", async () => {
        await daoDepositManagerInstance.initialize(dao1.address);
        await expect(
          daoDepositManagerInstance.initialize(dao1.address)
        ).to.be.revertedWith("DaoDepositManager: Error 001");
      });
    });
    describe("# When updating the DealManager contract", () => {
      it("» should fail on unauthorized access", async () => {
        await daoDepositManagerInstance.connect(dao1).initialize(dao1.address);

        await expect(await daoDepositManagerInstance.dealManager()).to.equal(
          dao1.address
        );

        await expect(
          daoDepositManagerInstance.connect(dao2).setDealManager(dao2.address)
        ).to.be.revertedWith("DaoDepositManager: Error 221");

        await expect(await daoDepositManagerInstance.dealManager()).to.equal(
          dao1.address
        );
      });
      it("» should succeed on authorized access", async () => {
        await daoDepositManagerInstance.connect(dao1).initialize(dao1.address);

        await expect(await daoDepositManagerInstance.dealManager()).to.equal(
          dao1.address
        );

        await daoDepositManagerInstance
          .connect(dao1)
          .setDealManager(dao2.address);

        await expect(await daoDepositManagerInstance.dealManager()).to.equal(
          dao2.address
        );
      });
    });
  });
  describe("$ DaoDepositManager through TokenSwapModule (end-to-end)", () => {
    describe("# single deposit ", async () => {
      beforeEach(async () => {
        currTime = await time.latest();

        ({ daoDepositManagerInstances } = await setupFundingStateSingleDeal(
          contractInstances,
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
        ).to.revertedWith("DaoDepositManager: Error 202");
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
        ).to.revertedWith("DaoDepositManager: Error 101");
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
        ).to.revertedWith("DaoDepositManager: Error 101");
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

        let depositDetails = await daoDepositManagerDao1.getDeposit(
          tokenSwapModuleInstance.address,
          SWAP1,
          0
        );

        expect(depositDetails[0]).to.equal(depositer1.address);
        expect(depositDetails[1]).to.equal(token.address);
        expect(Math.round(formatUnits(depositDetails[2], "ether"))).to.equal(2);
        expect(Math.round(formatUnits(depositDetails[3], "ether"))).to.equal(0);
        // increase time by 4 seconds, since each call adds 1 second to the timer
        expect(depositDetails[4].toString()).to.equal(
          (parseInt(currTime.toString()) + 4).toString()
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
        ({ daoDepositManagerInstances } = await setupFundingStateSingleDeal(
          contractInstances,
          daosDeal1,
          deal1Parameters
        ));
      });
      it("» should fail arrays mismatch", async () => {
        const token1 = tokenInstances[0];
        const token2 = tokenInstances[1];
        const fundDepositerAmount1 = parseEther("4");
        const fundDepositerAmount2 = parseEther("6");
        const depositAmount1 = parseEther("2");
        const depositAmount2 = parseEther("4");
        const depositAmount3 = parseEther("6");
        const tokensList = [token1, token2];
        const tokenListAddresses = tokensList.map((token) => token.address);
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

        await expect(
          daoDepositManagerDao1
            .connect(depositer1)
            .multipleDeposits(...depositParam)
        ).to.be.revertedWith("DaoDepositManager: Error 102");
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
        await approveAllDealTokensForDaoDepositManagerSingleDeal(
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

        await expect(
          await daoDepositManagerDao1.getTotalDepositCount(
            tokenSwapModuleInstance.address,
            SWAP1
          )
        ).to.equal(tokensList.length);

        let allDeposits = await daoDepositManagerDao1.getDepositRange(
          tokenSwapModuleInstance.address,
          SWAP1,
          0,
          2
        );

        await expect(allDeposits[0].length).to.equal(3);

        let someDeposits = await daoDepositManagerDao1.getDepositRange(
          tokenSwapModuleInstance.address,
          SWAP1,
          1,
          2
        );

        await expect(someDeposits[0].length).to.equal(2);
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
        await approveAllDealTokensForDaoDepositManagerSingleDeal(
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
        ({ daoDepositManagerInstances } = await setupFundingStateSingleDeal(
          contractInstances,
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
        expect(
          Math.round(
            formatUnits(
              await daoDepositManagerDao1.tokenBalances(token1),
              "ether"
            )
          )
        ).to.equal(0);

        await daoDepositManagerDao1.registerDeposit(...depositParam);

        expect(
          Math.round(
            formatUnits(
              await daoDepositManagerDao1.tokenBalances(token1),
              "ether"
            )
          )
        ).to.equal(2);
      });
      it("» should succeed on registering multiple deposits", async () => {
        const token1 = ZERO_ADDRESS;
        const depositAmount1 = parseEther("2");

        await depositer1.sendTransaction({
          to: daoDepositManagerDao1.address,
          value: depositAmount1,
        });

        const depositParam1 = [tokenSwapModuleInstance.address, SWAP1, token1];
        expect(
          Math.round(
            formatUnits(
              await daoDepositManagerDao1.tokenBalances(token1),
              "ether"
            )
          )
        ).to.equal(0);

        const token2 = tokenInstances[0];
        const fundDepositerAmount2 = parseEther("2");
        const depositAmount2 = parseEther("2");

        await fundDepositerWithToken(token2, depositer1, fundDepositerAmount2);
        await token2
          .connect(depositer1)
          .transfer(daoDepositManagerDao1.address, depositAmount2);

        const depositParam2 = [
          tokenSwapModuleInstance.address,
          SWAP1,
          token2.address,
        ];

        expect(
          Math.round(
            formatUnits(
              await daoDepositManagerDao1.tokenBalances(token2.address),
              "ether"
            )
          )
        ).to.equal(0);

        await daoDepositManagerDao1.registerDeposits(
          depositParam1[0],
          depositParam1[1],
          [depositParam1[2], depositParam2[2]]
        );

        expect(
          Math.round(
            formatUnits(
              await daoDepositManagerDao1.tokenBalances(token1),
              "ether"
            )
          )
        ).to.equal(2);

        expect(
          Math.round(
            formatUnits(
              await daoDepositManagerDao1.tokenBalances(token2.address),
              "ether"
            )
          )
        ).to.equal(2);
      });
    });
    describe("# withdraw ", async () => {
      // This setup:
      //  - creates single swap
      //  - funds the daoDepositContracts for this swap
      // It returns:
      //  - The tokensInstances for testing in the format:
      //    - [token1, token2, ...]
      beforeEach(async () => {
        currTime = await time.latest();

        ({ tokenInstancesSubset, daoDepositManagerInstances } =
          await setupExecuteSwapStateSingleDeal(
            contractInstances,
            daosDeal1,
            deal1Parameters,
            tokenInstances,
            depositer1,
            SWAP1
          ));

        [daoDepositManagerDao1, daoDepositManagerDao2, daoDepositManagerDao3] =
          daoDepositManagerInstances;
      });
      it("» should fail on using an invalid ID", async () => {
        const params = [tokenSwapModuleInstance.address, SWAP1, SWAP2];
        await expect(
          daoDepositManagerDao1.withdraw(...params)
        ).to.be.revertedWith("DaoDepositManager: Error 200");
      });
      it("» should fail on invalid msg.sender", async () => {
        const params = [tokenSwapModuleInstance.address, SWAP1, DEPOSIT1];
        await expect(
          daoDepositManagerDao1.connect(dao4).withdraw(...params)
        ).to.be.revertedWith("DaoDepositManager: Error 222");
      });
      it("» should fail on call by dao, but not expired", async () => {
        const params = [tokenSwapModuleInstance.address, SWAP1, DEPOSIT1];
        // Deal has not expired
        expect(await tokenSwapModuleInstance.hasDealExpired(SWAP1)).to.be.false;

        // Called by the dao
        await expect(
          daoDepositManagerDao1.connect(dao1).withdraw(...params)
        ).to.be.revertedWith("DaoDepositManager: Error 222");
      });
      it("» should fail on freeAmount not available", async () => {
        const params = [tokenSwapModuleInstance.address, SWAP1, DEPOSIT1];
        expect(await tokenSwapModuleInstance.checkExecutability(SWAP1)).to.be
          .true;

        await expect(tokenSwapModuleInstance.executeSwap(SWAP1))
          .to.emit(tokenSwapModuleInstance, "TokenSwapExecuted")
          .withArgs(tokenSwapModuleInstance.address, SWAP1, METADATA1);

        await expect(
          daoDepositManagerDao1.connect(depositer1).withdraw(...params)
        ).to.be.revertedWith("DaoDepositManager: Error 240");
      });
      it("» should succeed on withdrawing tokens", async () => {
        const params = [tokenSwapModuleInstance.address, SWAP1, DEPOSIT1];

        // Called by the right address
        await expect(
          daoDepositManagerDao1.connect(depositer1).withdraw(...params)
        )
          .to.emit(daoDepositManagerDao1, "Withdrawn")
          .withArgs(
            tokenSwapModuleInstance.address,
            SWAP1,
            depositer1.address,
            DEPOSIT1,
            tokenInstances[0].address,
            parseEther("6")
          );

        await expect(
          daoDepositManagerDao1.connect(depositer1).withdraw(...params)
        ).to.be.revertedWith("DaoDepositManager: Error 240");
      });
      it("» should succeed on withdrawing ETH", async () => {
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
            1,
            token,
            amount
          );

        const params = [tokenSwapModuleInstance.address, SWAP1, 1];

        await expect(
          daoDepositManagerDao1.connect(depositer1).withdraw(...params)
        )
          .to.emit(daoDepositManagerDao1, "Withdrawn")
          .withArgs(
            tokenSwapModuleInstance.address,
            SWAP1,
            depositer1.address,
            1,
            ZERO_ADDRESS,
            parseEther("2")
          );

        await expect(
          daoDepositManagerDao1.connect(depositer1).withdraw(...params)
        ).to.be.revertedWith("DaoDepositManager: Error 240");
      });
    });
    describe("# claimVesting ", async () => {
      // This setup:
      //  - creates single swap
      //  - funds the daoDepositContracts for single swap
      //  - executes the swap
      // It returns:
      //  - The tokensInstances for testing in the format:
      //    - [token1, token2, ...]
      beforeEach(async () => {
        currTime = await time.latest();

        ({ tokenInstancesAllDeals, daoDepositManagerInstancesAllDeal } =
          await setupClaimStateMultipleDeals(
            contractInstances,
            tokenInstances,
            allDaos,
            dealParametersArray,
            [depositer1, depositer2, depositer2],
            SWAPS_ARRAY
          ));

        [daoDepositManagerDao1, daoDepositManagerDao2, daoDepositManagerDao3] =
          daoDepositManagerInstancesAllDeal[0];
      });
      it("» should succeed on claiming", async () => {
        // The pathFrom/PathTo values can be found in test/helpers/setupPaths.js
        // Only the depositer gets funded with tokens to deposit, so no DAO has
        // any balance before the token swap gets executed.

        // Before cliff ended
        expect(
          Math.round(
            formatUnits(
              await daoDepositManagerDao1.getVestedBalance(
                tokenInstancesAllDeals[0][1].address
              ),
              "ether"
            )
          )
        ).to.equal(2);

        expect(
          Math.round(
            formatUnits(
              await tokenInstancesAllDeals[0][1].balanceOf(
                daosDeal1[0].address
              ),
              "ether"
            )
          )
        ).to.equal(1);

        expect(
          Math.round(
            formatUnits(
              await tokenInstancesAllDeals[1][1].balanceOf(
                daosDeal1[0].address
              ),
              "ether"
            )
          )
        ).to.equal(2);

        await time.increase(
          (await time.latest()) - currTime + VESTING_DURATION3
        );

        await daoDepositManagerDao1.claimVestings();

        expect(
          Math.round(
            formatUnits(
              await daoDepositManagerDao1.getVestedBalance(
                tokenInstancesAllDeals[0][1].address
              ),
              "ether"
            )
          )
        ).to.equal(0);

        expect(
          Math.round(
            formatUnits(
              await tokenInstancesAllDeals[0][1].balanceOf(
                daosDeal1[0].address
              ),
              "ether"
            )
          )
        ).to.equal(3);

        expect(
          Math.round(
            formatUnits(
              await tokenInstancesAllDeals[1][1].balanceOf(
                daosDeal1[0].address
              ),
              "ether"
            )
          )
        ).to.equal(6);
      });
    });
    describe("# claimDealVesting ", async () => {
      // This setup:
      //  - creates all the swaps in the dealParameterArray
      //  - funds all the DaoDepositManagers across all deals
      //  - executes all the deal
      // It returns:
      //  - All the tokensInstances for testing in the format:
      //    - [[tokenInstancesDeal1], [tokensInstancesDeal2]...]
      //  - All the depositManagerInstances for testing in this format:
      //    - [[daoDepositManagersDeal1], [daoDepositManagersDeal2]...]

      beforeEach(async () => {
        currTime = await time.latest();

        ({ tokenInstancesAllDeals, daoDepositManagerInstancesAllDeal } =
          await setupClaimStateMultipleDeals(
            contractInstances,
            tokenInstances,
            allDaos,
            dealParametersArray,
            [depositer1, depositer2, depositer2],
            SWAPS_ARRAY
          ));

        [daoDepositManagerDao1, daoDepositManagerDao2, daoDepositManagerDao3] =
          daoDepositManagerInstancesAllDeal[0];
      });
      it("» should succeed on claiming", async () => {
        // The pathFrom/PathTo values can be found in test/helpers/setupPaths.js
        // Only the depositer gets funded with tokens to deposit, so no DAO has
        // any balance before the token swap gets executed.

        // Before cliff ended
        expect(
          Math.round(
            formatUnits(
              await tokenInstancesAllDeals[0][1].balanceOf(
                daosDeal1[0].address
              ),
              "ether"
            )
          )
        ).to.equal(1);

        expect(
          Math.round(
            formatUnits(
              await tokenInstancesAllDeals[1][1].balanceOf(
                daosDeal1[0].address
              ),
              "ether"
            )
          )
        ).to.equal(2);

        await daoDepositManagerDao1.claimDealVestings(
          tokenSwapModuleInstance.address,
          SWAP1
        );
        expect(
          Math.round(
            formatUnits(
              await tokenInstancesAllDeals[0][1].balanceOf(
                daosDeal1[0].address
              ),
              "ether"
            )
          )
        ).to.equal(1);

        expect(
          Math.round(
            formatUnits(
              await tokenInstancesAllDeals[1][1].balanceOf(
                daosDeal1[0].address
              ),
              "ether"
            )
          )
        ).to.equal(2);

        // After cliff ended
        await time.increase(
          (await time.latest()) - currTime + VESTING_DURATION3
        );
        await daoDepositManagerDao1.claimDealVestings(
          tokenSwapModuleInstance.address,
          SWAP1
        );

        // This belongs to deal 1 an dshould have increased
        expect(
          Math.round(
            formatUnits(
              await tokenInstancesAllDeals[0][1].balanceOf(
                daosDeal1[0].address
              ),
              "ether"
            )
          )
        ).to.equal(3);

        // This belongs to deal 2 and should NOT have increased
        // since we only claimed deal 1
        expect(
          Math.round(
            formatUnits(
              await tokenInstancesAllDeals[1][1].balanceOf(
                daosDeal1[0].address
              ),
              "ether"
            )
          )
        ).to.equal(2);
      });
    });
  });
});
