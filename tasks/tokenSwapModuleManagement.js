const { parseEther, formatBytes32String } = require("ethers/lib/utils");
const { task } = require("hardhat/config");
const {
  registrations,
} = require("../test/test-input/test-network-config.json");
const { time } = require("@openzeppelin/test-helpers");
const { BigNumber } = require("@ethersproject/bignumber");

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
    const deadline = BigNumber.from(
      (await time.latest()).toNumber() + DAY * 30
    );

    const dealParameters = [
      daoAddresses,
      tokens,
      pathFrom,
      pathTo,
      metadata,
      deadline,
    ];

    await tokenSwapModuleInstance.connect(root).createSwap(...dealParameters);

    console.log("Deal creation has been succesfull");
  });
