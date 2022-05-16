[![banner](https://i.ibb.co/BqjcRGG/Prime-DAO-Github-Contracts-Banner.png)](https://www.prime.xyz/)

![build&tests](https://github.com/PrimeDAO/deals-contracts/actions/workflows/ci-config.yml/badge.svg) [![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

# Prime Deals Smart Contracts

This repo contains the smart contracts making up Prime Deals.

## What is Prime Deals

Prime Deals is a platform to host and facilitate various types of DAO to DAO (D2D) negotiations. With our platform any DAO can easily propose, discuss and ratify agreements, and execute the deal on-chain.

At first, Prime Deals will feature the Token Swap, a module that allows DAOs to execute trustless token swaps among them with customized vesting options. Prime Deals will progressively release further modules to facilitate additional types of contract-based interactions such as Joint Venture in the near future and Co-liquidity Pool later on.

To learn more about Prime Deals, please see [here](https://github.com/PrimeDAO/deals-docs)

## Smart Contracts Architecture

The Prime Deals smart contract architecture has been designed with non-custodianship, trustlessness, extensibility and security in mind. Future modules can be added to Deals as they are being built, without having to make structural changes in the underlying architecture. Our first module is the `TokenSwapModule`. To keep the description of the architecture general, the wording `DealModule` instead of `TokenSwapModule` is used below.

The Prime Deals architecture consists of three main components. These are:

- `DealManager`
- `DaoDepositManager`
- `DealModule`

### DealManager

The `DealManager` contract serves as a central registry, managing and storing the addresses of all the contracts involved in Prime Deals. It activates and deactivates new Deals modules and creates `DaoDepositManager`contracts. The `DealManager` is also used in a multitude of authentication processes to make sure that all the contracts involved in Prime Deals are verified contracts part of the Deals Modules. The `DealManager` is governed and managed by PrimeDAO which can add new modules, change fees or intervene in the whole contract to manage extreme events and disasters. **However, this does not grant PrimeDAO with the power to touch any funds or modify deals, as the protocol remains trustless.**

### DaoDepositManager

The `DaoDepositManager` contract serves a similar function to an escrow contract. It can be funded to hold the amount the DAO is contributing to a Deal before it has been executed. After execution, it will hold the agreed-upon vested amount (if applicable) from which the funds can be claimed during and after the vesting period.

The workings of the vesting mechanism is such that the vesting duration is started automatically right after the deal execution. It locks the tokens for the intended vesting duration in the DAOs `DaoDepositManager`. The function to claim vested tokens can be called through our frontend by all the Deal Representatives without restriction. When calling the claim function in the contract, it will transfer the claimable tokens to the DAOs treasury address, which is stored in the `DaoDepositManager` state at creation time. In this way, no tokens can be sent to other addresses than the DAO treasury.

A few other things to highlight are:

- The `DaoDepositManager` is used for all the deals a DAO makes within the Prime Deals ecosystem. This means that a `DaoDepositManager` is specific for a DAO, not a deal. When a DAO participates in Prime Deals for the first time, a `DaoDepositManager` is created which will hold all the future deposits and vestings for that given DAO, across all deals made.
- All the vested DAOs funds are in their own `DaoDepositManager` before and get transferred to the other Dao’s `DaoDepositManager` after the execution
- All the tokens claimable from vested tokens can only be transferred to the DAOs address as set in the `DaoDepositManager` contract

### DealModule

The `DealModule` contract serves as the first point of contact in creating a deal. It stores all the parameters of the deal on-chain.

When the deal is executed, the `DealModule` will verify if all the conditions for the deal are met, i.e. that all deposits have been made. Next, the module will proceed to pull all the tokens involved in the token swap from each DAOs `DaoDepositContract` into the module. By doing this, all the tokens involved are pooled into the module. The following step in the execution process is to transfer all the unvested tokens to the DAO addresses, after which it sends the to-be-vested token amount into the respective DAOs `DaoDepositContract` to start the vesting period.

### Diagrams & Contract Flows

To dive deeper into the architecture and contract flows, you can follow the [link](https://pitch.com/public/a2c76483-545c-4726-a9bc-bc56fbe0cfc8), or click on the image below.
[<img width="1455" alt="Screenshot 2022-05-13 at 15 16 42" src="https://user-images.githubusercontent.com/43185740/168293267-4974b6d8-3e07-4d29-bfd6-0c1fccbd87b4.png">](https://pitch.com/public/a2c76483-545c-4726-a9bc-bc56fbe0cfc8)

## Security

Security was one of our main concerns during the building of Prime Deals.
All of the Prime Deals contracts have therefore undergone an extensive audit by our auditing partner **byterocket**, involving manual as well as automated reviews, state-of-the-art testing methods like fuzz- testing as well as game theoretic reviews of the protocol itself.

The learn more about the audit, please see [here](https://github.com/PrimeDAO/deals-contracts/blob/main/docs/PrimeDeals%20Audit.pdf).

## Repository Layout

The repository is organized as follows:

- `/contracts/`- Prime Deals smart contracts
  - `/core/`- Prime Deals core contracts.
  - `/modules/`- Prime Deals modules contracts.
  - `/test/`- contracts used for testing.
  - `/utils/`- utility contracts.
- `/deploy/`- deploy scripts.
- `/deployments/`- deployed contract ABIs.
- `/docs/`- additional documentation.
- `/exports/`- ABI exports used by the frontend.
- `/tasks/`- scripts to interact with deployed contracts.
- `/test/`- tests.

## Development

requires

```
node >= 14.0
```

to install node modules

```
npm i
```

to compile run

```
npm run compile
```

to test

```
npm run test
```

to run coverage

```
npm run coverage
```

## Environment setup

please prepare `.env` file

```bash
touch .env
```

and add the following

```
INFURA_KEY = infura key
MNEMONIC = mnemonic (choose our development mnemonic to be able to interact with the deployed contracts with the deployer address)
PK = private-key
ETHERSCAN_API_KEY = etherscan key
```

Note:`.env` should be created in root directory.

## Deployment

This project uses the hardhat-deploy plugin to deploy contracts. When a contract has been deployed, its _ABI_ is saved as JSON to the `/deployments/` directory, including its _address_.

Since this is a project that is continuously being extended, it is generally not desirable to always deploy all contracts. Therefore, this project makes use of [deployment tags](https://www.npmjs.com/package/hardhat-deploy#deploy-scripts-tags-and-dependencies). These are specified at the end of each deploy script.

There are three **npm scripts** that facilitate the deployment to _mainnet_, _rinkeby_ and _kovan_. All require the specification of **tags**. When using these scripts, at the end of the deployment, it automatically exports the addresses & artifacts in one file per network. These files can be found in the `/exports/` directory and, for example, can be used for dApp development.

If multiple contracts share the same ABI (e.g. multiple instances of an ERC20 token) this should be specified in `deploy/sharedAbiConfig.js`. If not yet available, you should manually add the shared ABI (e.g. the ERC20 ABI) to `/exports/sharedAbis.json`. As a result, the deployment information is exported, the exports for contracts that share the same ABI will point to this shared ABI. This keeps file exports slim, which is beneficial for dApp performance. If this is still unclear, you could for example take a look at `/exports/rinkeby.json` and look at the ABIs of the _Prime_ and _WETH_ contracts.

### Deployment to rinkeby

General (one tag):
`npm run deploy:contracts:rinkeby --tags=<YOUR_TAG_NAME>`

General (multiple tags):
`npm run deploy:contracts:rinkeby --tags=<YOUR_TAG_NAME1>,<YOUR_TAG_NAME2>`

Example (deploys TokenSwapModule contracts):
`npm run deploy:contracts:rinkeby --tags=TokenSwapModule`

### Deployment to kovan

General (one tag):
`npm run deploy:contracts:kovan --tags=<YOUR_TAG_NAME>`

General (multiple tags):
`npm run deploy:contracts:kovan --tags=<YOUR_TAG_NAME1>,<YOUR_TAG_NAME2>`

Example (deploys TokenSwapModule contracts):
`npm run deploy:contracts:kovan --tags=TokenSwapModule`

### Deployment to mainnet

General (one tag):
`npm run deploy:contracts:mainnet --tags=<YOUR_TAG_NAME>`

General (multiple tags):
`npm run deploy:contracts:mainnet --tags=<YOUR_TAG_NAME1>,<YOUR_TAG_NAME2>`

Example (deploys DealManager and DaoDepositManager contracts):
`npm run deploy:contracts:mainnet --tags=DealManager,DaoDepositManager`

## Interacting with contracts

This project uses hardhat tasks to interact with deployed contracts. The associated scripts can be found in the `/tasks/` directory. To get an **overview of all existing tasks** you can run `npx hardhat` on your command line.

To get more information on specific tasks (e.g. what they do, which parameters they require etc.) you can run `npx hardhat help <task_name>`.

Here's an example of a command to execute a task on rinkeby:
`npx hardhat --network rinkeby activateModule --address <0xsome_contract_address>`

## Verify Contracts

to verify contracts, the enviornment variable should contain `ETHERSCAN_API_KEY` set.

`npx hardhat verify --network mainnet <0xsome_contract_address>`

single constructor argument can be passed as follows:
`npx hardhat verify --network mainnet <0xsome_contract_address> "constructor argument 1"`

multiple constructor arguments can be passed as follows:
`npx hardhat verify --network rinkeby <0xsome_contract_address> "constructor argument 1" "constructor argument 2"`

find more information in the documentation of [hardhat-etherscan](https://hardhat.org/plugins/nomiclabs-hardhat-etherscan.html)

## Code formatting

To format JS and Solidity code, run the following command:

`npm run format`

## Contributing to PrimeDAO

If you wish to contribute to PrimeDAO, check out our [Contributor Onboarding documentation](https://docs.primedao.io/primedao/call-for-contributors).

## License

```
Copyright 2022 Prime Foundation

Licensed under the GNU General Public License v3.0.
You may obtain a copy of this license at:

https://www.gnu.org/licenses/gpl-3.0.en.html

```
