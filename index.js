import fs from "fs";
import https from "https";
import readline from "readline";
import {
  Account,
  Contract,
  ec,
  json,
  number,
  shortString,
  stark,
  Provider,
  uint256,
} from "starknet";
import dotenv from "dotenv";
dotenv.config();

/*
====================================
🦊 1. Account creation
====================================
*/

// Initialize provider
const infuraEndpoint = process.env.INFURA_STARKNET_TESTNET_ENDPOINT;
const provider = new Provider({
  rpc: {
    nodeUrl: infuraEndpoint,
  },
});

// Read Account contract ABI
console.log("Reading OpenZeppelin Account Contract...");
const compiledOZAccount = json.parse(
  fs.readFileSync("./contracts/OZAccount.json").toString("ascii")
);

// Generate public and private key pair
const privateKey =
  process.env.STARKNET_PRIVATE_KEY === undefined ||
  process.env.STARKNET_PRIVATE_KEY === ""
    ? stark.randomAddress()
    : process.env.STARKNET_PRIVATE_KEY;
const starkKeyPair = ec.getKeyPair(privateKey);
const starkKeyPub = ec.getStarkKey(starkKeyPair);

console.log(`🚨 DO NOT SHARE !!! 🚨 Private key: ${privateKey}`); // <-- KEEP THIS SECRET! 🔐
console.log(`Public key: ${starkKeyPub}`);

// Deploy the Account contract and wait for it to be verified on StarkNet
console.log("Deployment Tx - Account Contract to StarkNet...");
const accountResponse = await provider.deployContract({
  contract: compiledOZAccount,
  constructorCalldata: [starkKeyPub],
  addressSalt: starkKeyPub,
});
const accountAddress = accountResponse.contract_address;

console.log(`Account address: ${accountAddress}`);
console.log(
  `See account on the explorer: https://goerli.voyager.online/contract/${accountAddress}`
);

// Wait for the deployment transaction to be accepted on StarkNet
console.log(
  "Waiting for Tx to be Accepted on Starknet - OpenZeppelin Account Deployment..."
);
console.log(
  `Follow the tx status on: https://goerli.voyager.online/tx/${accountResponse.transaction_hash}`
);
await provider.waitForTransaction(accountResponse.transaction_hash);

// Use your new account address
const account = new Account(provider, accountAddress, starkKeyPair);

/*
====================================
📜 2. ERC721 NFT contract
====================================
*/

// Read NFT contract ABI
console.log(
  "Reading OpenZeppelin ERC721EnumerableMintableBurnable Contract..."
);
const compiledErc721 = json.parse(
  fs
    .readFileSync("./contracts/ERC721EnumerableMintableBurnable.json")
    .toString("ascii")
);

// Fund the account
await prompt(
  `
  IMPORTANT: you need to fund your newly created account before you use it.
  You can do so by using a faucet: https://faucet.goerli.starknet.io/
  Insert the following account address: ${accountAddress}
  Wait for confirmation before continuing.

  [Press ENTER to continue]`
);

// Deploy an ERC721 contract and wait for it to be verified on StarkNet.
console.log("Deployment Tx - ERC721 Contract to StarkNet...");
const erc721Response = await provider.deployContract({
  contract: compiledErc721,
  constructorCalldata: [
    number.hexToDecimalString(shortString.encodeShortString("MyStarkNFT")),
    number.hexToDecimalString(shortString.encodeShortString("MSN")),
    accountAddress,
  ],
  addressSalt: starkKeyPub,
});

// Wait for the deployment transaction to be accepted on StarkNet
console.log("Waiting for Tx to be Accepted on Starknet - ERC721 Deployment...");
console.log(
  `Follow the tx status on: https://goerli.voyager.online/tx/${erc721Response.transaction_hash}`
);
await provider.waitForTransaction(erc721Response.transaction_hash);

// Get the contract address
const erc721Address =
  process.env.STARKNET_ERC721_ACCOUNT_ADDRESS === undefined ||
  process.env.STARKNET_ERC721_ACCOUNT_ADDRESS === ""
    ? erc721Response.contract_address
    : process.env.STARKNET_ERC721_ACCOUNT_ADDRESS;
console.log("ERC721 Address: ", erc721Address);
console.log(
  `Explorer link: https://goerli.voyager.online/contract/${erc721Address}`
);

// Create a new erc721 contract object
const erc721 = new Contract(compiledErc721.abi, erc721Address, provider);

// Connect the current account to execute transactions
erc721.connect(account);

// Retrieve total supply number
console.log(`Retrieving total NFT supply number...`);
let totalSupply = await erc721.totalSupply();
totalSupply = parseInt(shortString.decodeShortString(uint256.bnToUint256(totalSupply[0].low).low));
console.log("Total supply", totalSupply);

// Print all minted token IDs
console.log(`Printing all minted token IDs by index...`);
for (let i = 0; i < totalSupply; i++) {
  let value = uint256.bnToUint256(i);
  let tid = await erc721.tokenByIndex([value.low, value.high]);
  tid = (tid[0].low).toString();
  tid = tid.substr(0, tid.length - 18);
  console.log("Token ID:", tid);
}

// Generate the next incremental token id
const tokenId = totalSupply + 1;

// Mint 1 NFT with tokenId to accountAddress
const value = uint256.bnToUint256(tokenId + "000000000000000000");
console.log(
  `Invoke Tx - Minting NFT with tokenId ${tokenId} to ${accountAddress} ...`
);
const { transaction_hash: mintTxHash } = await erc721.mint(
  accountAddress,
  [value.low, value.high],
  {
    maxFee: "999999995330000",
    addressSalt: starkKeyPub,
  }
);

// Wait for the invoke transaction to be accepted on StarkNet
console.log(`Waiting for Tx to be Accepted on Starknet - Minting...`);
console.log(
  `Follow the tx status on: https://goerli.voyager.online/tx/${mintTxHash}`
);
await provider.waitForTransaction(mintTxHash);

/*
====================================
🖼 3. Upload NFT artwork & metadata 
====================================
*/

const infuraIpfsGateway = process.env.INFURA_IPFS_GATEWAY_ENDPOINT + "/ipfs/";
const infuraIpfsIdAndSecret = `${process.env.INFURA_IPFS_PROJECT_ID}:${process.env.INFURA_IPFS_SECRET}`;
// Feel free to replace this URL with any image you like on the web - by default we set it to be our logo ❤️
const imageUrl = process.env.NFT_IMAGE_URL;

// Initialize IPFS client
const { create, urlSource } = await import("ipfs-http-client");
const ipfs = await create({
  host: "ipfs.infura.io",
  port: 5001,
  protocol: "https",
  headers: {
    Authorization: `Basic ${Buffer.from(infuraIpfsIdAndSecret).toString(
      "base64"
    )}`,
  },
});

// Upload image to IPFS
let fileUrl;
try {
  const added = await ipfs.add(urlSource(imageUrl));
  console.log("Image", added);
  fileUrl = infuraIpfsGateway + added.cid;
} catch (error) {
  console.log("Error uploading file: ", error);
}
console.log(`IPFS file URL: ${fileUrl}`);

// Upload NFT metadata to IPFS
const metadata = JSON.stringify({
  name: "StarkNFT",
  description: "My first NFT on StarkNet with Infura! 🥳",
  image: fileUrl,
});
let metadataUrl;
try {
  const added = await ipfs.add(metadata);
  console.log("Metadata", added);
  metadataUrl = infuraIpfsGateway + added.cid;
} catch (error) {
  console.log("Error uploading file: ", error);
}
console.log(`IPFS metadata URL: ${metadataUrl}`);

// Shorten the URI to a compatible shortString format
metadataUrl = await shortenUrl(metadataUrl);
console.log(`Metadata shortened url is: ${metadataUrl}`);

// Update token metadata URI
console.log(
  `Invoke Tx -  Setting URI for tokenId ${tokenId} to ${metadataUrl} ...`
);
const { transaction_hash: tokenUriTxHash } = await erc721.setTokenURI(
  [value.low, value.high],
  number.hexToDecimalString(shortString.encodeShortString(metadataUrl)),
  {
    maxFee: "999999995330000",
    addressSalt: starkKeyPub,
  }
);

// Wait for the invoke transaction to be accepted on StarkNet
console.log(`Waiting for Tx to be Accepted on Starknet - Setting token URI...`);
console.log(
  `Follow the tx status on: https://goerli.voyager.online/tx/${tokenUriTxHash}`
);
await provider.waitForTransaction(tokenUriTxHash);

// Retrieve NFT metadata information
console.log(`Retrieving metadata for tokenId ${tokenId} ...`);
const tokenURI = await erc721.tokenURI([value.low, value.high]);
const resultDecoded = shortString.decodeShortString(
  number.toHex(number.toBN(tokenURI[0]))
);
console.log(`Token URI for ${tokenId} is`, resultDecoded);
console.log(`Direct link --> https://${resultDecoded}`);

console.log(
  "\nCongratulations! You minted your first NFT on StarkNet with Infura 🥳"
);

/*
====================================
🧰 Utilities
====================================
*/

// Pause execution and wait for user input
function prompt(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

// Shorten a url to make it compatible with StarkNet shortString format (note: using tinyurl.com service)
function shortenUrl(url) {
  return new Promise((resolve, reject) => {
    const options = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(
      url
    )}`;

    https
      .get(options, (response) => {
        if (response.statusCode >= 400) {
          reject(new Error(`${response.statusCode} ${response.statusMessage}`));
        }

        response.on("data", (data) => {
          resolve(data.toString().replace(/https?:\/\//i, ""));
        });
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}
