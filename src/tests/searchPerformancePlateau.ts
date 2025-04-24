import { ConfigManager } from "../configManager";
import { ContractManager } from "../contractManager";
import { sleep } from "../utils/time";
import fs from "fs";
import { awaitTransactions } from "../tools/awaitTransactions";
import { HttpProvider } from "web3-core";
import request from "request";
import { toNumber } from "../utils/numberUtils";



export async function write_performance_plateau_csv_header(outputFile: string) {
  fs.writeFileSync(outputFile, `"tx_per_account","num_of_accounts","num_of_validators","total_txs","number_of_blocks","sum_of_block_time","blockStart","blockEnd","block_per_second","txs_per_second"\n`);
  
}

/// searches performance plateau and appends it to a param outputFile.
/// outputFile is expected as existing file.
/// used function write_performance_plateau_csv_header to create the header for this CSV file.
export async function search_performance_plateau(outputFile: string) {


  // the RPC default config is 88.
  // maybe we should stick to this.
  const maxTransactionsAtOnce = 87;

  const contractManager = ContractManager.get();
  const web3 = contractManager.web3;

  const wallets = ConfigManager.insertWallets(web3, maxTransactionsAtOnce);

  const defaultGasPrice = '1100000000';
  console.log("Warmup: Funding Accounts.");

  let confirmed = 0;
  let feedAccount = web3.eth.defaultAccount!;
  let nonceFeed = await web3.eth.getTransactionCount(feedAccount);


  console.log("feeding account: ", feedAccount);

  let feedAccountBalance = web3.utils.toBN(await web3.eth.getBalance(feedAccount));

  console.log("feeding account Balance in DMD: ", web3.utils.fromWei(feedAccountBalance, "ether"));

  let feedPerAccount = web3.utils.toBN(web3.utils.toWei('1', "ether"));
  
  let totalRequiredBalance = feedPerAccount.mul(web3.utils.toBN(wallets.length + 1 /**+ 1 for gas fees */));


  if (feedAccountBalance.lt(totalRequiredBalance)) {
    console.log("Not enough funds in feed account. Please fund it with at least: ", web3.utils.fromWei(totalRequiredBalance, "ether"));
    return;
  }
  
  for(const wallet of wallets) {
    web3.eth.sendTransaction({ from: feedAccount, to: wallet.address, nonce: nonceFeed, value: feedPerAccount, gas: "21000", gasPrice: defaultGasPrice})
      .once("receipt", () => {
        confirmed++
      });
      nonceFeed++;
  }

  console.log('waiting for Accounts to be funded.');

  while ( confirmed < wallets.length) {
    console.log(`confirmed ${confirmed}/${wallets.length}`);
    await sleep(1000);
  }

  console.log('funds transfers confirmed.');
  console.log('Ramping up - finding plateu');

  let txPerAccount = 1;
  console.log(`writing output to ${outputFile}`);
  fs.writeFileSync(outputFile, `"tx_per_account","num_of_accounts","num_of_validators","total_txs","number_of_blocks","sum_of_block_time","blockStart","blockEnd","block_per_second","txs_per_second"\n`);
   
  // console.log(`sending one transaction to warmup block production`);
  // make a transaction to ensure the start of block production on hbbft.
  //  web3.eth.sendTransaction({ from: web3.eth.defaultAccount!, to: web3.eth.defaultAccount!, nonce: nonceFeed, value: web3.utils.toWei('1', "ether"), gas: "21000", gasPrice: defaultGasPrice});

  while (txPerAccount < maxTransactionsAtOnce) { // this while condition is kind of a max - we early exit if we have found a plateau.

    
    const blockStart = await web3.eth.getBlockNumber();
    const blockStartInstance = await web3.eth.getBlock(blockStart);
    const blockStartTime = toNumber(blockStartInstance.timestamp);

    let totalTxs = txPerAccount * wallets.length;
    let transactionHashesToConfirm : Array<string> = [];

    console.log(`Starting test section with ${txPerAccount} transactions per account with ${wallets.length} accounts. Total TX: ${totalTxs}`);

    //let provider : HttpProvider = web3.eth.currentProvider as HttpProvider;
    
    
    let sendAddress =  ConfigManager.getNetworkConfig().rpc;

    for(const wallet of wallets) {

      let nonce = await web3.eth.getTransactionCount(wallet.address);
      // let signedTransaction : Array<SignedTransaction> = [];
      for(let i = 0; i<txPerAccount; i++) {
        const txConfig = {from: wallet.address, to: wallet.address, value: '0', nonce, gas: "21000", gasPrice: defaultGasPrice};
        const signed =  await wallet.signTransaction(txConfig);
        
        
        if (signed.transactionHash) {
          transactionHashesToConfirm.push(signed.transactionHash);
        }
        else {
          console.log('no hash for tx', txConfig);
        }

        // todo: sendSignedTransaction puts a lot of load on to NodeJS and the RPC Node.
        // https://github.com/web3/web3.js/issues/4034
        // a solution could be:
        // web3.currentProvider.send({
      //     method: 'eth_sendRawTransaction',
      //     params: [rawSignedTxData],
      //     jsonrpc: "2.0",
      // }, (error, result) => { ... });
        // web3.eth.sendSignedTransaction(signed.rawTransaction!);
        
        //web3.eth.sendSignedTransaction(signed.rawTransaction!);

        if (web3.eth.currentProvider) {
          // console.log(web3.eth.currentProvider);

          


          /*if ( provider) */ {
            // console.log('this is a httpProvider!');
            // web3.eth.currentProvider.send();
            // let prov : HttpProvider = web3.eth.currentProvider;
            
            let rpc_cmd =
            {
              method: 'eth_sendRawTransaction',
              params: [signed.rawTransaction],
              jsonrpc: "2.0",
              id: 666
            }

            // curl --data '{"method":"eth_sendRawTransaction","params":["0xd46e8dd67c5d32be8d46e8dd67c5d32be8058bb8eb970870f072445675058bb8eb970870f072445675"],"id":1,"jsonrpc":"2.0"}' -H "Content-Type: application/json" -X POST localhost:8545
            var headersOpt = {  
              "content-type": "application/json",
            };
            
            request.post(
              sendAddress, // todo: distribute transactions here to different nodes.
              {
                json: rpc_cmd,
                headers: headersOpt
              },
              function (error, response, body) {
                if (error) {
                  //Trying to close the socket (to prevent socket hang up errors)
                  //**Doesn't help**
                  console.log('got error:', error);
                  return;
                }
                if (response) {
                  // console.log('got reponse:', response.statusCode);
                  // console.log('got reponse body:', response.body);
                }
                
                
              });
            }
            
            // provider.send(rpc_cmd, (e, r) => {
            //   if (e) {
            //     console.log('Json RPC error: ', e);
            //   }
            //   if (r) {
            //     console.log('Json RPC Result: ', r);
            //   }
            //});
            
          // } else {
          //   throw Error("Not a HTTP Provider!");
          // }

        }
        //  web3.eth.sendSignedTransaction(signed.rawTransaction!);
          //   web3.currentProvider.send({
          //     method: 'eth_sendRawTransaction',
          //     params: [signed.rawTransaction!],
          //     jsonrpc: "2.0",
          // });
        //}
        
        
        //web3.eth.signTransaction({});
        // web3.eth.sendTransaction({ from: wallet.address, to: wallet.address, value: '0', nonce, gas: "21000", gasPrice: defaultGasPrice})
        // .once("transactionHash", (transactionHash) => {
        //   transactionHashesToConfirm.push(transactionHash);
        // });
        nonce++;
      }
    }

    // console.log(`waiting until all ${totalTxs} transactions was sent`);

    // while(transactionHashesToConfirm.length < totalTxs) {
    //   console.log(`${transactionHashesToConfirm.length}/${totalTxs} ( ${(transactionHashesToConfirm.length/totalTxs).toPrecision(4)}%)`);
    //   sleep(1000);
    // }

    console.log(`transactions Sent: ${transactionHashesToConfirm.length} scanning blocks to verify transaction receipts...`);
    


    const blockEnd = await awaitTransactions(web3, blockStart, transactionHashesToConfirm);
    console.log(`all transactions confirmed with block:`, blockEnd);

    const blockEndInstance = await web3.eth.getBlock(blockEnd);
    const numOfBlocks = blockEnd - blockStart;
    const blockEndTime = toNumber(blockEndInstance.timestamp);
    const sumOfBlockTime = blockEndTime - blockStartTime;
    const blocksPerSecond = numOfBlocks / sumOfBlockTime;
    const txsPerSecond = totalTxs / sumOfBlockTime;

    const validators = await contractManager.getValidators();

    fs.appendFileSync(outputFile, `"${txPerAccount}","${wallets.length}","${validators.length}", "${totalTxs}","${numOfBlocks}","${sumOfBlockTime}","${blockStart}","${blockEnd}","${blocksPerSecond.toPrecision(4)}","${txsPerSecond.toPrecision(4)}"\n`);
    txPerAccount++;
  }
  

  console.log('transactions funded.');

}
