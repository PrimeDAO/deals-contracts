const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");

const { parseEther, formatBytes32String, formatUnits } = ethers.utils;
const {
  constants: { ZERO_ADDRESS },
  time,
} = require("@openzeppelin/test-helpers");
const { BigNumber } = require("@ethersproject/bignumber");

const tokens = require("../helpers/tokens.js");
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
} = require("../helpers/tokenSwapSetupHelper.js");

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
      depositContractFactoryInstance: await ethers.getContractFactory(
        "DepositContract"
      ),
    };

    return { ...contractInstances };
  }
);

const setupMultipleCreateSwapStates = async (
  contractInstances,
  allDaos,
  metadatas,
  tokenAddresses,
  createSwapParameters
) => {
  const {
    tokenSwapModuleInstance,
    baseContractInstance,
    depositContractFactoryInstance,
  } = contractInstances;

  const daos1 = [allDaos[0].address, allDaos[1].address, allDaos[2].address];
  const daos2 = [allDaos[3].address, allDaos[1].address, allDaos[4].address];
  const daos3 = [allDaos[0].address, allDaos[2].address, allDaos[3].address];
  const tokenAddressesForSwap = [
    tokenAddresses[0],
    tokenAddresses[1],
    tokenAddresses[2],
    tokenAddresses[3],
  ];

  const createNewSwapParameters1 = initializeParameters(
    daos1,
    tokenAddressesForSwap,
    createSwapParameters[2],
    createSwapParameters[3],
    metadatas[0],
    createSwapParameters[5]
  );
  const createNewSwapParameters2 = initializeParameters(
    daos2,
    tokenAddressesForSwap,
    createSwapParameters[2],
    createSwapParameters[3],
    metadatas[1],
    createSwapParameters[5]
  );
  const createNewSwapParameters3 = initializeParameters(
    daos3,
    tokenAddressesForSwap,
    createSwapParameters[2],
    createSwapParameters[3],
    metadatas[2],
    createSwapParameters[5]
  );
  const createSwapParametersArray = [
    createNewSwapParameters1,
    createNewSwapParameters2,
    createNewSwapParameters3,
  ];

  await tokenSwapModuleInstance.createSwap(...createNewSwapParameters1);
  await tokenSwapModuleInstance.createSwap(...createNewSwapParameters2);
  await tokenSwapModuleInstance.createSwap(...createNewSwapParameters3);

  const depositContractInstanceDAO1 =
    await depositContractFactoryInstance.attach(
      await baseContractInstance.depositContract(allDaos[0].address)
    );
  const depositContractInstanceDAO2 =
    await depositContractFactoryInstance.attach(
      await baseContractInstance.depositContract(allDaos[1].address)
    );
  const depositContractInstanceDAO3 =
    await depositContractFactoryInstance.attach(
      await baseContractInstance.depositContract(allDaos[2].address)
    );
  const depositContractInstanceDAO4 =
    await depositContractFactoryInstance.attach(
      await baseContractInstance.depositContract(allDaos[3].address)
    );
  const depositContractInstanceDAO5 =
    await depositContractFactoryInstance.attach(
      await baseContractInstance.depositContract(allDaos[4].address)
    );

  const depositContractInstances = [
    depositContractInstanceDAO1,
    depositContractInstanceDAO2,
    depositContractInstanceDAO3,
    depositContractInstanceDAO4,
    depositContractInstanceDAO5,
  ];

  return {
    tokenSwapModuleInstance,
    depositContractInstances,
    createSwapParametersArray,
  };
};

const setupCreateSwapState = async (
  contractInstances,
  daos,
  createSwapParameters
) => {
  const {
    tokenSwapModuleInstance,
    baseContractInstance,
    depositContractFactoryInstance,
  } = contractInstances;

  await tokenSwapModuleInstance.createSwap(...createSwapParameters);

  const depositContractInstanceDAO1 =
    await depositContractFactoryInstance.attach(
      await baseContractInstance.depositContract(daos[0].address)
    );
  const depositContractInstanceDAO2 =
    await depositContractFactoryInstance.attach(
      await baseContractInstance.depositContract(daos[1].address)
    );
  const depositContractInstanceDAO3 =
    await depositContractFactoryInstance.attach(
      await baseContractInstance.depositContract(daos[2].address)
    );

  const depositContractInstances = [
    depositContractInstanceDAO1,
    depositContractInstanceDAO2,
    depositContractInstanceDAO3,
  ];

  return {
    tokenSwapModuleInstance,
    depositContractInstances,
  };
};

const fundDAOWithToken = async (tokenInstance, dao, amount) => {
  await tokenInstance.transfer(dao.address, parseEther(amount));
};

const setupExecuteSwapState = async (
  contractInstances,
  daos,
  createSwapParameters,
  swapID
) => {
  const DAO_TOKEN_AMOUNT = "10";

  const { tokenSwapModuleInstance, depositContractInstances } =
    await setupCreateSwapState(contractInstances, daos, createSwapParameters);
  const { tokenInstances } = contractInstances;

  await fundDAOWithToken(tokenInstances[0], daos[0], DAO_TOKEN_AMOUNT);
  await fundDAOWithToken(tokenInstances[1], daos[1], DAO_TOKEN_AMOUNT);
  await fundDAOWithToken(tokenInstances[2], daos[2], DAO_TOKEN_AMOUNT);
  await fundDAOWithToken(tokenInstances[3], daos[2], DAO_TOKEN_AMOUNT);

  await fundDepositContracts(
    tokenInstances,
    depositContractInstances,
    daos,
    swapID,
    createSwapParameters
  );
  return { tokenSwapModuleInstance, tokenInstances };
};

describe.only("> Contract: TokenSwapModule", () => {
  let root,
    prime,
    dao1,
    dao2,
    dao3,
    dao4,
    dao5,
    daosDeal1,
    daosDeal2,
    daosDeal3,
    allDaos;
  let tokenAddresses;
  let createSwapParameters, createSwapParametersArray;
  let baseContractInstance, tokenSwapModuleInstance, tokenInstances;
  let depositContractInstances;
  let deadline;

  const MONTH = 60 * 60 * 24 * 31;
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

  before(async () => {
    const signers = await ethers.getSigners();
    [root, prime, dao1, dao2, dao3, dao4, dao5] = signers;
    daosDeal1 = [dao1, dao2, dao3];
    daosDeal2 = [dao1, dao3, dao4];
    daosDeal3 = [dao4, dao2, dao5];
    allDaos = [...daosDeal1, dao4, dao5];
  });

  beforeEach(async () => {
    contractInstances = await setupFixture();
    ({ baseContractInstance, tokenSwapModuleInstance, tokenInstances } =
      contractInstances);

    tokenAddresses = tokenInstances.map((token) => token.address);
    deadline = BigNumber.from((await time.latest()).toNumber() + DAY * 7);

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
      deadline
    );
  });
  describe("$ Function: createSwap", () => {
    describe("# when initializing with invalid parameters", () => {
      it("» fails on invalid DAO address", async () => {
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
        ).to.be.revertedWith("BASECONTRACT-INVALID-DAO-ADDRESS");
      });
      it("» fails on number of DAOs has to be bigger then 1", async () => {
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
        ).to.be.revertedWith("Module: at least 2 daos required");
      });
      it("» fails on metadata not unique", async () => {
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
        ).to.be.revertedWith("Module: metadata already exists");
      });
      it("» fails on number of tokens is 0", async () => {
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
        ).to.be.revertedWith("Module: at least 1 token required");
      });
      it("» fails on input array lengths don't match", async () => {
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
        ).to.be.revertedWith("Module: invalid array lengths");

        await expect(
          tokenSwapModuleInstance.createSwap(...invalidLengthTokensAndPathTo)
        ).to.be.revertedWith("Module: invalid array lengths");

        await expect(
          tokenSwapModuleInstance.createSwap(...invalidPathFromLength)
        ).to.be.revertedWith("Module: invalid array lengths");

        await expect(
          tokenSwapModuleInstance.createSwap(...invalidPathToLength)
        ).to.be.revertedWith("Module: invalid array lengths");
      });
    });
    describe("# when initializing with valid parameters", () => {
      it("» succeeds in creating the swap", async () => {
        await expect(
          tokenSwapModuleInstance.createSwap(...createSwapParameters)
        ).to.emit(tokenSwapModuleInstance, "TokenSwapCreated");

        expect(await baseContractInstance.depositContract(dao1.address)).to.not
          .be.empty;
        expect(await baseContractInstance.depositContract(dao2.address)).to.not
          .be.empty;
        expect(await baseContractInstance.depositContract(dao3.address)).to.not
          .be.empty;
      });
      it("» succeeds in creating 2 swaps", async () => {
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

        expect(await baseContractInstance.depositContract(dao1.address)).to.not
          .be.empty;
        expect(await baseContractInstance.depositContract(dao2.address)).to.not
          .be.empty;
        expect(await baseContractInstance.depositContract(dao3.address)).to.not
          .be.empty;
        expect(await baseContractInstance.depositContract(dao4.address)).to.not
          .be.empty;
      });
      it("» succeeds in creating 3 swaps", async () => {
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

        expect(await baseContractInstance.depositContract(dao1.address)).to.not
          .be.empty;
        expect(await baseContractInstance.depositContract(dao2.address)).to.not
          .be.empty;
        expect(await baseContractInstance.depositContract(dao3.address)).to.not
          .be.empty;
        expect(await baseContractInstance.depositContract(dao4.address)).to.not
          .be.empty;
        expect(await baseContractInstance.depositContract(dao5.address)).to.not
          .be.empty;

        const swap1 = await tokenSwapModuleInstance.getTokenswapFromId(SWAP1);
        expect(swap1.metadata).to.eql(METADATA1);
        const swap2 = await tokenSwapModuleInstance.getTokenswapFromId(SWAP2);
        expect(swap2.metadata).to.eql(METADATA2);
        const swap3 = await tokenSwapModuleInstance.getTokenswapFromId(SWAP3);
        expect(swap3.metadata).to.eql(METADATA3);
      });
    });
  });
  describe("$ Function: checkExecutability", () => {
    describe("# invalid parameters", () => {
      beforeEach(async () => {
        ({ tokenSwapModuleInstance } = await setupCreateSwapState(
          contractInstances,
          daosDeal1,
          createSwapParameters
        ));
      });
      it("» when using an invalid ID", async () => {
        await expect(
          tokenSwapModuleInstance.checkExecutability(INVALID_SWAP)
        ).to.revertedWith("Module: id doesn't exist");
      });
    });
    describe("# return false", () => {
      beforeEach(async () => {
        ({ tokenSwapModuleInstance } = await setupCreateSwapState(
          contractInstances,
          daosDeal1,
          createSwapParameters
        ));
      });
      it("» when deadline exeeded", async () => {
        await time.increase(DAY * 8);
        expect(
          await tokenSwapModuleInstance.checkExecutability(SWAP1)
        ).to.equal(false);
      });
      it("» when not fully funded", async () => {
        expect(
          await tokenSwapModuleInstance.checkExecutability(SWAP1)
        ).to.equal(false);
      });
      it("» when status not ACTIVE", async () => {
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
          deadline
        );

        ({ tokenSwapModuleInstance } = await setupExecuteSwapState(
          contractInstances,
          daosDeal1,
          createNewSwapParameters,
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
        ({ tokenSwapModuleInstance } = await setupExecuteSwapState(
          contractInstances,
          daosDeal1,
          createSwapParameters,
          SWAP1
        ));
      });
      it("» when funded", async () => {
        expect(
          await tokenSwapModuleInstance.checkExecutability(SWAP1)
        ).to.equal(true);
      });
    });
  });
  describe("$ Function: executeSwap", () => {
    describe("# when not able to execute", () => {
      beforeEach(async () => {
        ({ tokenSwapModuleInstance, depositContractInstances } =
          await setupCreateSwapState(
            contractInstances,
            daosDeal1,
            createSwapParameters
          ));
      });
      it("» fails on invalid ID", async () => {
        await expect(
          tokenSwapModuleInstance.executeSwap(INVALID_SWAP)
        ).to.revertedWith("Module: id doesn't exist");
      });
      it("» fails on DepositContracts not funded", async () => {
        await expect(
          tokenSwapModuleInstance.executeSwap(SWAP1)
        ).to.revertedWith("Module: swap not executable");
      });
      it("» fails on deadline exeeded", async () => {
        await time.increase(DAY * 10);

        await expect(
          tokenSwapModuleInstance.executeSwap(SWAP1)
        ).to.revertedWith("Module: swap expired");
      });
      it("» fails on not ACITVE status", async () => {
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
          deadline
        );

        ({ tokenSwapModuleInstance } = await setupExecuteSwapState(
          contractInstances,
          daosDeal1,
          createNewSwapParameters,
          SWAP1
        ));
        await tokenSwapModuleInstance.executeSwap(SWAP1);
        await expect(
          tokenSwapModuleInstance.executeSwap(SWAP1)
        ).to.revertedWith("Module: id not active");
      });
    });
    describe("# when able to execute", () => {
      beforeEach(async () => {
        ({ tokenSwapModuleInstance, tokenInstances } =
          await setupExecuteSwapState(
            contractInstances,
            daosDeal1,
            createSwapParameters,
            SWAP1
          ));
      });
      it("» succeeds in executing the swap", async () => {
        // Balance before swap
        expect(
          await tokenInstances[0].balanceOf(daosDeal1[0].address)
        ).to.equal(parseEther("4"));
        expect(
          await tokenInstances[1].balanceOf(daosDeal1[1].address)
        ).to.equal(parseEther("4"));
        expect(
          await tokenInstances[2].balanceOf(daosDeal1[2].address)
        ).to.equal(parseEther("4"));
        expect(
          await tokenInstances[3].balanceOf(daosDeal1[2].address)
        ).to.equal(parseEther("0"));

        // Execute swap
        await expect(tokenSwapModuleInstance.executeSwap(SWAP1))
          .to.emit(tokenSwapModuleInstance, "TokenSwapExecuted")
          .withArgs(SWAP1);

        // Balance after swap

        // Token 1
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[0].balanceOf(daosDeal1[0].address),
              "ether"
            )
          )
        ).to.equal(4);
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
        ).to.equal(4);
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
        ).to.equal(4);

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
        ({ tokenSwapModuleInstance, depositContractInstances } =
          await setupCreateSwapState(
            contractInstances,
            daosDeal1,
            createSwapParameters
          ));
      });
      it("» fails with invalid metadata", async () => {
        await expect(
          tokenSwapModuleInstance.getTokenswapFromMetadata(METADATA2)
        ).to.revertedWith("Module: metadata does not exist");
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

        ({
          tokenSwapModuleInstance,
          depositContractInstances,
          createSwapParametersArray,
        } = await setupMultipleCreateSwapStates(
          contractInstances,
          allDaos,
          METADATAS,
          tokenAddresses,
          createSwapParameters
        ));
      });
      it("» succeeds with valid metadata1", async () => {
        console.log("swap1");
        const tokenSwap1 =
          await tokenSwapModuleInstance.getTokenswapFromMetadata(METADATA1);

        expect(tokenSwap1.daos).to.eql(createSwapParametersArray[0][0]);
        expect(tokenSwap1.tokens).to.eql(createSwapParametersArray[0][1]);
        expect(tokenSwap1.executionDate).to.equal(0);
        expect(tokenSwap1.metadata).to.equal(createSwapParametersArray[0][4]);
        expect(tokenSwap1.deadline).to.eql(createSwapParametersArray[0][5]);
        expect(tokenSwap1.status).to.equal(1);
      });
      it("» succeeds with valid metadata2", async () => {
        console.log("swap2");
        const tokenSwap2 =
          await tokenSwapModuleInstance.getTokenswapFromMetadata(METADATA2);
        // console.log("swap2");
        // console.log(tokenSwap2);
        // console.log(tokenSwap2);
        expect(tokenSwap2.daos).to.eql(createSwapParametersArray[1][0]);
        expect(tokenSwap2.tokens).to.eql(createSwapParametersArray[1][1]);
        expect(tokenSwap2.executionDate).to.equal(0);
        expect(tokenSwap2.metadata).to.equal(createSwapParametersArray[1][4]);
        expect(tokenSwap2.deadline).to.eql(createSwapParametersArray[1][5]);
        expect(tokenSwap2.status).to.equal(1);
      });
      it("» succeeds with valid metadata1", async () => {
        console.log("swap3");
        const tokenSwap3 =
          await tokenSwapModuleInstance.getTokenswapFromMetadata(METADATA3);
        expect(tokenSwap3.daos).to.eql(createSwapParametersArray[2][0]);
        expect(tokenSwap3.tokens).to.eql(createSwapParametersArray[2][1]);
        expect(tokenSwap3.executionDate).to.equal(0);
        expect(tokenSwap3.metadata).to.equal(createSwapParametersArray[2][4]);
        expect(tokenSwap3.deadline).to.eql(createSwapParametersArray[2][5]);
        expect(tokenSwap3.status).to.equal(1);
      });
    });
  });
  describe("$ Function: getTokenswapFromId", () => {
    describe("# when not able to execute", () => {
      beforeEach(async () => {
        ({ tokenSwapModuleInstance, depositContractInstances } =
          await setupCreateSwapState(
            contractInstances,
            daosDeal1,
            createSwapParameters
          ));
      });
      it("» fails with invalid id", async () => {
        await expect(
          tokenSwapModuleInstance.getTokenswapFromId(INVALID_SWAP)
        ).to.revertedWith("Module: id doesn't exist");
      });
    });
    describe("# when able to execute", () => {
      beforeEach(async () => {
        ({
          tokenSwapModuleInstance,
          depositContractInstances,
          createSwapParametersArray,
        } = await setupMultipleCreateSwapStates(
          contractInstances,
          allDaos,
          METADATAS,
          tokenAddresses,
          createSwapParameters
        ));
      });
      it("» succeeds with valid id1", async () => {
        const tokenSwap1 = await tokenSwapModuleInstance.getTokenswapFromId(
          SWAP1
        );
        expect(tokenSwap1.daos).to.eql(createSwapParametersArray[0][0]);
        expect(tokenSwap1.tokens).to.eql(createSwapParametersArray[0][1]);
        expect(tokenSwap1.executionDate).to.equal(0);
        expect(tokenSwap1.metadata).to.equal(createSwapParametersArray[0][4]);
        expect(tokenSwap1.deadline).to.eql(createSwapParametersArray[0][5]);
        expect(tokenSwap1.status).to.equal(1);
      });
      it("» succeeds with valid id1", async () => {
        const tokenSwap2 = await tokenSwapModuleInstance.getTokenswapFromId(
          SWAP2
        );
        expect(tokenSwap2.daos).to.eql(createSwapParametersArray[1][0]);
        expect(tokenSwap2.tokens).to.eql(createSwapParametersArray[1][1]);
        expect(tokenSwap2.executionDate).to.equal(0);
        expect(tokenSwap2.metadata).to.equal(createSwapParametersArray[1][4]);
        expect(tokenSwap2.deadline).to.eql(createSwapParametersArray[1][5]);
        expect(tokenSwap2.status).to.equal(1);
      });
      it("» succeeds with valid id1", async () => {
        const tokenSwap3 = await tokenSwapModuleInstance.getTokenswapFromId(
          SWAP3
        );
        expect(tokenSwap3.daos).to.eql(createSwapParametersArray[2][0]);
        expect(tokenSwap3.tokens).to.eql(createSwapParametersArray[2][1]);
        expect(tokenSwap3.executionDate).to.equal(0);
        expect(tokenSwap3.metadata).to.equal(createSwapParametersArray[2][4]);
        expect(tokenSwap3.deadline).to.eql(createSwapParametersArray[2][5]);
        expect(tokenSwap3.status).to.equal(1);
      });
    });
  });
});
