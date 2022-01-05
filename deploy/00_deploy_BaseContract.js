const deployFunction = async ({ getNamedAccounts, deployments, ethers }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  await deploy("DepositContract", {
    from: root,
    log: true,
  });

  const depositContractInstance = await ethers.getContract("DepositContract");

  await deploy("BaseContract", {
    from: root,
    log: true,
  });

  const baseContractInstance = await ethers.getContract("BaseContract");

  await baseContractInstance.setDepositContractImplementation(
    depositContractInstance.address
  );
};

module.exports = deployFunction;
module.exports.tags = ["TokenSwap"];
