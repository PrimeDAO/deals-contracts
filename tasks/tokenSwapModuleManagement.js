const { task } = require("hardhat/config");
const { parseEther, formatBytes32String } = require("ethers/lib/utils");
const {
  registrations,
} = require("../test/test-input/test-network-config.json");
const { BigNumber } = require("ethers");

const constructParameters = (deal) => {
  let tokens = [];
  let pathTo = [];
  let pathFrom = [];
  const zero = 0;
  const fourZeros = [0, 0, 0, 0];

  for (let i = 0; i < deal.primaryDAO.tokens.length; i++) {
    if (tokens.includes(deal.primaryDAO.tokens[i].address) == false) {
      tokens.push(deal.primaryDAO.tokens[i].address);
      pathFrom.push([parseEther(deal.primaryDAO.tokens[i].amount), zero]);
      pathTo.push([
        ...fourZeros,
        parseEther(deal.primaryDAO.tokens[i].instantTransferAmount),
        parseEther(deal.primaryDAO.tokens[i].vestedTransferAmount),
        deal.primaryDAO.tokens[i].cliffOf,
        deal.primaryDAO.tokens[i].vestedFor,
      ]);
    }
  }
  for (let i = 0; i < deal.partnerDAO.tokens.length; i++) {
    if (tokens.includes(deal.partnerDAO.tokens[i].address) == false) {
      tokens.push(deal.partnerDAO.tokens[i].address);
      pathFrom.push([zero, parseEther(deal.partnerDAO.tokens[i].amount)]);
      pathTo.push([
        parseEther(deal.primaryDAO.tokens[i].instantTransferAmount),
        parseEther(deal.primaryDAO.tokens[i].vestedTransferAmount),
        deal.primaryDAO.tokens[i].cliffOf,
        deal.primaryDAO.tokens[i].vestedFor,
        ...fourZeros,
      ]);
    }
  }
  return { tokens, pathTo, pathFrom };
};

// This task is written for these conditions:
//  - only work with 2 DAOs, named "primaryDAO" & "partnerDAO"
//  - only works with each token being unique
task("createTokenSwap", "creates a Token Swap Deal")
  .addParam(
    "registration",
    "registration number from test/test-input/test-network-config.json",
    undefined,
    types.string
  )
  .setAction(async ({ registration }, { ethers }) => {
    const tokenSwapModuleInstance = await ethers.getContract("TokenSwapModule");
    console.log(
      `Sending TokenSwapModule.createSwap() transaction to ${tokenSwapModuleInstance.address}`
    );

    //Create parameters for deal creation
    const DAY = 60 * 60 * 12;
    const deal = registrations[registration];
    const daoAddresses = [
      deal.primaryDAO.treasure_address,
      deal.partnerDAO.treasury_address,
    ];
    const { tokens, pathTo, pathFrom } = constructParameters(deal);
    const metadata = formatBytes32String(deal.metadata);
    const deadline = BigNumber.from(Math.floor(Date.now() / 1000) + DAY * 30);

    const dealParameters = [
      daoAddresses,
      tokens,
      pathFrom,
      pathTo,
      metadata,
      deadline,
    ];

    await tokenSwapModuleInstance.createSwap(...dealParameters);

    console.log("Deal creation has been succesfull");
  });

task(
  "registerNewModule",
  "will register a new module in the DealManager contract "
)
  .addParam(
    "address",
    "address of the new module to be registered",
    undefined,
    types.string
  )
  .setAction(async ({ address }, { ethers }) => {
    const dealMangerInstance = await ethers.getContract("DealManager");
    await dealMangerInstance.activateModule(address);
    console.log(
      `Module with address ${address} has been successfully registered`
    );
  });

task("deactivateModule", "will deactive a module in the DealManager contract ")
  .addParam(
    "address",
    "address of the module to be deactived",
    undefined,
    types.string
  )
  .setAction(async ({ address }, { ethers }) => {
    const dealMangerInstance = await ethers.getContract("DealManager");
    await dealMangerInstance.deactivateModule(address);
    console.log(
      `Module with address ${address} has been successfully deactivated`
    );
  });
