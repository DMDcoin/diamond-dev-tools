import { Transaction } from "web3-core";
import { ConfigManager } from "../configManager";
import { getPendingTransactions } from "../tools/web3tools";
import { ContractManager } from "../contractManager";


// function groupBy(list, keyGetter) {
//     const map = new Map();
//     list.forEach((item) => {
//          const key = keyGetter(item);
//          const collection = map.get(key);
//          if (!collection) {
//              map.set(key, [item]);
//          } else {
//              collection.push(item);
//          }
//     });
//     return map;
// }


async function run() {

    console.log("started");

    const web3 = ConfigManager.getWeb3();

    //web3.eth.getPendingTransactions

    
    // web3.currentProvider.

     let pending: Array<Transaction> = await getPendingTransactions();

     console.log("got pending transaction: ", pending.length);
    // try {
    //     pending = await web3.eth.getPendingTransactions();
    // } catch(e) { 
    //     console.log("BEGIN     RPC Error fetching. ", e);
    //     console.log("END       RPC Error fetching. ");
    //     return;
    // }
    // get all unique addresses from pending transactions.

//    console.log("pending:", pending.length);

    const addresses = new Map<string, Transaction[] >();

    pending.forEach(x => {
        
        let existing = addresses.get(x.from);
        if (!existing) {
            existing = [x];
            addresses.set(x.from, existing);
        }
        else {
            existing.push(x);
        };
    });

    const contractManager = ContractManager.get();
    const permissionContract = contractManager.getContractPermission();
    
    for (const x of addresses) {
        // x[0]

        // conver x[1] to array
        // sort by nonce
        // find gaps
        // print gaps

        const transactions = x[1].sort((a, b) => a.nonce - b.nonce);
        const address = x[0];
        const transactionCount = await web3.eth.getTransactionCount(address);

        console.log("address", address );
        console.log("transactionCount", transactionCount );
        for (const x of transactions) {

            const gasPrice = web3.utils.toBN(x.gasPrice);

            let serviceInfo = " (regular)";

            if (gasPrice.isZero()) {
                const allowed = await permissionContract.methods.allowedTxTypes(x.from, x.to!, x.value, x.gasPrice, x.input).call();
                serviceInfo = ` (service: ${allowed})`;
            }

            console.log(x.nonce + " - " + x.hash + " - ", serviceInfo);
        }
    }
}


run();
