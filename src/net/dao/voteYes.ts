import { ConfigManager } from "../../configManager";
import { ContractManager } from "../../contractManager";
import { NodeManager } from "../nodeManager";


async function executeVoting() {

    const calldata = "0x943e8216564319eb0fa2a023e8293f7241f18a0475a3a03188f8b999d5f32dcc4cbcded20000000000000000000000000000000000000000000000000000000000000002";
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
            web3.eth.sendTransaction({from: pool, to: target, data: calldata, gas: 1500000 });

        } else {
            console.log("pool ", pool, " skipped, its not managed by diamond-dev-tools");
        }
    }

} 


executeVoting();