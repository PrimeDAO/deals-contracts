const deployFunction = async ({ getNamedAccounts, deployments, ethers }) => {
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  const baseContractInstance = await ethers.getContract("BaseContract");

  await deploy("TokenSwapModule", {
    from: root,
    args: [baseContractInstance.address],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["TokenSwap"];
