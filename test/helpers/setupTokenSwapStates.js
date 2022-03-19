const { ethers, deployments } = require("hardhat");
const { parseEther } = ethers.utils;

const initializeParameters = (
  daos,
  tokens,
  pathFrom,
  PathTo,
  metadata,
  deadline
) => {
  return [daos, tokens, pathFrom, PathTo, metadata, deadline];
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
};
