import { ConfigManager } from "../../configManager";
import { ContractManager } from "../../contractManager";
import { NodeManager } from "../nodeManager";


async function executeVoting() {

    // http://62.84.188.137/#/dao
    const calldata = "0x943e8216d0847732c2122bb64bd18ad6a96a980029146521b0c7982b6d8250ec526138e70000000000000000000000000000000000000000000000000000000000000001";
    const target = "0xDA0da0da0Da0Da0Da0DA00DA0da0da0DA0DA0dA0";
    const web3 = ConfigManager.getWeb3();

    const numWallets = 40;

    let wallets = ConfigManager.insertWallets(web3, numWallets);

    console.log("default gas price:", await web3.eth.getGasPrice());
    //const nodeManager = NodeManager.get();

    const contractManager = ContractManager.get();
    
    const pools = await contractManager.getAllPools();
    console.log("node states: ")
    for(let pool of pools) {

        if (wallets.find((x) => x.address.toLowerCase() == pool.toLowerCase())) {
            console.log("pool:", pool, " voting.");
            let tx = web3.eth.sendTransaction({from: pool, to: target, data: calldata, gas: 1500000 });
            tx.once("error", (e) => { console.log("error for pool ", pool)})
        } else {
            console.log("pool ", pool, " skipped, its not managed by diamond-dev-tools");
        }
    }

} 


executeVoting();