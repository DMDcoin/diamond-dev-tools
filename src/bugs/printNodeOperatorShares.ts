import { ContractManager } from "../contractManager";



async function printNodeOperatorShares() {

    const { ConfigManager } = await import("../configManager");
    const web3 = ConfigManager.getWeb3();

    const cm = ContractManager.get();

    const allPools = await cm.getAllPools();

    for (const pool of allPools) {

        //const operator = cm.getPoolOperatorAddress(pool);
        //const shares = await pool.getOperatorShares();
        //console.log(`Pool: ${pool.address} | Operator: ${operator} | Shares: ${web3.utils.fromWei(shares.toString(), "ether")} DMD`);

        const shareAddress = await cm.getPoolOperatorAddress(pool);
        console.log(pool, " -> ", shareAddress);
    }
}

printNodeOperatorShares();