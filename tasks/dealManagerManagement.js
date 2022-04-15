const { task } = require("hardhat/config");

task(
  "activateModule",
  "will activate a new module in the DealManager contract "
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

task("setDaoDepositManager", "will set a new DaoDepositManager implementation")
  .addParam(
    "address",
    "address of the new DaoDepositManager implementation",
    undefined,
    types.string
  )
  .setAction(async ({ address }, { ethers }) => {
    const dealMangerInstance = await ethers.getContract("DealManager");
    await dealMangerInstance.setDaoDepositManagerImplementation(address);
    console.log(
      `New DaoDepositManager implementation with address ${address} has been set `
    );
  });
