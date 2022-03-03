// const { expect } = require("chai");
// const { ethers, deployments } = require("hardhat");
// const { parseEther, parseUnits } = ethers.utils;
// const {
//   constants: { ZERO_ADDRESS },
//   time,
// } = require("@openzeppelin/test-helpers");
// const { BigNumber } = require("@ethersproject/bignumber");

// const tokens = require("../helpers/tokens.js");

// const setupFixture = deployments.createFixture(
//   async ({ deployments }, options) => {
//     const { deploy } = deployments;
//     const { root } = await ethers.getNamedSigners();

//     await deploy("BaseContract", {
//       contract: "BaseContract",
//       from: root.address,
//       log: true,
//     });

//     await deploy("DepositContract", {
//       contract: "DepositContract",
//       from: root.address,
//       log: true,
//     });

//     await deploy("WETH", {
//       contract: "ERC20Mock",
//       from: root.address,
//       args: ["Wrapped Ether", "WETH"],
//       logs: true,
//     });

//     const depositContractInstance = await ethers.getContract("DepositContract");
//     const baseContractInstance = await ethers.getContract("BaseContract");
//     const wethInstance = await ethers.getContract("WETH");

//     await baseContractInstance.setWETHAddress(wethInstance.address);
//     await baseContractInstance.setDepositContractImplementation(
//       depositContractInstance.address
//     );

//     const contractInstances = {
//       baseContractInstance: await ethers.getContract("BaseContract"),
//       tokenInstances: await tokens.getErc20TokenInstances(2, root),
//     };

//     return { ...contractInstances };
//   }
// );

// describe.only("> Contract: DepositContract", () => {
//   let root, baseContractMock, dao, depositer1, depositer2;
//   let tokenAddresses;
//   let depositContractInstance,
//     tokenInstances,
//     wethInstance,
//     baseContractInstance;

//   before(async () => {
//     const signers = await ethers.getSigners();
//     [root, baseContractMock, dao, depositer1, depositer2] = signers;
//   });

//   beforeEach(async () => {
//     contractInstances = await setupFixture();
//     ({ baseContractInstance, tokenInstances } = contractInstances);

//     tokenAddresses = tokenInstances.map((token) => token.address);
//   });
//   describe("$ Create a DepositContract", () => {
//     describe("# When initializing with invalid parameters", () => {
//       it("» fails on invalid DAO address", async () => {
//         await expect(
//           baseContractInstance.createDepositContract(ZERO_ADDRESS)
//         ).to.be.revertedWith("BASECONTRACT-INVALID-DAO-ADDRESS");
//       });
//     });
//     describe("# When initializing with valid parameters", () => {
//       await depositContractInstance.connect(baseContractMock);
//     });
//   });
// });
