const deployFunction = async ({ getNamedAccounts, deployments, ethers }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  const daoDepositManagerInstance = await ethers.getContract(
    "DaoDepositManager"
  );

  await deploy("DealManager", {
    from: root,
    args: [daoDepositManagerInstance.address],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["DealManager"];
