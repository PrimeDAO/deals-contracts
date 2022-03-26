const { ethers } = require("hardhat");
const { parseEther } = ethers.utils;

const initializeParameters = (
  daos,
  tokens,
  pathFrom,
  pathTo,
  metadata,
  deadline
) => {
  return [daos, tokens, pathFrom, pathTo, metadata, deadline];
};

// Still need to replace
const setupMultipleCreateSwapStates = async (
  contractInstances,
  allDaos,
  metadatas,
  tokenAddresses,
  createSwapParameters
) => {
  const {
    tokenSwapModuleInstance,
    dealManagerInstance,
    daoDepositManagerFactoryInstance,
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

  const daoDepositManagerInstanceDAO1 =
    await daoDepositManagerFactoryInstance.attach(
      await dealManagerInstance.daoDepositManager(allDaos[0].address)
    );
  const daoDepositManagerInstanceDAO2 =
    await daoDepositManagerFactoryInstance.attach(
      await dealManagerInstance.daoDepositManager(allDaos[1].address)
    );
  const daoDepositManagerInstanceDAO3 =
    await daoDepositManagerFactoryInstance.attach(
      await dealManagerInstance.daoDepositManager(allDaos[2].address)
    );
  const daoDepositManagerInstanceDAO4 =
    await daoDepositManagerFactoryInstance.attach(
      await dealManagerInstance.daoDepositManager(allDaos[3].address)
    );
  const daoDepositManagerInstanceDAO5 =
    await daoDepositManagerFactoryInstance.attach(
      await dealManagerInstance.daoDepositManager(allDaos[4].address)
    );

  const daoDepositManagerInstances = [
    daoDepositManagerInstanceDAO1,
    daoDepositManagerInstanceDAO2,
    daoDepositManagerInstanceDAO3,
    daoDepositManagerInstanceDAO4,
    daoDepositManagerInstanceDAO5,
  ];

  return {
    tokenSwapModuleInstance,
    daoDepositManagerInstances,
    createSwapParametersArray,
  };
};

const getdaoDepositManagerFromDAOArray = async (
  dealManagerInstance,
  allDaos
) => {
  let daoDepositManagerInstances = [];

  for (let i = 0; i < allDaos.length; i++) {
    daoDepositManagerInstances.push(
      await dealManagerInstance.daoDepositManager(allDaos[i].address)
    );
  }
  return daoDepositManagerInstances;
};

const callCreateSwap = async (
  dealManagerInstance,
  tokenSwapModuleInstance,
  createSwapParameters
) => {
  await tokenSwapModuleInstance.createSwap(...createSwapParameters);

  return getdaoDepositManagerFromDAOArray(
    dealManagerInstance,
    createSwapParameters[0]
  );
};

const getdaoDepositManagerInstancesForSingleDeal = async (
  daoDepositManagerInstances,
  createSwapParameters
) => {
  let daoDepositManagerInstancesSubset = [];
  for (let i = 0; i < createSwapParameters[0].length; i++) {
    for (let j = 0; j < daoDepositManagerInstances.length; j++) {
      if (daoDepositManagerInstances[j].dao() == createSwapParameters[0][i]) {
        daoDepositManagerInstancesSubset.push(createSwapParameters[0][i]);
        break;
      }
    }
  }
  return daoDepositManagerInstancesSubset;
};

const getDAOSignersForSingleDeal = async (allDaos, daoAddresses) => {
  let allDaosSubset = [];
  for (let i = 0; i < daoAddresses.length; i++) {
    for (let j = 0; j < allDaos.length; j++) {
      if (allDaos[j].address == daoAddresses[i]) {
        allDaosSubset.push(allDaos[j]);
        break;
      }
    }
  }
  return allDaosSubset;
};

const getTokenInstancesForSingleDeal = (
  tokenInstances,
  createSwapParameters
) => {
  let tokenInstancesSubset = [];
  for (let i = 0; i < createSwapParameters[1].length; i++) {
    for (let j = 0; j < tokenInstances.length; j++) {
      if (createSwapParameters[1][i] == tokenInstances[j].address) {
        tokenInstancesSubset.push(tokenInstances[j]);
        break;
      }
    }
  }
  return tokenInstancesSubset;
};

const getIndexOfNoneZeroAmount = (tokenPath) => {
  for (let i = 0; i < tokenPath.length; i++)
    if (tokenPath[i] != 0) {
      return { daoIndex: i, amount: tokenPath[i] };
    }
};

const getdaoDepositManagerFromDepositContractArray = async (
  daoDepositManagerInstancesSubset,
  daoAddress
) => {
  for (let i = 0; i < daoDepositManagerInstancesSubset.length; i++) {
    let depositAddress = await daoDepositManagerInstancesSubset[i].dao();
    if (depositAddress == daoAddress) {
      return daoDepositManagerInstancesSubset[i];
    }
  }
};

const fundDaoDepositManagersForSingelDeal = async (
  tokenInstances,
  createNewSwapParameters,
  daoDepositManagerSubset,
  moduleAddress,
  swapID,
  depositer
) => {
  let daoDepositManagerInstances = [];
  for (let i = 0; i < createNewSwapParameters[2].length; i++) {
    let { daoIndex, amount } = getIndexOfNoneZeroAmount(
      createNewSwapParameters[2][i]
    );

    let daoDepositManagerInstance =
      await getdaoDepositManagerFromDepositContractArray(
        daoDepositManagerSubset,
        createNewSwapParameters[0][daoIndex]
      );

    await fundDepositerWithToken(tokenInstances[i], depositer, amount);

    daoDepositManagerInstance = await transferTokenToDaoDepositManager(
      tokenInstances[i],
      daoDepositManagerInstance,
      depositer,
      amount,
      moduleAddress,
      swapID
    );
    if (!daoDepositManagerInstances.includes(daoDepositManagerInstance, 0)) {
      daoDepositManagerInstances.push(daoDepositManagerInstance);
    }
  }
  return { daoDepositManagerInstances };
};
const approveTokenForDaoDepositManager = async (
  tokenInstance,
  depositer,
  daoDepositManagerInstance,
  amount
) => {
  await tokenInstance
    .connect(depositer)
    .approve(daoDepositManagerInstance.address, amount);
};

// Approves multiple tokens and amounts for a single daoDealManager
const approveAllDealTokensForDaoDepositManagerSingleDeal = async (
  tokenInstances,
  depositors,
  amounts,
  daoDepositManagerInstance
) => {
  for (let i = 0; i < tokenInstances.length; i++) {
    await approveTokenForDaoDepositManager(
      tokenInstances[i],
      depositors[i],
      daoDepositManagerInstance,
      amounts[i]
    );
  }
};

const transferTokenToDaoDepositManager = async (
  tokenInstance,
  daoDepositManagerInstance,
  depositer,
  amount,
  moduleAddress,
  swapID
) => {
  await approveTokenForDaoDepositManager(
    tokenInstance,
    depositer,
    daoDepositManagerInstance,
    amount
  );

  await daoDepositManagerInstance
    .connect(depositer)
    .deposit(moduleAddress, swapID, tokenInstance.address, amount);
  return daoDepositManagerInstance;
};

const fundDaoDepositManagerForMultipleDeals = async (
  tokenInstances,
  daoDepositManagerInstances,
  tokenSwapModuleInstance,
  allDaos,
  swapIDs,
  createSwapParametersArray
) => {
  for (let i = 0; i < swapIDs.length; i++) {
    let tokenInstancesSubset = getTokenInstancesForSingleDeal(
      tokenInstances,
      createSwapParametersArray[i]
    );
    let daoDepositManagerSubset = getdaoDepositManagerInstancesForSingleDeal(
      daoDepositManagerInstances,
      createSwapParametersArray[i]
    );
    let allDaosSubset = getDAOSignersForSingleDeal(
      allDaos,
      createSwapParametersArray[i][0]
    );
    await transferTokensToDAOForSingleDeal(
      tokenInstancesSubset,
      createSwapParametersArray[i]
    );
    fundDaoDepositManagersForSingelDeal(
      tokenInstancesSubset,
      createSwapParametersArray[i],
      daoDepositManagerSubset,
      allDaosSubset,
      tokenSwapModuleInstance.address,
      swapIDs[i]
    );
  }
};

const callExecuteSwap = async (tokenSwapModuleInstance, swapIDs) => {
  for (let i = 0; i < swapIDs.length; i++) {
    await tokenSwapModuleInstance.executeSwap(swapIDs[i]);
  }
};

const setupClaimStateSingleDeal = async (
  contractInstances,
  allDealDAOs,
  dealParameters,
  tokenInstances,
  depositer,
  dealId
) => {
  ({
    tokenInstancesSubset,
    daoDepositManagerInstances,
    tokenSwapModuleInstance,
  } = await setupExecuteSwapState(
    contractInstances,
    allDealDAOs,
    dealParameters,
    tokenInstances,
    depositer,
    dealId
  ));

  await callExecuteSwap(tokenSwapModuleInstance, [dealId]);

  return { tokenInstancesSubset, daoDepositManagerInstances };
};

const setupExecuteSwapState = async (
  contractInstances,
  allDealDAOs,
  dealParameters,
  tokenInstances,
  depositer,
  dealId
) => {
  let { tokenSwapModuleInstance } = contractInstances;

  ({ daoDepositManagerInstances } = await setupFundingStateSingleDeal(
    contractInstances,
    allDealDAOs,
    dealParameters
  ));

  const tokenInstancesSubset = getTokenInstancesForSingleDeal(
    tokenInstances,
    dealParameters
  );

  ({ daoDepositManagerInstances } = await fundDaoDepositManagersForSingelDeal(
    tokenInstancesSubset,
    dealParameters,
    daoDepositManagerInstances,
    tokenSwapModuleInstance.address,
    dealId,
    depositer
  ));

  return {
    tokenInstancesSubset,
    daoDepositManagerInstances,
    tokenSwapModuleInstance,
  };
};

const fundDepositerWithToken = async (tokenInstance, depositer, amount) => {
  await tokenInstance.transfer(depositer.address, amount);
};

// WIP
const setupFundingStateMultipleDeals = async (
  contractInstances,
  allDaos,
  createSwapParametersArray
) => {
  let daoDepositManagerInstancesMultipleDeals = [];

  for (let i = 0; i < createSwapParametersArray.length; i++) {
    ({ daoDepositManagerInstances, tokenSwapModuleInstance } =
      await setupFundingStateSingleDeal(
        contractInstances,
        allDaos[i],
        createSwapParametersArray[i]
      ));
    console.log(daoDepositManagerInstances[0].address);

    for (let i = 0; i < daoDepositManagerInstances.length; i++) {
      if (
        !daoDepositManagerInstancesMultipleDeals.includes(
          daoDepositManagerInstances[i],
          0
        )
      ) {
        daoDepositManagerInstancesMultipleDeals.push(
          daoDepositManagerInstances[i]
        );
      }
    }
  }
  console.log(daoDepositManagerInstancesMultipleDeals[0][0]);

  return { daoDepositManagerInstancesMultipleDeals, tokenSwapModuleInstance };
};

const setupFundingStateSingleDeal = async (
  contractInstances,
  daos,
  createSwapParameters
) => {
  const {
    tokenSwapModuleInstance,
    dealManagerInstance,
    daoDepositManagerFactoryInstance,
  } = contractInstances;

  await tokenSwapModuleInstance.createSwap(...createSwapParameters);

  const daoDepositManagerInstanceDAO1 =
    await daoDepositManagerFactoryInstance.attach(
      await dealManagerInstance.daoDepositManager(daos[0].address)
    );
  const daoDepositManagerInstanceDAO2 =
    await daoDepositManagerFactoryInstance.attach(
      await dealManagerInstance.daoDepositManager(daos[1].address)
    );
  const daoDepositManagerInstanceDAO3 =
    await daoDepositManagerFactoryInstance.attach(
      await dealManagerInstance.daoDepositManager(daos[2].address)
    );

  const daoDepositManagerInstances = [
    daoDepositManagerInstanceDAO1,
    daoDepositManagerInstanceDAO2,
    daoDepositManagerInstanceDAO3,
  ];

  return {
    daoDepositManagerInstances,
    tokenSwapModuleInstance,
  };
};

module.exports = {
  callCreateSwap,
  initializeParameters,
  setupExecuteSwapState,
  fundDepositerWithToken,
  setupClaimStateSingleDeal,
  setupFundingStateSingleDeal,
  setupMultipleCreateSwapStates,
  setupFundingStateMultipleDeals,
  getTokenInstancesForSingleDeal,
  transferTokenToDaoDepositManager,
  approveTokenForDaoDepositManager,
  fundDaoDepositManagersForSingelDeal,
  fundDaoDepositManagerForMultipleDeals,
  approveAllDealTokensForDaoDepositManagerSingleDeal,
};
