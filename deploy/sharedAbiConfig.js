const ownDeployedContracts = {
  Prime: {
    abi: "ERC20",
  },
};

const externalContracts = {
  rinkeby: {
    WETH: {
      address: "0xc778417E063141139Fce010982780140Aa0cD5Ab",
      abi: "ERC20",
    },
  },
  mainnet: {
    WETH: {
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      abi: "ERC20",
    },
  },
};

module.exports = {
  rinkeby: { ...ownDeployedContracts, ...externalContracts.rinkeby },
  mainnet: { ...ownDeployedContracts, ...externalContracts.mainnet },
  kovan: { ...ownDeployedContracts, ...externalContracts.kovan },
};
