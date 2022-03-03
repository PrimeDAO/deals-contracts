// const { expect } = require("chai");
// const { ethers, deployments } = require("hardhat");
// const { parseEther, parseUnits } = ethers.utils;
// const { ZERO_ADDRESS, time } = require("@openzeppelin/test-helpers");
// const { BigNumber } = require("@ethersproject/bignumber");

// const setupFixture = deployments.createFixture(
//   async ({ deployments }, options) => {
//     const { deploy } = deployments;
//     const { root } = await ethers.getNamedSigners();

//     // The below section will deploy all the contracts needed
//     await deploy("NameOfContract", {
//       contract: "NameOfContract",
//       from: root.address,
//       log: true,
//     });

//     const contractInstances = {
//       contractNameInstance: await ethers.getContract("NameOfContract"),
//       tokenInstances: await tokens.getErc20TokenInstances(2, root),
//     };

//     return { ...contractInstances };
//   }
// );

// describe("Contract: nameOfContract", () => {
//   //Place for the variables that will be used throughout the file
//   let root, beneficiary, contractNameInstance;

//   // This block gets executed before anything else in the tests,
//   // and will only be executed once. It should be used to for things that
//   // only need to be setup once.
//   before(async () => {
//     const signers = await ethers.getSigners();
//     [owner, admin, beneficiary, receiver] = signers;
//   });

//   // This block is used to setup the context for all the tests. It will reset the state
//   // to be tested
//   beforeEach(async () => {
//     contractInstances = await setupFixture();
//     ({ contractNameInstance } = contractInstances);
//   });
// });
