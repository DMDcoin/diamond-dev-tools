import { ContractManager } from "../contractManager";



async function printNodeOperatorShares() {

    const { ConfigManager } = await import("../configManager");
    const web3 = ConfigManager.getWeb3();

    const cm = ContractManager.get();
    const staking = await cm.getStakingHbbft();
    const allPools = await cm.getAllPools();

    //const totalStakeAllPoolCalculated = toBN();
    console.log("stakes:");
    for (const pool of allPools) {

        const shareAddress = await cm.getPoolOperatorAddress(pool);
        console.log(pool, " -> ", shareAddress);

        const totalStake = await cm.getTotalStake(pool);
        console.log(pool, " -> ", totalStake.toString(10));
        let totalStakeCalced = web3.utils.toBN(0);
        console.log(pool, " (", shareAddress, ")", " => ", web3.utils.fromWei(totalStake.toString(10), "ether"));
        const poolDelegators = await staking.methods.poolDelegators(pool).call();
        for (const dele of poolDelegators) {
            const stake = await staking.methods.stakeAmount(pool, dele).call();
            const orderedWithdrawAmount = await cm.getOrderedWithdrawalAmount(pool, pool);
            totalStakeCalced = totalStakeCalced.add(web3.utils.toBN(stake));
            console.log("   delegator ", dele, " stake: ", web3.utils.fromWei(stake, "ether"), " withdraw ordered: ", web3.utils.toWei(orderedWithdrawAmount.toString(), "ether"));
        }

        let stakeAmountSelf = await staking.methods.stakeAmount(pool, pool).call(); 
        totalStakeCalced = totalStakeCalced.add(web3.utils.toBN(stakeAmountSelf));
        console.log("self: ", stakeAmountSelf);


        console.log("   pool owner withdraw order: ",);
        //contractManager.getStakingHbbft(;)
        console.log("   calced total stake: ", web3.utils.fromWei(totalStakeCalced.toString(), "ether"));
        console.log(" total stake:",  web3.utils.fromWei(totalStake.toString(10), "ether"));
        const diff = totalStakeCalced.sub(web3.utils.toBN(totalStake.toString(10)));
        console.log("   difference", web3.utils.fromWei(diff.toString(10), "ether"));
        console.log("======");
    }
}

printNodeOperatorShares();
