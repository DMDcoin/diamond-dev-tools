import { createOptionsSection } from "ts-command-line-args";
import { Account, PromiEvent, TransactionReceipt } from "web3-core";
import { ConfigManager } from "../configManager";
import { FastTxSender } from "../tools/FastTxSender";
import { isErrorWithMessage, toErrorWithMessage } from "../utils/error";
import { sleep } from "../utils/time";



async function runPerformanceTests() {

  const web3 = ConfigManager.getWeb3();
  const { toWei, toBN } = web3.utils;
  const sendAccounts : Array<Account> = [];

  //const minBalance = toBN(toWei('1', 'ether'));
  // min gas price delivers wrong information from rpc.

  const minGasPrice = '1000000000';
  const minBalance = toBN(minGasPrice).mul(toBN(21000));
  console.log("Min gase Price:", minGasPrice);

  
  // const fundingPromises : Array<PromiEvent<TransactionReceipt>> = [];

  let transactionSuccesses = 0;
  // let nonce = await web3.eth.getTransactionCount(web3.eth.defaultAccount!);
  
  let fastTxSender = new FastTxSender(web3);
  console.log('Creating accounts for wallet, using funding address: ', web3.eth.defaultAccount);

  let maxTransactionsAtOnce = 80;

  for(let i = 1; i <= 100; i++) {

    
    const account = web3.eth.accounts.create(`test${i}` );
    web3.eth.accounts.wallet.add(account);
    sendAccounts.push(account);
    const balance = web3.utils.toBN(await web3.eth.getBalance(account.address));

    if (balance.lt(minBalance)) {
      console.log(`Funding: `, account.address);
      const tx = { from: web3.eth.defaultAccount!, to: account.address, value: minBalance, gas: 21000, gasPrice: minGasPrice };
      fastTxSender.addTransaction(tx);
    }

    if (fastTxSender.rawTransactions.length >= maxTransactionsAtOnce) { 
      console.log('sending funding transactions...');
      await fastTxSender.sendTxs();
      console.log('waiting for transactions to be mined...');
      await fastTxSender.awaitTxs();
      fastTxSender = new FastTxSender(web3);
    }

    // nonce ++;
  }

  console.log('sending Fund accounts transactions...');
  await fastTxSender.sendTxs();

  console.log('waiting for transactions to be mined...');
  await fastTxSender.awaitTxs();
  
  console.log("All funding transactions confirmed.");
  
  for (const account of sendAccounts) {

    let startNonce = await web3.eth.getTransactionCount(account.address);
    for (let i = 0; i < maxTransactionsAtOnce; i++) {
      
      await fastTxSender.addTransaction({ from: account.address, to: account.address, value: 0, gas: 21000, gasPrice: minGasPrice });
    }
  }

  console.log('all Txs prepared - starting sending');
  await fastTxSender.sendTxs();
  console.log('all Txs Sent - awaiting confirmations');
  await fastTxSender.awaitTxs();

  console.log('all tx confirmed.');
  
}

runPerformanceTests();

