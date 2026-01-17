
// print a wallet


import { ConfigManager } from "../configManager";
import { ContractManager } from "../contractManager";


async function run() {

  const web3 = ConfigManager.getWeb3();
  
  const numWallets = 60;
  const wallets = ConfigManager.insertWallets(web3, numWallets);
  console.log("using address:", web3.eth.defaultAccount);
  //await web3.eth.sendTransaction({from: "0xaF6719D1762D14e35a1dFb742B1d77D757391237", to: "0xC969dc0b07acE3e99d6C2636e26D80086a90b847", nonce: 1, value: web3.utils.toWei("1", "finney"), gas: 21000 });

  const contractManager = ContractManager.get();

    for (let i = 0; i < numWallets; i++) {
        const wallet = wallets[i];
        const balance = await web3.eth.getBalance(wallet.address);
        const miningAddress  = await contractManager.getAddressMiningByStaking(wallet.address);
        const stake = await contractManager.getStake(wallet.address, wallet.address);
        console.log(`Wallet ${i}: Address: ${wallet.address} balance: ${web3.utils.toWei(balance, "ether")} staked on: ${miningAddress} stake: ${stake} `);
    }

}

run();
