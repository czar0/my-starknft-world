# Create Your First NFT with Infura and StarkNet

This is the supporting codebase at the core of the [Infura](https://www.infura.io/) blog post - [Mint Your First NFT with Infura and StarkNet](https://www.infura.io/blog/post/mint-your-first-nft-with-infura-and-starknet) - and featured by [EatTheBlocks](https://eattheblocks.com/) in their [How to Deploy Solidity Smart Contracts on L2 with ZK-Rollup (Infura x StarkNet, Tutorial)](https://www.youtube.com/watch?v=HmewjBP1GlU) video tutorial.

## Prerequisites

- node (tested on v16.xx.x)
- npm (tested on v8.xx.x)
- Infura Web3 account with StarkNet enabled
- Infura IPFS account with dedicated gateway
- basic knowledge of ERC721 standard

## Setting up

Install all the dependencies of this project:

```bash
npm install
```

Create a new `.env` file:

```bash
cp .env.example .env
```

Edit this file with the Infura network and IPFS information (note that some of those are optional).

Then source it:

```bash
source .env
```

## Run

```bash
node index.js
```
