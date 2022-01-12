const deployFunction = async ({ getNamedAccounts, deployments, network }) => {
  console.log(`Deploying on network ${network.name}`);
  const { deploy } = deployments;
  const { root } = await getNamedAccounts();

  await deploy("Prime", {
    contract: "PrimeToken",
    from: root,
    args: [],
    log: true,
  });
};

module.exports = deployFunction;
module.exports.tags = ["Prime"];
