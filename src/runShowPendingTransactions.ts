

import { ConfigManager } from "./configManager";

import { Transaction } from  'web3-core';

import * as _ from  'underscore';


function transactionsToString(transactions: Array<Transaction>) {

    const groupyByFrom : _.Dictionary<Transaction[]> = _.groupBy(transactions, function(x){ return x.from });


    for (const key in groupyByFrom) { 
        let txs = groupyByFrom[key];

        console.log("=== sender: ", key, " ===");

        txs = txs.sort((a, b) => {return a.nonce - b.nonce});

        for (const tx of txs) {
            console.log("tx: ", tx.nonce, " - ", tx.hash);
        }
    }
    
}

async function start() {
    const web3 = ConfigManager.getWeb3();
    //seems not to work because web3 doesnt support this functionallity for prarity nodes
    // or in other words: Parity is not compatible. it does not provide a txpool_content function, it provides parity_pendingTransactions
    // see: https://ethereum.stackexchange.com/questions/25454/in-parity-what-is-the-equivalent-rpc-call-to-geths-txpool-content
    const pendingTx = await web3.eth.getPendingTransactions((error, result) => {

        if (!((typeof error) === 'undefined')) {
            console.error(`Error retrieving Transactions: ${typeof error}`, error);

        } else {
            transactionsToString(result);
        }
    });

    transactionsToString(pendingTx);
}

start();

