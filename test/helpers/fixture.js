// const { ethers, deployments } = require("hardhat");
// const tokens = require("../helpers/tokens.js");

// const DAY = 60 * 60 * 24;
// const HOUR = 60 * 60;
// const VESTING_CLIFF1 = HOUR * 2;
// const VESTING_CLIFF2 = HOUR * 4;
// const VESTING_CLIFF3 = HOUR * 6;
// const VESTING_DURATION1 = DAY;
// const VESTING_DURATION2 = DAY * 2;
// const VESTING_DURATION3 = DAY * 3;
// const SWAP1 = 0;
// const SWAP2 = 1;
// const SWAP3 = 2;
// const INVALID_SWAP = 20;
// const METADATA1 = formatBytes32String("hello");
// const METADATA2 = formatBytes32String("helloao");
// const METADATA3 = formatBytes32String("helloaodfs");
// const METADATAS = [METADATA1, METADATA2, METADATA3];

// const setupFixture = deployments.createFixture(
//   async ({ deployments }, options) => {
//     const { deploy } = deployments;
//     const [[root, prime, dao1, dao2, dao3, dao4, dao5]] =
//       await ethers.getSigners();

//     // Set up DealManager contract
//     await deploy("DealManager", {
//       contract: "DealManager",
//       from: root.address,
//       log: true,
//     });

//     await deploy("DaoDepositManager", {
//       contract: "DaoDepositManager",
//       from: root.address,
//       log: true,
//     });

//     await deploy("WETH", {
//       contract: "ERC20Mock",
//       from: root.address,
//       args: ["Wrapped Ether", "WETH"],
//       logs: true,
//     });

//     const depositContractInstance = await ethers.getContract(
//       "DaoDepositManager"
//     );
//     const dealManagerInstance = await ethers.getContract("DealManager");
//     const wethInstance = await ethers.getContract("WETH");

//     await dealManagerInstance.setWETHAddress(wethInstance.address);
//     await dealManagerInstance.setDaoDepositManagerImplementation(
//       depositContractInstance.address
//     );

//     // Set up TokenSwapModule contract
//     await deploy("TokenSwapModule", {
//       contract: "TokenSwapModule",
//       from: root.address,
//       args: [dealManagerInstance.address],
//       logs: true,
//     });

//     const tokenSwapModuleInstance = await ethers.getContract("TokenSwapModule");
//     await tokenSwapModuleInstance.setFeeWallet(prime.address);
//     await tokenSwapModuleInstance.setFee(30);

//     // Register TokenSwapModule in DealManager
//     await dealManagerInstance.registerModule(tokenSwapModuleInstance.address);

//     // Return contract instances
//     const contractInstances = {
//       dealManagerInstance: await ethers.getContract("DealManager"),
//       tokenInstances: await tokens.getErc20TokenInstances(4, root),
//       tokenSwapModuleInstance: tokenSwapModuleInstance,
//       depositContractInstance: depositContractInstance,
//       depositContractFactoryInstance: await ethers.getContractFactory(
//         "DaoDepositManager"
//       ),
//       wethInstance: wethInstance,
//     };

//     return { ...contractInstances };
//   }
// );

// module.exports = {
//   setupFixture,
// };
