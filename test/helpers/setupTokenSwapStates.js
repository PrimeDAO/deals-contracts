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

const getDepositContractsFromDAOArray = async (
  baseContractInstance,
  allDaos
) => {
  let depositContractInstances = [];

  for (let i = 0; i < allDaos.length; i++) {
    depositContractInstances.push(
      await baseContractInstance.depositContract(allDaos[i].address)
    );
  }
  return depositContractInstances;
};

const callCreateSwap = async (
  baseContractInstance,
  tokenSwapModuleInstance,
  createSwapParameters
) => {
  await tokenSwapModuleInstance.createSwap(...createSwapParameters);

  return getDepositContractsFromDAOArray(
    baseContractInstance,
    createSwapParameters[0]
  );
};

const getDepositContractInstancesForSingleDeal = async (
  depositContractInstances,
  createSwapParameters
) => {
  let depositContractInstancesSubset = [];
  for (let i = 0; i < createSwapParameters[0].length; i++) {
    for (let j = 0; j < depositContractInstances.length; j++) {
      if (depositContractInstances[j].dao() == createSwapParameters[0][i]) {
        depositContractInstancesSubset.push(createSwapParameters[0][i]);
        break;
      }
    }
  }
  return depositContractInstancesSubset;
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

const getDAODepositContractFromDepositContractArray = async (
  depositContractInstancesSubset,
  daoAddress
) => {
  for (let i = 0; i < depositContractInstancesSubset.length; i++) {
    if ((await depositContractInstancesSubset[i].dao()) == daoAddress) {
      return depositContractInstancesSubset[i];
    }
  }
};

const fundDepositContractsForSingelDeal = async (
  tokenInstances,
  createNewSwapParameters,
  depositContractSubset,
  swapID
) => {
  for (let i = 0; i < createNewSwapParameters[2].length; i++) {
    let { daoIndex, amount } = getIndex(createNewSwapParameters[2][i]);
    let depositContractInstance = getDAODepositContractFromDepositContractArray(
      depositContractSubset,
      createNewSwapParameters[0][daoIndex]
    );
    await fundDAOWithToken(
      tokenInstances[i],
      createNewSwapParameters[0][daoIndex],
      amount
    );
    await transferTokenToDepositContract(
      tokenInstances[i],
      depositContractInstance,
      createNewSwapParameters[0][daoIndex],
      amount,
      swapID
    );
  }
};

const transferTokenToDepositContract = async (
  tokenInstance,
  depositContractInstance,
  dao,
  amount,
  swapID
) => {
  const processID = await depositContractInstance.getProcessID(
    "TOKEN_SWAP_MODULE",
    swapID
  );

  await tokenInstance
    .connect(dao)
    .approve(depositContractInstance.address, amount);
  await depositContractInstance
    .connect(dao)
    .deposit(processID, tokenInstance.address, amount);
};

const fundDepositContractsForMultipleDeals = async (
  tokenInstances,
  depositContractInstances,
  allDaos,
  swapIDs,
  createSwapParametersArray
) => {
  for (let i = 0; i < swapIDs.length; i++) {
    let tokenInstancesSubset = getTokenInstancesForSingleDeal(
      tokenInstances,
      createSwapParametersArray[i]
    );
    let depositContractSubset = getDepositContractInstancesForSingleDeal(
      depositContractInstances,
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
    fundDepositContractsForSingelDeal(
      tokenInstancesSubset,
      createSwapParametersArray[i],
      depositContractSubset,
      allDaosSubset,
      swapIDs[i]
    );
  }
};

const callExecuteSwap = async (tokenSwapModuleInstance, swapIDs) => {
  for (let i = 0; i < swapIDs.length; i++) {
    await tokenSwapModuleInstance.executeSwap(swapIDs[i]);
  }
};

const fundDepositContracts = async (
  tokenInstances,
  depositContractInstances,
  daos,
  swapID,
  createSwapParameters
) => {
  const processID = await depositContractInstances[0].getProcessID(
    "TOKEN_SWAP_MODULE",
    swapID
  );

  await tokenInstances[0]
    .connect(daos[0])
    .approve(
      depositContractInstances[0].address,
      createSwapParameters[2][0][0]
    );
  await depositContractInstances[0]
    .connect(daos[0])
    .deposit(
      processID,
      tokenInstances[0].address,
      createSwapParameters[2][0][0]
    );

  await tokenInstances[1]
    .connect(daos[1])
    .approve(
      depositContractInstances[1].address,
      createSwapParameters[2][1][1]
    );
  await depositContractInstances[1]
    .connect(daos[1])
    .deposit(
      processID,
      tokenInstances[1].address,
      createSwapParameters[2][1][1]
    );

  await tokenInstances[2]
    .connect(daos[2])
    .approve(
      depositContractInstances[2].address,
      createSwapParameters[2][2][2]
    );
  await depositContractInstances[2]
    .connect(daos[2])
    .deposit(
      processID,
      tokenInstances[2].address,
      createSwapParameters[2][2][2]
    );

  await tokenInstances[3]
    .connect(daos[2])
    .approve(
      depositContractInstances[2].address,
      createSwapParameters[2][3][2]
    );
  await depositContractInstances[2]
    .connect(daos[2])
    .deposit(
      processID,
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

module.exports = {
  setupMultipleCreateSwapStates,
  fundDepositContracts,
  initializeParameters,
  setupExecuteSwapState,
  fundDAOWithToken,
  setupCreateSwapState,
  callCreateSwap,
};
