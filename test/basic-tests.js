const { expectRevert } = require("@openzeppelin/test-helpers");
const timeMachine = require("ganache-time-traveler");
const { assert } = require("hardhat");

const baseContract = artifacts.require("BaseContract");
const depositContract = artifacts.require("DepositContract");
const tokenSwapModule = artifacts.require("TokenSwapModule");
const testERC20 = artifacts.require("TestToken");

const MONTH = 60 * 60 * 24 * 31;
const DAY = 60 * 60 * 24;
const HOUR = 60 * 60;

contract("Whole rundown", async (accounts) => {
  let admin = accounts[0];
  let daos = [accounts[1], accounts[2], accounts[3]];
  let daoReps = [
    [accounts[4], accounts[5]],
    [accounts[6], accounts[7]],
    [accounts[8], accounts[9]],
  ];
  let outsider = accounts[10];

  let baseContractInstance;
  let tokenSwapInstance;

  let snapshot;

  beforeEach(async () => {
    let snapshot = await timeMachine.takeSnapshot();
    snapshotId = snapshot["result"];
  });

  afterEach(async () => {
    await timeMachine.revertToSnapshot(snapshotId);
  });

  it("deposit check", async () => {
    let depositContractInstance = await depositContract.new({
      from: admin,
    });

    let testToken1 = await testERC20.new({ from: admin });
    let testToken2 = await testERC20.new({ from: admin });
    let testToken3 = await testERC20.new({ from: admin });
    let testToken4 = await testERC20.new({ from: admin });

    baseContractInstance = await baseContract.new({ from: admin });
    await expectRevert(
      baseContractInstance.setDepositContractImplementation(
        depositContractInstance.address,
        { from: outsider }
      ),
      "Ownable: caller is not the owner"
    );

    await baseContractInstance.setDepositContractImplementation(
      depositContractInstance.address,
      { from: admin }
    );

    assert.equal(
      await baseContractInstance.depositContract(daos[0]),
      "0x0000000000000000000000000000000000000000"
    );

    await baseContractInstance.createDepositContract(daos[0], {
      from: outsider,
    });

    assert.notEqual(
      await baseContractInstance.depositContract(daos[0]),
      "0x0000000000000000000000000000000000000000"
    );

    let depositAddrDao1 = await baseContractInstance.depositContract(daos[0]);

    let depositContractDAO1 = await depositContract.at(depositAddrDao1);

    await expectRevert(
      depositContractDAO1.deposit(
        web3.utils.asciiToHex("id1"),
        testToken1.address,
        web3.utils.toWei("1", "ether"),
        { from: admin }
      ),
      "ERC20: transfer amount exceeds allowance"
    );

    await testToken1.approve(
      depositContractDAO1.address,
      web3.utils.toWei("1", "ether"),
      { from: admin }
    );

    assert.equal(
      await depositContractDAO1.getTotalDepositCount(
        web3.utils.asciiToHex("id1")
      ),
      "0"
    );

    assert.equal(
      await depositContractDAO1.getWithdrawableAmountOfUser(
        web3.utils.asciiToHex("id1"),
        admin,
        testToken1.address
      ),
      web3.utils.toWei("0", "ether")
    );

    await depositContractDAO1.deposit(
      web3.utils.asciiToHex("id1"),
      testToken1.address,
      web3.utils.toWei("1", "ether"),
      { from: admin }
    );

    assert.equal(
      await depositContractDAO1.getTotalDepositCount(
        web3.utils.asciiToHex("id1")
      ),
      "1"
    );

    assert.equal(
      await depositContractDAO1.getWithdrawableAmountOfUser(
        web3.utils.asciiToHex("id1"),
        admin,
        testToken1.address
      ),
      web3.utils.toWei("1", "ether")
    );

    assert.equal(
      await depositContractDAO1.getAvailableProcessBalance(
        web3.utils.asciiToHex("id1"),
        testToken1.address
      ),
      web3.utils.toWei("1", "ether")
    );

    await expectRevert(
      depositContractDAO1.withdraw(web3.utils.asciiToHex("id1"), [0], {
        from: outsider,
      }),
      "D2D-WITHDRAW-NOT-AUTHORIZED"
    );
    await depositContractDAO1.withdraw(web3.utils.asciiToHex("id1"), [0], {
      from: admin,
    });

    assert.equal(
      await depositContractDAO1.getAvailableProcessBalance(
        web3.utils.asciiToHex("id1"),
        testToken1.address
      ),
      web3.utils.toWei("0", "ether")
    );

    // Test SWAP

    await baseContractInstance.createDepositContract(daos[1], {
      from: outsider,
    });

    let depositAddrDao2 = await baseContractInstance.depositContract(daos[1]);

    let depositContractDAO2 = await depositContract.at(depositAddrDao2);

    await baseContractInstance.createDepositContract(daos[2], {
      from: outsider,
    });

    let depositAddrDao3 = await baseContractInstance.depositContract(daos[2]);

    let depositContractDAO3 = await depositContract.at(depositAddrDao3);

    await testToken1.transfer(daos[0], web3.utils.toWei("10", "ether"), {
      from: admin,
    });
    await testToken2.transfer(daos[1], web3.utils.toWei("10", "ether"), {
      from: admin,
    });
    await testToken3.transfer(daos[2], web3.utils.toWei("10", "ether"), {
      from: admin,
    });
    await testToken4.transfer(daos[2], web3.utils.toWei("10", "ether"), {
      from: admin,
    });
    tokenSwapInstance = await tokenSwapModule.new(
      baseContractInstance.address,
      {
        from: admin,
      }
    );

    await baseContractInstance.registerModule(tokenSwapInstance.address, {
      from: admin,
    });

    assert.equal(
      await baseContractInstance.getLatestModule("TOKEN_SWAP_MODULE"),
      tokenSwapInstance.address
    );
    let currBlockNum = await web3.eth.getBlockNumber();
    let currBlock = await web3.eth.getBlock(currBlockNum);
    let currTime = currBlock.timestamp;
    let vestingStart = currTime + HOUR;
    let vestingEnd = currTime + DAY;

    // Create Swap
    let pathFrom = [
      [web3.utils.toWei("6", "ether"), 0, 0],
      [0, web3.utils.toWei("6", "ether"), 0],
      [0, 0, web3.utils.toWei("6", "ether")],
      [0, 0, web3.utils.toWei("10", "ether")],
    ];
    let pathTo = [
      [
        0,
        0,
        0,
        0,
        web3.utils.toWei("1", "ether"), // sub(2)
        web3.utils.toWei("2", "ether"),
        vestingStart,
        vestingEnd,
        web3.utils.toWei("1", "ether"), // sub(2)
        web3.utils.toWei("2", "ether"),
        vestingStart,
        vestingEnd,
      ],
      [
        web3.utils.toWei("1", "ether"), // sub(2)
        web3.utils.toWei("2", "ether"),
        vestingStart,
        vestingEnd,
        0,
        0,
        0,
        0,
        web3.utils.toWei("1", "ether"), // sub(2)
        web3.utils.toWei("2", "ether"),
        vestingStart,
        vestingEnd,
      ],
      [
        web3.utils.toWei("3", "ether"),
        0,
        0,
        0,
        web3.utils.toWei("3", "ether"),
        0,
        0,
        0,
        0,
        0,
        0,
        0,
      ],
      [
        web3.utils.toWei("5", "ether"),
        0,
        0,
        0,
        web3.utils.toWei("5", "ether"),
        0,
        0,
        0,
        0,
        0,
        0,
        0,
      ],
    ];

    await tokenSwapInstance.createSwap(
      [daos[0], daos[1], daos[2]],
      [
        testToken1.address,
        testToken2.address,
        testToken3.address,
        testToken4.address,
      ],
      pathFrom,
      pathTo,
      currTime + DAY * 7,
      { from: daos[0] }
    );

    assert.equal(await tokenSwapInstance.checkExecutability(0), false);

    await testToken1.approve(
      depositContractDAO1.address,
      web3.utils.toWei("7", "ether"),
      { from: daos[0] }
    );

    await testToken2.approve(
      depositContractDAO2.address,
      web3.utils.toWei("6", "ether"),
      { from: daos[1] }
    );

    await testToken3.approve(
      depositContractDAO3.address,
      web3.utils.toWei("6", "ether"),
      { from: daos[2] }
    );

    await testToken4.approve(
      depositContractDAO3.address,
      web3.utils.toWei("10", "ether"),
      { from: daos[2] }
    );
    assert.equal(
      await testToken1.balanceOf(daos[0]),
      web3.utils.toWei("10", "ether")
    );

    let processID = await depositContractDAO1.getProcessID(
      "TOKEN_SWAP_MODULE",
      0
    );

    await depositContractDAO1.deposit(
      processID,
      testToken1.address,
      web3.utils.toWei("7", "ether"),
      { from: daos[0] }
    );

    assert.equal(
      await testToken1.balanceOf(daos[0]),
      web3.utils.toWei("3", "ether")
    );

    assert.equal(
      await testToken2.balanceOf(daos[1]),
      web3.utils.toWei("10", "ether")
    );

    await depositContractDAO2.deposit(
      processID,
      testToken2.address,
      web3.utils.toWei("6", "ether"),
      { from: daos[1] }
    );

    assert.equal(
      await testToken2.balanceOf(daos[1]),
      web3.utils.toWei("4", "ether")
    );

    await depositContractDAO3.deposit(
      processID,
      testToken3.address,
      web3.utils.toWei("6", "ether"),
      { from: daos[2] }
    );

    await depositContractDAO3.deposit(
      processID,
      testToken4.address,
      web3.utils.toWei("10", "ether"),
      { from: daos[2] }
    );

    assert.equal(await tokenSwapInstance.checkExecutability(0), true);

    assert.equal(
      await testToken2.balanceOf(daos[0]),
      web3.utils.toWei("0", "ether")
    );

    assert.equal(
      await testToken1.balanceOf(daos[1]),
      web3.utils.toWei("0", "ether")
    );

    await tokenSwapInstance.executeSwap(0, { from: daos[0] });

    assert.equal(
      await testToken1.balanceOf(daos[0]),
      web3.utils.toWei("3", "ether")
    );

    assert.equal(
      await testToken2.balanceOf(daos[0]),
      web3.utils.toWei("1", "ether")
    );

    assert.equal(
      await testToken3.balanceOf(daos[0]),
      web3.utils.toWei("3", "ether")
    );

    assert.equal(
      await testToken4.balanceOf(daos[0]),
      web3.utils.toWei("5", "ether")
    );

    assert.equal(
      await testToken1.balanceOf(daos[1]),
      web3.utils.toWei("1", "ether")
    );

    assert.equal(
      await depositContractDAO1.getWithdrawableAmountOfUser(
        processID,
        daos[0],
        testToken1.address
      ),
      web3.utils.toWei("1", "ether")
    );

    assert.equal(
      await testToken1.balanceOf(daos[0]),
      web3.utils.toWei("3", "ether")
    );

    await depositContractDAO1.withdraw(processID, 0, {
      from: admin,
    });

    assert.equal(
      await testToken1.balanceOf(daos[0]),
      web3.utils.toWei("4", "ether")
    );

    // test claim
    assert.equal(await testToken1.balanceOf(daos[2]), web3.utils.toWei("1"));
    assert.equal(await testToken1.balanceOf(daos[1]), web3.utils.toWei("1"));
    assert.equal(await testToken2.balanceOf(daos[0]), web3.utils.toWei("1"));
    assert.equal(await testToken2.balanceOf(daos[2]), web3.utils.toWei("1"));

    await timeMachine.advanceTimeAndBlock(
      HOUR + (vestingEnd - vestingStart) / 2
    );
    await depositContractDAO1.claimVestings({ from: admin });
    await depositContractDAO2.claimVestings({ from: admin });
    await depositContractDAO3.claimVestings({ from: admin });

    assert.equal(
      Math.round(
        web3.utils.fromWei(await testToken1.balanceOf(daos[2]), "ether")
      ),
      "2"
    );
    assert.equal(
      Math.round(
        web3.utils.fromWei(await testToken1.balanceOf(daos[1]), "ether")
      ),
      "2"
    );
    assert.equal(
      Math.round(
        web3.utils.fromWei(await testToken2.balanceOf(daos[0]), "ether")
      ),
      "2"
    );
    assert.equal(
      Math.round(
        web3.utils.fromWei(await testToken2.balanceOf(daos[2]), "ether")
      ),
      "2"
    );
  });
});
