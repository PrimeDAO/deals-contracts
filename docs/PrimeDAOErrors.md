# Error Codes

## General (001 - 099)
### Init related
- `001` : `Contract already exists, already initialized`
### Input
- `100` : `Invalid input address`
- `101` : `Input value cannot be empty`
- `102` : `Input arrays length mismatch`
- `103` : `Amounts mismatch`
## Deals (200 - 299)
### Input (200 - 219)
- `200` : `Invalid deposit ID`
- `201` : `Vesting cliff cannot be bigger than the vesting duration`
- `202` : `msg.value does not match the input value`
- `203` : `Invalid metadata, it already exists`
- `204` : `Invalid amount of DAOs, at least 2 are required`
- `205` : `Invalid amount of tokens, at least 1 is required`
- `206` : `Deadline cannot be smaller than current time`
- `207` : `Invalid metadata`
- `208` : `Invalid deal ID`
 ### Permissions (220 - 239)
- `220` : `Can only be called by a Deals module contract`
- `221` : `Can only be called by the DealManager contract`
- `222` : `Withdraw not authorized, msg.sender is not the depositor or the deal has not been expired`
### Tokens (240 - 259)
- `240` : `No withdrawable amount available`
- `241` : `ERC20 token transfer failed`
- `242` : `ETH transfer failed`
- `243` : `ERC20 token approve failed`
- `244` : `Claimable amounts mismatch`
- `245` : `Invalid balance`
### General (260 - )
- `260` : `Invalid DealManager address set in the contract`
- `261` : `DaoDepositManager implementation is not set`
- `262` : `Not enough tokens or ETH are sent to the module`
- `263` : `Function call only available for ERC20 tokens`
- `264` : `Fee cannot be more then 20%`
- `265` : `Swap is not executable`
- `266` : `Deal has already been executed`
## Launch (300 - 399)

