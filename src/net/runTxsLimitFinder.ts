import Web3 from "web3";
import { Account } from "web3-core";
import { ConfigManager } from "../configManager";
import { FastTxSender } from "../tools/FastTxSender";
import { sleep } from "../utils/time";



async function fundWallets(web3: Web3, num:number, minBalance: string) {
  
  let result : Account[] = [];
  let minGasPrice = "1000000000";
  let fastTxSender = new FastTxSender(web3);
  
  for(let i = 1; i <= num; i++) {
    
    const account = web3.eth.accounts.create(`test${i}` );
    web3.eth.accounts.wallet.add(account);
    result.push(account);
    const balance = web3.utils.toBN(await web3.eth.getBalance(account.address));

    
    if (balance.lt(web3.utils.toBN(minBalance))) {
      console.log(`Funding: `, account.address);
      const tx = { from: web3.eth.defaultAccount!, to: account.address, value: minBalance, gas: 21000, gasPrice: minGasPrice };
      fastTxSender.addTransaction(tx);
    }

    // nonce ++;
  }

  await fastTxSender.sendTxs();
  await fastTxSender.awaitTxs();

  return result;
}

async function run() {


  const web3 = ConfigManager.getWeb3();

  // send n transaction over a period of t seconds, with a delay of d milliseconds between each transaction

  let target_txs = 200;
  const increase_per_run = 1.1;

  const n = 100;
  

  // get current time.
  let start_time = new Date().getTime();

  let fastTxSender = new FastTxSender(web3);

  let etherBN = web3.utils.toBN("1");
  let etherWei = web3.utils.toWei(etherBN, "ether");
  let wallets = await fundWallets(web3, 1000, etherWei.toString());

  let minGasPrice = "1000000000";

  let current_account_index = 1;

  let totalSentTransactions = 0;
  while (totalSentTransactions < 20000) {

    let sleepDuration = 1 / target_txs;

    // just send the single Tx.
    await fastTxSender.sendSingleTx({ from: wallets[current_account_index].address, to: wallets[current_account_index].address, value: 0, gas: 21000, gasPrice: minGasPrice });
    totalSentTransactions++;
    current_account_index++;

    await sleep(sleepDuration);

    if (current_account_index > wallets.length) {
      current_account_index = 1;
    }
  }
  
}

run();