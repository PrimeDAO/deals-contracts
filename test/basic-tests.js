const { expectRevert } = require("@openzeppelin/test-helpers");
const timeMachine = require("ganache-time-traveler");
const { expect, assert } = require("chai");
const { ethers } = require("hardhat");

const dealManager = artifacts.require("DealManager");
const daoDepositManager = artifacts.require("DaoDepositManager");
const tokenSwapModule = artifacts.require("TokenSwapModule");
const testERC20 = artifacts.require("TestToken");
const { formatBytes32String } = ethers.utils;

const MONTH = 60 * 60 * 24 * 31;
const DAY = 60 * 60 * 24;
const HOUR = 60 * 60;
const SWAP1 = 0;
const SWAP2 = 1;

contract("Whole rundown", async (accounts) => {
  let testToken1,
    testToken2,
    testToken3,
    testToken4,
    testToken5,
    testToken6,
    weth;
  let currBlockNum, currBlock, currTime, vestingCliff, vestingDuration;
  let depositContractInstance;
  let admin = accounts[0];
  let daos = [accounts[1], accounts[2], accounts[3]];
  let daoReps = [
    [accounts[4], accounts[5]],
    [accounts[6], accounts[7]],
    [accounts[8], accounts[9]],
  ];
  const METADATA1 = formatBytes32String("Uad8AA2CFPaVdyxa805p");
  const METADATA2 = formatBytes32String("pnthglKd0wFHOK6Bn78C");

  let outsider = accounts[10];

  let dealManagerInstance;
  let tokenSwapInstance;

  let snapshot;

  beforeEach(async () => {
    let snapshot = await timeMachine.takeSnapshot();
    snapshotId = snapshot["result"];

    testToken1 = await testERC20.new({ from: admin });
    testToken2 = await testERC20.new({ from: admin });
    testToken3 = await testERC20.new({ from: admin });
    testToken4 = await testERC20.new({ from: admin });
    testToken5 = await testERC20.new({ from: admin });
    testToken6 = await testERC20.new({ from: admin });
    weth = await testERC20.new({ from: admin });

    depositContractInstance = await daoDepositManager.new({
      from: admin,
    });

    dealManagerInstance = await dealManager.new(
      depositContractInstance.address,
      weth.address,
      {
        from: admin,
      }
    );
  });

  afterEach(async () => {
    await timeMachine.revertToSnapshot(snapshotId);
  });

  it("deposit check", async () => {
    await expectRevert(
      dealManagerInstance.setDaoDepositManagerImplementation(
        depositContractInstance.address,
        { from: outsider }
      ),
      "Ownable: caller is not the owner"
    );

    await dealManagerInstance.setDaoDepositManagerImplementation(
      depositContractInstance.address,
      { from: admin }
    );

    assert.equal(
      await dealManagerInstance.daoDepositManager(daos[0]),
      "0x0000000000000000000000000000000000000000"
    );

    await dealManagerInstance.createDaoDepositManager(daos[0], {
      from: outsider,
    });

    assert.notEqual(
      await dealManagerInstance.daoDepositManager(daos[0]),
      "0x0000000000000000000000000000000000000000"
    );

    tokenSwapInstance = await tokenSwapModule.new(dealManagerInstance.address, {
      from: admin,
    });

    await dealManagerInstance.activateModule(tokenSwapInstance.address, {
      from: admin,
    });

    assert.equal(
      await dealManagerInstance.addressIsModule(tokenSwapInstance.address),
      true
    );

    let depositAddrDao1 = await dealManagerInstance.daoDepositManager(daos[0]);

    let depositContractDAO1 = await daoDepositManager.at(depositAddrDao1);

    await expectRevert(
      depositContractDAO1.deposit(
        "0x0000000000000000000000000000000000000000",
        0,
        testToken1.address,
        web3.utils.toWei("1", "ether"),
        { from: admin }
      ),
      "D2D-TOKEN-TRANSFER-FROM-FAILED"
    );

    await testToken1.approve(
      depositContractDAO1.address,
      web3.utils.toWei("1", "ether"),
      { from: admin }
    );

    assert.equal(
      await depositContractDAO1.getTotalDepositCount(
        tokenSwapInstance.address,
        0
      ),
      "0"
    );

    assert.equal(
      await depositContractDAO1.getWithdrawableAmountOfUser(
        tokenSwapInstance.address,
        0,
        admin,
        testToken1.address
      ),
      web3.utils.toWei("0", "ether")
    );

    await depositContractDAO1.deposit(
      tokenSwapInstance.address,
      0,
      testToken1.address,
      web3.utils.toWei("1", "ether"),
      { from: admin }
    );

    assert.equal(
      await depositContractDAO1.getTotalDepositCount(
        tokenSwapInstance.address,
        0
      ),
      "1"
    );

    assert.equal(
      await depositContractDAO1.getWithdrawableAmountOfUser(
        tokenSwapInstance.address,
        0,
        admin,
        testToken1.address
      ),
      web3.utils.toWei("1", "ether")
    );

    assert.equal(
      await depositContractDAO1.getAvailableDealBalance(
        tokenSwapInstance.address,
        0,
        testToken1.address
      ),
      web3.utils.toWei("1", "ether")
    );

    await expectRevert(
      depositContractDAO1.withdraw(tokenSwapInstance.address, 0, [0], {
        from: outsider,
      }),
      "D2D-WITHDRAW-NOT-AUTHORIZED"
    );

    await depositContractDAO1.withdraw(tokenSwapInstance.address, 0, [0], {
      from: admin,
    });

    assert.equal(
      await depositContractDAO1.getAvailableDealBalance(
        tokenSwapInstance.address,
        0,
        testToken1.address
      ),
      web3.utils.toWei("0", "ether")
    );

    // Test SWAP

    await dealManagerInstance.createDaoDepositManager(daos[1], {
      from: outsider,
    });

    let depositAddrDao2 = await dealManagerInstance.daoDepositManager(daos[1]);

    let depositContractDAO2 = await daoDepositManager.at(depositAddrDao2);

    await dealManagerInstance.createDaoDepositManager(daos[2], {
      from: outsider,
    });

    let depositAddrDao3 = await dealManagerInstance.daoDepositManager(daos[2]);

    let depositContractDAO3 = await daoDepositManager.at(depositAddrDao3);

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

    currBlockNum = await web3.eth.getBlockNumber();
    currBlock = await web3.eth.getBlock(currBlockNum);
    currTime = currBlock.timestamp;
    vestingCliff = HOUR * 2;
    vestingDuration = DAY;

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
        vestingCliff,
        vestingDuration,
        web3.utils.toWei("1", "ether"), // sub(2)
        web3.utils.toWei("2", "ether"),
        vestingCliff,
        vestingDuration,
      ],
      [
        web3.utils.toWei("1", "ether"), // sub(2)
        web3.utils.toWei("2", "ether"),
        vestingCliff,
        vestingDuration,
        0,
        0,
        0,
        0,
        web3.utils.toWei("1", "ether"), // sub(2)
        web3.utils.toWei("2", "ether"),
        vestingCliff,
        vestingDuration,
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
      METADATA1,
      currTime + DAY * 7,
      { from: daos[0] }
    );

    assert.equal(await tokenSwapInstance.checkExecutability(SWAP1), false);

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

    await depositContractDAO1.deposit(
      tokenSwapInstance.address,
      0,
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
      tokenSwapInstance.address,
      0,
      testToken2.address,
      web3.utils.toWei("6", "ether"),
      { from: daos[1] }
    );

    assert.equal(
      await testToken2.balanceOf(daos[1]),
      web3.utils.toWei("4", "ether")
    );

    await depositContractDAO3.deposit(
      tokenSwapInstance.address,
      0,
      testToken3.address,
      web3.utils.toWei("6", "ether"),
      { from: daos[2] }
    );

    await depositContractDAO3.deposit(
      tokenSwapInstance.address,
      0,
      testToken4.address,
      web3.utils.toWei("10", "ether"),
      { from: daos[2] }
    );

    assert.equal(await tokenSwapInstance.checkExecutability(SWAP1), true);

    assert.equal(
      await testToken2.balanceOf(daos[0]),
      web3.utils.toWei("0", "ether")
    );

    assert.equal(
      await testToken1.balanceOf(daos[1]),
      web3.utils.toWei("0", "ether")
    );

    await tokenSwapInstance.executeSwap(0, {
      from: daos[0],
    });

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
        tokenSwapInstance.address,
        0,
        daos[0],
        testToken1.address
      ),
      web3.utils.toWei("1", "ether")
    );

    assert.equal(
      await testToken1.balanceOf(daos[0]),
      web3.utils.toWei("3", "ether")
    );

    await expectRevert(
      depositContractDAO1.withdraw(tokenSwapInstance.address, 0, 0, {
        from: admin,
      }),
      "D2D-DEPOSIT-NOT-WITHDRAWABLE"
    );

    assert.equal(
      await testToken1.balanceOf(daos[0]),
      web3.utils.toWei("3", "ether")
    );

    // test claim
    assert.equal(await testToken1.balanceOf(daos[2]), web3.utils.toWei("1"));
    assert.equal(await testToken1.balanceOf(daos[1]), web3.utils.toWei("1"));
    assert.equal(await testToken2.balanceOf(daos[0]), web3.utils.toWei("1"));
    assert.equal(await testToken2.balanceOf(daos[2]), web3.utils.toWei("1"));

    await timeMachine.advanceTimeAndBlock(
      HOUR + (vestingDuration - vestingCliff) / 2
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
  it("claimDealVesting check", async () => {
    // Set up contract instances
    await dealManagerInstance.setDaoDepositManagerImplementation(
      depositContractInstance.address,
      { from: admin }
    );
    tokenSwapInstance = await tokenSwapModule.new(dealManagerInstance.address, {
      from: admin,
    });
    await dealManagerInstance.activateModule(tokenSwapInstance.address, {
      from: admin,
    });
    assert.equal(
      await dealManagerInstance.addressIsModule(tokenSwapInstance.address),
      true
    );

    // transfer tokens to DAOs
    await testToken1.transfer(daos[0], web3.utils.toWei("10", "ether"), {
      from: admin,
    });
    await testToken2.transfer(daos[1], web3.utils.toWei("10", "ether"), {
      from: admin,
    });
    await testToken3.transfer(daos[2], web3.utils.toWei("10", "ether"), {
      from: admin,
    });
    await testToken4.transfer(daos[0], web3.utils.toWei("10", "ether"), {
      from: admin,
    });
    await testToken5.transfer(daos[1], web3.utils.toWei("10", "ether"), {
      from: admin,
    });
    await testToken6.transfer(daos[2], web3.utils.toWei("10", "ether"), {
      from: admin,
    });

    // Set up time
    currBlockNum = await web3.eth.getBlockNumber();
    currBlock = await web3.eth.getBlock(currBlockNum);
    currTime = currBlock.timestamp;
    vestingCliff = HOUR * 2;
    vestingDuration = DAY;

    // Set up parameters Swap 1
    let pathFrom = [
      [web3.utils.toWei("10", "ether"), 0, 0],
      [0, web3.utils.toWei("10", "ether"), 0],
      [0, 0, web3.utils.toWei("10", "ether")],
    ];

    let pathTo = [
      [
        0,
        0,
        0,
        0,
        web3.utils.toWei("2", "ether"),
        web3.utils.toWei("4", "ether"),
        0,
        vestingDuration,
        web3.utils.toWei("2", "ether"),
        web3.utils.toWei("2", "ether"),
        vestingCliff,
        vestingDuration,
      ],
      [
        web3.utils.toWei("1", "ether"),
        web3.utils.toWei("2", "ether"),
        vestingCliff,
        vestingDuration,
        0,
        0,
        0,
        0,
        web3.utils.toWei("3", "ether"),
        web3.utils.toWei("4", "ether"),
        vestingCliff,
        vestingDuration,
      ],
      [
        web3.utils.toWei("2", "ether"),
        web3.utils.toWei("2", "ether"),
        vestingCliff,
        vestingDuration,
        web3.utils.toWei("4", "ether"),
        web3.utils.toWei("2", "ether"),
        0,
        vestingDuration,
        0,
        0,
        0,
        0,
      ],
    ];

    // Set up parameters Swap 2
    let pathFrom1 = [
      [web3.utils.toWei("10", "ether"), 0, 0],
      [0, web3.utils.toWei("10", "ether"), 0],
      [0, 0, web3.utils.toWei("10", "ether")],
    ];

    let pathTo1 = [
      [
        0,
        0,
        0,
        0,
        web3.utils.toWei("1", "ether"),
        web3.utils.toWei("2", "ether"),
        vestingCliff,
        vestingDuration,
        web3.utils.toWei("3", "ether"),
        web3.utils.toWei("4", "ether"),
        vestingCliff,
        vestingDuration,
      ],
      [
        web3.utils.toWei("1", "ether"),
        web3.utils.toWei("4", "ether"),
        vestingCliff,
        vestingDuration,
        0,
        0,
        0,
        0,
        web3.utils.toWei("3", "ether"),
        web3.utils.toWei("2", "ether"),
        vestingCliff,
        vestingDuration,
      ],
      [
        web3.utils.toWei("3", "ether"),
        web3.utils.toWei("2", "ether"),
        vestingCliff,
        vestingDuration,
        web3.utils.toWei("1", "ether"),
        web3.utils.toWei("4", "ether"),
        vestingCliff,
        vestingDuration,
        0,
        0,
        0,
        0,
      ],
    ];

    // Create deposit contracts and first Swap
    await tokenSwapInstance.createSwap(
      [daos[0], daos[1], daos[2]],
      [testToken1.address, testToken2.address, testToken3.address],
      pathFrom,
      pathTo,
      METADATA1,
      currTime + DAY * 7,
      { from: daos[0] }
    );
    assert.equal(await tokenSwapInstance.checkExecutability(SWAP1), false);

    // Get deposit contracts instances
    let depostContractAddressDAO1 = await dealManagerInstance.daoDepositManager(
      daos[0]
    );
    let depositContractDAO1Instance = await daoDepositManager.at(
      depostContractAddressDAO1
    );
    assert.equal(await depositContractDAO1Instance.dao(), daos[0]);

    let depostContractAddressDAO2 = await dealManagerInstance.daoDepositManager(
      daos[1]
    );
    let depositContractDAO2Instance = await daoDepositManager.at(
      depostContractAddressDAO2
    );
    assert.equal(await depositContractDAO2Instance.dao(), daos[1]);

    let depostContractAddressDAO3 = await dealManagerInstance.daoDepositManager(
      daos[2]
    );
    let depositContractDAO3Instance = await daoDepositManager.at(
      depostContractAddressDAO3
    );
    assert.equal(await depositContractDAO3Instance.dao(), daos[2]);

    // Create second swap
    await tokenSwapInstance.createSwap(
      [daos[0], daos[1], daos[2]],
      [testToken4.address, testToken5.address, testToken6.address],
      pathFrom1,
      pathTo1,
      METADATA2,
      currTime + DAY * 7,
      { from: daos[0] }
    );
    assert.equal(await tokenSwapInstance.checkExecutability(SWAP2), false);

    // Approve and depost tokens for Swap 1
    await testToken1.approve(
      depositContractDAO1Instance.address,
      web3.utils.toWei("10", "ether"),
      { from: daos[0] }
    );
    await depositContractDAO1Instance.deposit(
      tokenSwapInstance.address,
      0,
      testToken1.address,
      web3.utils.toWei("10", "ether"),
      { from: daos[0] }
    );

    await testToken2.approve(
      depositContractDAO2Instance.address,
      web3.utils.toWei("10", "ether"),
      { from: daos[1] }
    );
    await depositContractDAO2Instance.deposit(
      tokenSwapInstance.address,
      0,
      testToken2.address,
      web3.utils.toWei("10", "ether"),
      { from: daos[1] }
    );

    await testToken3.approve(
      depositContractDAO3Instance.address,
      web3.utils.toWei("10", "ether"),
      { from: daos[2] }
    );
    await depositContractDAO3Instance.deposit(
      tokenSwapInstance.address,
      0,
      testToken3.address,
      web3.utils.toWei("10", "ether"),
      { from: daos[2] }
    );

    // Test that only Swap 1 is ready for executability
    assert.equal(await tokenSwapInstance.checkExecutability(SWAP1), true);
    assert.equal(await tokenSwapInstance.checkExecutability(SWAP2), false);

    // Approve and depost tokens for Swap 2
    await testToken4.approve(
      depositContractDAO1Instance.address,
      web3.utils.toWei("10", "ether"),
      { from: daos[0] }
    );
    await depositContractDAO1Instance.deposit(
      tokenSwapInstance.address,
      1,
      testToken4.address,
      web3.utils.toWei("10", "ether"),
      { from: daos[0] }
    );

    await testToken5.approve(
      depositContractDAO2Instance.address,
      web3.utils.toWei("10", "ether"),
      { from: daos[1] }
    );
    await depositContractDAO2Instance.deposit(
      tokenSwapInstance.address,
      1,
      testToken5.address,
      web3.utils.toWei("10", "ether"),
      { from: daos[1] }
    );

    await testToken6.approve(
      depositContractDAO3Instance.address,
      web3.utils.toWei("10", "ether"),
      { from: daos[2] }
    );
    await depositContractDAO3Instance.deposit(
      tokenSwapInstance.address,
      1,
      testToken6.address,
      web3.utils.toWei("10", "ether"),
      { from: daos[2] }
    );

    // Test both Swaps are executable
    assert.equal(await tokenSwapInstance.checkExecutability(SWAP1), true);
    assert.equal(await tokenSwapInstance.checkExecutability(SWAP2), true);

    // Test balance tokens before executing the swaps
    assert.equal(
      await testToken1.balanceOf(daos[1]),
      web3.utils.toWei("0", "ether")
    );
    assert.equal(
      await testToken1.balanceOf(daos[2]),
      web3.utils.toWei("0", "ether")
    );
    assert.equal(
      await testToken2.balanceOf(daos[0]),
      web3.utils.toWei("0", "ether")
    );
    assert.equal(
      await testToken2.balanceOf(daos[2]),
      web3.utils.toWei("0", "ether")
    );
    assert.equal(
      await testToken3.balanceOf(daos[0]),
      web3.utils.toWei("0", "ether")
    );
    assert.equal(
      await testToken3.balanceOf(daos[1]),
      web3.utils.toWei("0", "ether")
    );
    assert.equal(
      await testToken4.balanceOf(daos[1]),
      web3.utils.toWei("0", "ether")
    );
    assert.equal(
      await testToken4.balanceOf(daos[2]),
      web3.utils.toWei("0", "ether")
    );
    assert.equal(
      await testToken5.balanceOf(daos[0]),
      web3.utils.toWei("0", "ether")
    );
    assert.equal(
      await testToken5.balanceOf(daos[2]),
      web3.utils.toWei("0", "ether")
    );
    assert.equal(
      await testToken6.balanceOf(daos[0]),
      web3.utils.toWei("0", "ether")
    );
    assert.equal(
      await testToken6.balanceOf(daos[1]),
      web3.utils.toWei("0", "ether")
    );

    // Execute swaps
    await tokenSwapInstance.executeSwap(SWAP1, { from: daos[0] });
    await tokenSwapInstance.executeSwap(SWAP2, { from: daos[0] });

    // Test balance after executing swap
    assert.equal(
      await testToken1.balanceOf(daos[1]),
      web3.utils.toWei("2", "ether")
    );
    assert.equal(
      await testToken1.balanceOf(daos[2]),
      web3.utils.toWei("2", "ether")
    );
    assert.equal(
      await testToken2.balanceOf(daos[0]),
      web3.utils.toWei("1", "ether")
    );
    assert.equal(
      await testToken2.balanceOf(daos[2]),
      web3.utils.toWei("3", "ether")
    );
    assert.equal(
      await testToken3.balanceOf(daos[0]),
      web3.utils.toWei("2", "ether")
    );
    assert.equal(
      await testToken3.balanceOf(daos[1]),
      web3.utils.toWei("4", "ether")
    );
    assert.equal(
      await testToken4.balanceOf(daos[1]),
      web3.utils.toWei("1", "ether")
    );
    assert.equal(
      await testToken4.balanceOf(daos[2]),
      web3.utils.toWei("3", "ether")
    );
    assert.equal(
      await testToken5.balanceOf(daos[0]),
      web3.utils.toWei("1", "ether")
    );
    assert.equal(
      await testToken5.balanceOf(daos[2]),
      web3.utils.toWei("3", "ether")
    );
    assert.equal(
      await testToken6.balanceOf(daos[0]),
      web3.utils.toWei("3", "ether")
    );
    assert.equal(
      await testToken6.balanceOf(daos[1]),
      web3.utils.toWei("1", "ether")
    );

    // Get new accurate timestamp for calculations
    const accurateBlockNum = await web3.eth.getBlockNumber();
    const accurateBlock = await web3.eth.getBlock(accurateBlockNum);

    await timeMachine.advanceTimeAndBlock(
      accurateBlock.timestamp - currTime + (vestingDuration - vestingCliff) / 2
    );

    // Claim vesting for Swap 1
    await depositContractDAO1Instance.claimDealVestings(
      tokenSwapInstance.address,
      0,
      {
        from: admin,
      }
    );
    await depositContractDAO2Instance.claimDealVestings(
      tokenSwapInstance.address,
      0,
      {
        from: admin,
      }
    );
    await depositContractDAO3Instance.claimDealVestings(
      tokenSwapInstance.address,
      0,
      {
        from: admin,
      }
    );

    // Test balances after Swap 1
    assert.equal(
      Math.round(
        web3.utils.fromWei(await testToken1.balanceOf(daos[1]), "ether")
      ),
      "4"
    );
    assert.equal(
      Math.round(
        web3.utils.fromWei(await testToken1.balanceOf(daos[2]), "ether")
      ),
      "3"
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
      "5"
    );
    assert.equal(
      Math.round(
        web3.utils.fromWei(await testToken3.balanceOf(daos[0]), "ether")
      ),
      "3"
    );
    assert.equal(
      Math.round(
        web3.utils.fromWei(await testToken3.balanceOf(daos[1]), "ether")
      ),
      "5"
    );
    assert.equal(
      await testToken4.balanceOf(daos[1]),
      web3.utils.toWei("1", "ether")
    );
    assert.equal(
      await testToken4.balanceOf(daos[2]),
      web3.utils.toWei("3", "ether")
    );
    assert.equal(
      await testToken5.balanceOf(daos[0]),
      web3.utils.toWei("1", "ether")
    );
    assert.equal(
      await testToken5.balanceOf(daos[2]),
      web3.utils.toWei("3", "ether")
    );
    assert.equal(
      await testToken6.balanceOf(daos[0]),
      web3.utils.toWei("3", "ether")
    );
    assert.equal(
      await testToken6.balanceOf(daos[1]),
      web3.utils.toWei("1", "ether")
    );

    // Claim vesting for Swap 2
    await depositContractDAO1Instance.claimDealVestings(
      tokenSwapInstance.address,
      1,
      {
        from: admin,
      }
    );
    await depositContractDAO2Instance.claimDealVestings(
      tokenSwapInstance.address,
      1,
      {
        from: admin,
      }
    );
    await depositContractDAO3Instance.claimDealVestings(
      tokenSwapInstance.address,
      1,
      {
        from: admin,
      }
    );

    // Test balances after Swap 2
    assert.equal(
      Math.round(
        web3.utils.fromWei(await testToken1.balanceOf(daos[1]), "ether")
      ),
      "4"
    );
    assert.equal(
      Math.round(
        web3.utils.fromWei(await testToken1.balanceOf(daos[2]), "ether")
      ),
      "3"
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
      "5"
    );
    assert.equal(
      Math.round(
        web3.utils.fromWei(await testToken3.balanceOf(daos[0]), "ether")
      ),
      "3"
    );
    assert.equal(
      Math.round(
        web3.utils.fromWei(await testToken3.balanceOf(daos[1]), "ether")
      ),
      "5"
    );
    assert.equal(
      Math.round(
        web3.utils.fromWei(await testToken4.balanceOf(daos[1]), "ether")
      ),
      "2"
    );
    assert.equal(
      Math.round(
        web3.utils.fromWei(await testToken4.balanceOf(daos[2]), "ether")
      ),
      "5"
    );
    assert.equal(
      Math.round(
        web3.utils.fromWei(await testToken5.balanceOf(daos[0]), "ether")
      ),
      "3"
    );
    assert.equal(
      Math.round(
        web3.utils.fromWei(await testToken5.balanceOf(daos[2]), "ether")
      ),
      "4"
    );
    assert.equal(
      Math.round(
        web3.utils.fromWei(await testToken6.balanceOf(daos[0]), "ether")
      ),
      "4"
    );
    assert.equal(
      Math.round(
        web3.utils.fromWei(await testToken6.balanceOf(daos[1]), "ether")
      ),
      "3"
    );
  });
});
