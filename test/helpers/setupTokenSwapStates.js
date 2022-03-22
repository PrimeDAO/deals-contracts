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

const getIndex = (tokenPath) => {
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
    if ((await daoDepositManagerInstancesSubset[i].dao()) == daoAddress) {
      return daoDepositManagerInstancesSubset[i];
    }
  }
};

const fundDaoDepositManagerForSingelDeal = async (
  tokenInstances,
  createNewSwapParameters,
  daoDepositManagerSubset,
  moduleAddress,
  swapID
) => {
  for (let i = 0; i < createNewSwapParameters[2].length; i++) {
    let { daoIndex, amount } = getIndex(createNewSwapParameters[2][i]);
    let daoDepositManagerInstance =
      getdaoDepositManagerFromDepositContractArray(
        daoDepositManagerSubset,
        createNewSwapParameters[0][daoIndex]
      );
    await fundDAOWithToken(
      tokenInstances[i],
      createNewSwapParameters[0][daoIndex],
      amount
    );
    await transferTokenToDaoDepositManager(
      tokenInstances[i],
      daoDepositManagerInstance,
      createNewSwapParameters[0][daoIndex],
      amount,
      moduleAddress,
      swapID
    );
  }
};

const transferTokenToDaoDepositManager = async (
  tokenInstance,
  daoDepositManagerInstance,
  dao,
  amount,
  moduleAddress,
  swapID
) => {
  await tokenInstance
    .connect(dao)
    .approve(daoDepositManagerInstance.address, amount);
  await daoDepositManagerInstance
    .connect(dao)
    .deposit(moduleAddress, swapID, tokenInstance.address, amount);
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
    fundDaoDepositManagerForSingelDeal(
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

const fundDaoDepositManager = async (
  tokenInstances,
  daoDepositManagerInstances,
  daos,
  moduleAddress,
  swapID,
  createSwapParameters
) => {
  await tokenInstances[0]
    .connect(daos[0])
    .approve(
      daoDepositManagerInstances[0].address,
      createSwapParameters[2][0][0]
    );
  await daoDepositManagerInstances[0]
    .connect(daos[0])
    .deposit(
      moduleAddress,
      swapID,
      tokenInstances[0].address,
      createSwapParameters[2][0][0]
    );

  await tokenInstances[1]
    .connect(daos[1])
    .approve(
      daoDepositManagerInstances[1].address,
      createSwapParameters[2][1][1]
    );
  await daoDepositManagerInstances[1]
    .connect(daos[1])
    .deposit(
      moduleAddress,
      swapID,
      tokenInstances[1].address,
      createSwapParameters[2][1][1]
    );

  await tokenInstances[2]
    .connect(daos[2])
    .approve(
      daoDepositManagerInstances[2].address,
      createSwapParameters[2][2][2]
    );
  await daoDepositManagerInstances[2]
    .connect(daos[2])
    .deposit(
      moduleAddress,
      swapID,
      tokenInstances[2].address,
      createSwapParameters[2][2][2]
    );

  await tokenInstances[3]
    .connect(daos[2])
    .approve(
      daoDepositManagerInstances[2].address,
      createSwapParameters[2][3][2]
    );
  await daoDepositManagerInstances[2]
    .connect(daos[2])
    .deposit(
      moduleAddress,
      swapID,
      tokenInstances[3].address,
      createSwapParameters[2][3][2]
    );
};

const setupExecuteSwapState = async (
  contractInstances,
  daos,
  createSwapParameters,
  swapID
) => {
  const DAO_TOKEN_AMOUNT = "10";

  const { tokenSwapModuleInstance, daoDepositManagerInstances } =
    await setupCreateSwapState(contractInstances, daos, createSwapParameters);
  const { tokenInstances } = contractInstances;

  await fundDAOWithToken(tokenInstances[0], daos[0], DAO_TOKEN_AMOUNT);
  await fundDAOWithToken(tokenInstances[1], daos[1], DAO_TOKEN_AMOUNT);
  await fundDAOWithToken(tokenInstances[2], daos[2], DAO_TOKEN_AMOUNT);
  await fundDAOWithToken(tokenInstances[3], daos[2], DAO_TOKEN_AMOUNT);

  await fundDaoDepositManager(
    tokenInstances,
    daoDepositManagerInstances,
    daos,
    tokenSwapModuleInstance.address,
    swapID,
    createSwapParameters
  );
  return { tokenSwapModuleInstance, tokenInstances };
};

const fundDAOWithToken = async (tokenInstance, dao, amount) => {
  await tokenInstance.transfer(dao.address, parseEther(amount));
};

const setupCreateSwapState = async (
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
    tokenSwapModuleInstance,
    daoDepositManagerInstances,
  };
};

module.exports = {
  setupMultipleCreateSwapStates,
  fundDaoDepositManager,
  initializeParameters,
  setupExecuteSwapState,
  fundDAOWithToken,
  setupCreateSwapState,
  callCreateSwap,
};
