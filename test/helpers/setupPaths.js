const { ethers } = require("hardhat");

const { parseEther } = ethers.utils;

// Deal 1 parameters
const setupPathFromDeal1 = () => [
  [parseEther("6"), 0, 0],
  [0, parseEther("6"), 0],
  [0, 0, parseEther("6")],
  [0, 0, parseEther("10")],
];

// VESTING_CLIFF1 = HOUR * 2;
// VESTING_DURATION1 = DAY
const setupPathToDeal1 = (vestingCliff, vestingDuration) => [
  [
    0,
    0,
    0,
    0,
    parseEther("1"),
    parseEther("2"),
    vestingCliff,
    vestingDuration,
    parseEther("1"),
    parseEther("2"),
    vestingCliff,
    vestingDuration,
  ],
  [
    parseEther("1"),
    parseEther("2"),
    vestingCliff,
    vestingDuration,
    0,
    0,
    0,
    0,
    parseEther("1"),
    parseEther("2"),
    vestingCliff,
    vestingDuration,
  ],
  [parseEther("3"), 0, 0, 0, parseEther("3"), 0, 0, 0, 0, 0, 0, 0],
  [parseEther("5"), 0, 0, 0, parseEther("5"), 0, 0, 0, 0, 0, 0, 0],
];

// Deal 2 parameters
const setupPathFromDeal2 = () => [
  [parseEther("12"), 0, 0],
  [0, parseEther("12"), 0],
  [0, 0, parseEther("12")],
  [0, 0, parseEther("5")],
];

// VESTING_CLIFF2 = HOUR * 4;
// VESTING_DURATION2 = DAY * 2
const setupPathToDeal2 = (vestingCliff, vestingDuration) => [
  [
    0,
    0,
    0,
    0,
    parseEther("2"),
    parseEther("4"),
    vestingCliff,
    vestingDuration,
    parseEther("2"),
    parseEther("4"),
    vestingCliff,
    vestingDuration,
  ],
  [
    parseEther("2"),
    parseEther("4"),
    vestingCliff,
    vestingDuration,
    0,
    0,
    0,
    0,
    parseEther("2"),
    parseEther("4"),
    vestingCliff,
    vestingDuration,
  ],
  [parseEther("6"), 0, 0, 0, parseEther("6"), 0, 0, 0, 0, 0, 0, 0],
  [parseEther("2.5"), 0, 0, 0, parseEther("2.5"), 0, 0, 0, 0, 0, 0, 0],
];

// Deal 3 parameters
const setupPathFromDeal3 = () => [
  [parseEther("3"), 0, 0],
  [0, parseEther("3"), 0],
  [0, 0, parseEther("3")],
  [0, 0, parseEther("20")],
];

// VESTING_CLIFF3 = HOUR * 6;
// VESTING_DURATION3 = DAY * 3
const setupPathToDeal3 = (vestingCliff, vestingDuration) => [
  [
    0,
    0,
    0,
    0,
    parseEther("0.5"),
    parseEther("1"),
    vestingCliff,
    vestingDuration,
    parseEther("0.5"),
    parseEther("1"),
    vestingCliff,
    vestingDuration,
  ],
  [
    parseEther("0.5"),
    parseEther("1"),
    vestingCliff,
    vestingDuration,
    0,
    0,
    0,
    0,
    parseEther("0.5"),
    parseEther("1"),
    vestingCliff,
    vestingDuration,
  ],
  [parseEther("1.5"), 0, 0, 0, parseEther("1.5"), 0, 0, 0, 0, 0, 0, 0],
  [parseEther("10"), 0, 0, 0, parseEther("10"), 0, 0, 0, 0, 0, 0, 0],
];

module.exports = {
  setupPathFromDeal1,
  setupPathToDeal1,
  setupPathFromDeal2,
  setupPathToDeal2,
  setupPathFromDeal3,
  setupPathToDeal3,
};
