const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");
const { parseEther, parseUnits } = ethers.utils;
const {
  constants: { ZERO_ADDRESS },
  time,
} = require("@openzeppelin/test-helpers");
const { BigNumber } = require("@ethersproject/bignumber");

const tokens = require("../helpers/tokens.js");
const { joinSignature, formatUnits } = require("ethers/lib/utils");

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

const setupPathFrom = () => [
  [parseEther("6"), 0, 0],
  [0, parseEther("6"), 0],
  [0, 0, parseEther("6")],
  [0, 0, parseEther("10")],
];

const setupPathTo = (vestingCliff, vestingDuration) => [
  [
    0,
    0,
    0,
    0,
    parseEther("1"),
    parseEther("2"),
    vestingCliff,
    vestingDuration,
    parseEther("1"),
    parseEther("2"),
    vestingCliff,
    vestingDuration,
  ],
  [
    parseEther("1"),
    parseEther("2"),
    vestingCliff,
    vestingDuration,
    0,
    0,
    0,
    0,
    parseEther("1"),
    parseEther("2"),
    vestingCliff,
    vestingDuration,
  ],
  [parseEther("3"), 0, 0, 0, parseEther("3"), 0, 0, 0, 0, 0, 0, 0],
  [parseEther("5"), 0, 0, 0, parseEther("5"), 0, 0, 0, 0, 0, 0, 0],
];

const parameterGenerator = {};
parameterGenerator.initializeParameters = (
  daos,
  tokens,
  pathFrom,
  PathTo,
  deadline
) => [daos, tokens, pathFrom, PathTo, deadline];

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

const fundDepositContracts = async (
  tokenInstances,
  depositContractInstances,
  daos,
  swapID
) => {
  const processID = await depositContractInstances[0].getProcessID(
    "TOKEN_SWAP_MODULE",
    swapID
  );

  await tokenInstances[0]
    .connect(daos[0])
    .approve(depositContractInstances[0].address, parseEther("6"));
  await depositContractInstances[0]
    .connect(daos[0])
    .deposit(processID, tokenInstances[0].address, parseEther("6"));

  await tokenInstances[1]
    .connect(daos[1])
    .approve(depositContractInstances[1].address, parseEther("6"));
  await depositContractInstances[1]
    .connect(daos[1])
    .deposit(processID, tokenInstances[1].address, parseEther("6"));

  await tokenInstances[2]
    .connect(daos[2])
    .approve(depositContractInstances[2].address, parseEther("6"));
  await depositContractInstances[2]
    .connect(daos[2])
    .deposit(processID, tokenInstances[2].address, parseEther("6"));

  await tokenInstances[3]
    .connect(daos[2])
    .approve(depositContractInstances[2].address, parseEther("10"));
  await depositContractInstances[2]
    .connect(daos[2])
    .deposit(processID, tokenInstances[3].address, parseEther("10"));
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
    swapID
  );
  return { tokenSwapModuleInstance, tokenInstances };
};

describe.only("> Contract: TokenSwapModule", () => {
  let root, prime, dao1, dao2, dao3, dao4, daos;
  let tokenAddresses;
  let createSwapParameters;
  let baseContractInstance, tokenSwapModuleInstance, tokenInstances;
  let depositContractInstances;
  let deadline;

  const MONTH = 60 * 60 * 24 * 31;
  const DAY = 60 * 60 * 24;
  const HOUR = 60 * 60;
  const VESTING_CLIFF = HOUR * 2;
  const VESTING_DURATION = DAY;
  const SWAP1 = 0;
  const SWAP2 = 1;
  const INVALID_SWAP = 20;

  before(async () => {
    const signers = await ethers.getSigners();
    [root, prime, dao1, dao2, dao3, dao4] = signers;
    daos = [dao1, dao2, dao3];
  });

  beforeEach(async () => {
    contractInstances = await setupFixture();
    ({ baseContractInstance, tokenSwapModuleInstance, tokenInstances } =
      contractInstances);

    tokenAddresses = tokenInstances.map((token) => token.address);
    deadline = BigNumber.from((await time.latest()).toNumber() + DAY * 7);

    createSwapParameters = parameterGenerator.initializeParameters(
      [dao1.address, dao2.address, dao3.address],
      [
        tokenAddresses[0],
        tokenAddresses[1],
        tokenAddresses[2],
        tokenAddresses[3],
      ],
      setupPathFrom(),
      setupPathTo(VESTING_CLIFF, VESTING_DURATION),
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
        ];

        await expect(
          tokenSwapModuleInstance.createSwap(...invalidParameters)
        ).to.be.revertedWith("Module: at least 2 daos required");
      });
      it("» fails on number of tokens is 0", async () => {
        const invalidParameters = [
          createSwapParameters[0],
          [],
          createSwapParameters[2],
          createSwapParameters[3],
          createSwapParameters[4],
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
        ];
        const invalidLengthTokensAndPathTo = [
          createSwapParameters[0],
          createSwapParameters[1],
          createSwapParameters[2],
          [...createSwapParameters[3], [0, 0, 0, 0]],
          createSwapParameters[4],
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
      it("» succeeds in creating multiple swaps", async () => {
        const differentDAOs = [dao1.address, dao3.address, dao4.address];

        await expect(
          tokenSwapModuleInstance.createSwap(
            differentDAOs,
            createSwapParameters[1],
            createSwapParameters[2],
            createSwapParameters[3],
            createSwapParameters[4]
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
    });
  });
  describe("$ Function: checkExecutability", () => {
    describe("# invalid parameters", () => {
      beforeEach(async () => {
        ({ tokenSwapModuleInstance } = await setupCreateSwapState(
          contractInstances,
          daos,
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
          daos,
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
        ({ tokenSwapModuleInstance } = await setupExecuteSwapState(
          contractInstances,
          daos,
          createSwapParameters,
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
          daos,
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
            daos,
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
        ({ tokenSwapModuleInstance } = await setupExecuteSwapState(
          contractInstances,
          daos,
          createSwapParameters,
          SWAP1
        ));
        await tokenSwapModuleInstance.executeSwap(SWAP1);
        await expect(
          tokenSwapModuleInstance.executeSwap(SWAP1)
        ).to.revertedWith("Module: id not active");
      });
    });
    describe("# when");
    describe("# when able to execute", () => {
      beforeEach(async () => {
        ({ tokenSwapModuleInstance, tokenInstances } =
          await setupExecuteSwapState(
            contractInstances,
            daos,
            createSwapParameters,
            SWAP1
          ));
      });
      it("» succeeds in executing the swap", async () => {
        // Balance before swap
        expect(await tokenInstances[0].balanceOf(daos[0].address)).to.equal(
          parseEther("4")
        );
        expect(await tokenInstances[1].balanceOf(daos[1].address)).to.equal(
          parseEther("4")
        );
        expect(await tokenInstances[2].balanceOf(daos[2].address)).to.equal(
          parseEther("4")
        );
        expect(await tokenInstances[3].balanceOf(daos[2].address)).to.equal(
          parseEther("0")
        );

        // Execute swap
        await expect(tokenSwapModuleInstance.executeSwap(SWAP1))
          .to.emit(tokenSwapModuleInstance, "TokenSwapExecuted")
          .withArgs(SWAP1);

        // Balance after swap

        // Token 1
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[0].balanceOf(daos[0].address),
              "ether"
            )
          )
        ).to.equal(4);
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[0].balanceOf(daos[1].address),
              "ether"
            )
          )
        ).to.equal(1);
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[0].balanceOf(daos[2].address),
              "ether"
            )
          )
        ).to.equal(1);

        // Token 2
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[1].balanceOf(daos[0].address),
              "ether"
            )
          )
        ).to.equal(1);
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[1].balanceOf(daos[1].address),
              "ether"
            )
          )
        ).to.equal(4);
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[1].balanceOf(daos[2].address),
              "ether"
            )
          )
        ).to.equal(1);

        // Token 3
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[2].balanceOf(daos[0].address),
              "ether"
            )
          )
        ).to.equal(3);
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[2].balanceOf(daos[1].address),
              "ether"
            )
          )
        ).to.equal(3);
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[2].balanceOf(daos[2].address),
              "ether"
            )
          )
        ).to.equal(4);

        // Token 4
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[3].balanceOf(daos[0].address),
              "ether"
            )
          )
        ).to.equal(5);
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[3].balanceOf(daos[1].address),
              "ether"
            )
          )
        ).to.equal(5);
        expect(
          Math.round(
            formatUnits(
              await tokenInstances[3].balanceOf(daos[2].address),
              "ether"
            )
          )
        ).to.equal(0);
      });
    });
  });
  describe("$ Function: claimVesting", () => {
    describe("# when not able to execute", () => {});
  });
});
