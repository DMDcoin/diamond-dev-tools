import { WatchdogPlugin } from "./watchdog-plugin";


export class WatchdogPluginStakingDiff extends WatchdogPlugin {


    
    public async processEpochStart(blockNumber: number, epochNumber: number): Promise<void> {
        
        let cm = this.contractManager!;
        let web3 = cm.web3;
        let staking = await cm.getStakingHbbft();

        const allPools = await cm.getAllPools();

        let grantTotalStakes = web3.utils.toBN(0);

        for (const pool of allPools) {
     
            const totalStake = await cm.getTotalStake(pool);
            let nodeOperator = await cm.getPoolOperatorAddress(pool);
            let poolInfo = `Pool: ${pool} | Operator: ${nodeOperator} | Total stake: ${web3.utils.fromWei(totalStake.toString(10), "ether")} DMD`;
            

            let totalStakeCalced = web3.utils.toBN(0);
            const poolDelegators = await staking.methods.poolDelegators(pool).call();
            for (const dele of poolDelegators) {
                const stake = await staking.methods.stakeAmount(pool, dele).call();
                const orderedWithdrawAmount = await cm.getOrderedWithdrawalAmount(pool, dele);
                totalStakeCalced = totalStakeCalced.add(web3.utils.toBN(stake));
                poolInfo = poolInfo + `\n    Delegator: ${dele} | Stake: ${web3.utils.fromWei(stake, "ether")} DMD | Ordered withdraw: ${web3.utils.fromWei(orderedWithdrawAmount, "ether")} DMD`;

                grantTotalStakes = grantTotalStakes.add(web3.utils.toBN(totalStakeCalced.toString(10)));
            }
    
    
            let stakeAmountSelf = await staking.methods.stakeAmount(pool, pool).call(); 
            
            poolInfo += "\n    Pool owner stake: " + web3.utils.fromWei(stakeAmountSelf, "ether") + " DMD";

            totalStakeCalced = totalStakeCalced.add(web3.utils.toBN(stakeAmountSelf));
            
            const diff = totalStakeCalced.sub(web3.utils.toBN(totalStake.toString(10)));
            
            if (!diff.isZero()) {

                console.log("====== WARNING STAKING DIFF DETECTED ======");
                console.log(poolInfo);
                console.log("   calced total stake: ", web3.utils.fromWei(totalStakeCalced.toString(), "ether"));
                console.log(" total stake:",  web3.utils.fromWei(totalStake.toString(10), "ether"));
                console.log("   difference", web3.utils.fromWei(diff.toString(10), "ether"));
                console.log("======");
            }
        }

        let totalStakedAmount = await staking.methods.totalStakedAmount().call();

        let diffGrantTotal = grantTotalStakes.sub(web3.utils.toBN(totalStakedAmount));

        if (diffGrantTotal.isZero()) {
            console.log("===== WARNING: GRANT TOTAL STAKED AMOUNT DIFF DETECTED ======");
            console.log("   Calculated grand total stakes:  ", web3.utils.fromWei(grantTotalStakes.toString()) );
            console.log("   Contract reported total stakes: ", web3.utils.fromWei(totalStakedAmount.toString()) );
            console.log("   Difference: ", web3.utils.fromWei(diffGrantTotal.toString()) );

        }

    }

}