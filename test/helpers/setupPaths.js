const { ethers } = require("hardhat");

const { parseEther } = ethers.utils;

const setupPathFromDeal1 = () => [
  [parseEther("6"), 0, 0],
  [0, parseEther("6"), 0],
  [0, 0, parseEther("6")],
  [0, 0, parseEther("10")],
];

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

const setupPathFromDeal2 = () => [
  [parseEther("12"), 0, 0],
  [0, parseEther("12"), 0],
  [0, 0, parseEther("12")],
  [0, 0, parseEther("5")],
];

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
const setupPathFromDeal3 = () => [
  [parseEther("3"), 0, 0],
  [0, parseEther("3"), 0],
  [0, 0, parseEther("3")],
  [0, 0, parseEther("20")],
];

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
