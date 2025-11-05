import { ContractManager } from "../contractManager";



async function printNodeOperatorShares() {

    const { ConfigManager } = await import("../configManager");
    const web3 = ConfigManager.getWeb3();

    const cm = ContractManager.get();
    const staking = await cm.getStakingHbbft();
    const allPools = await cm.getAllPools();

    let grantTotalStakes = web3.utils.toBN(0);

    //const totalStakeAllPoolCalculated = toBN();
    console.log("stakes:");
    for (const pool of allPools) {

        const shareAddress = await cm.getPoolOperatorAddress(pool);
        console.log(pool, " -> ", shareAddress);

        const totalStake = await cm.getTotalStake(pool);
        console.log(pool, " -> ", totalStake.toString(10));
        let totalStakeCalced = web3.utils.toBN(0);
        console.log(pool, " (", shareAddress, ")", " => ", web3.utils.fromWei(totalStake.toString(10), "ether"));
        let  poolDelegators = await staking.methods.poolDelegators(pool).call();

        let inactiveDelegators = await staking.methods.poolDelegatorsInactive(pool).call();


        let allDelegators = new Set<string>(poolDelegators);
        
        for (let inactiveD of inactiveDelegators) { 
            console.log(" adding inactive dele ", inactiveD);
            allDelegators.add(inactiveD);
        };
        
        const delegatorsToAnalyse = Array.from(allDelegators).sort();
        for (const dele of delegatorsToAnalyse) {
            const stake = await staking.methods.stakeAmount(pool, dele).call();
            const orderedWithdrawAmount = await cm.getOrderedWithdrawalAmount(pool, pool);
            totalStakeCalced = totalStakeCalced.add(web3.utils.toBN(stake));
            console.log("   delegator ", dele, " stake: ", web3.utils.fromWei(stake, "ether"));
            if (!orderedWithdrawAmount.isZero()) {
                console.log(" withdraw ordered: ", web3.utils.toWei(orderedWithdrawAmount.toString(10), "ether"));
            }
        }

        let stakeAmountSelf = await staking.methods.stakeAmount(pool, pool).call(); 
        totalStakeCalced = totalStakeCalced.add(web3.utils.toBN(stakeAmountSelf));
        console.log("self: ", stakeAmountSelf);

        const orderedWithdrawAmount = await cm.getOrderedWithdrawalAmount(pool, pool);
        if (!orderedWithdrawAmount.isZero()) console.log("   pool owner withdraw order: ", web3.utils.fromWei(orderedWithdrawAmount.toString(10)));

        //contractManager.getStakingHbbft(;)
        console.log("   calced total stake: ", web3.utils.fromWei(totalStakeCalced.toString(), "ether"));
        console.log(" total stake:",  web3.utils.fromWei(totalStake.toString(10), "ether"));
        const diff = totalStakeCalced.sub(web3.utils.toBN(totalStake.toString(10)));
        console.log("   difference", web3.utils.fromWei(diff.toString(10), "ether"));
        console.log("======");

        grantTotalStakes = grantTotalStakes.add(web3.utils.toBN(totalStake.toString(10)));
    }

    const contractBalanace = await web3.eth.getBalance(staking.options.address);

    

    console.log(">>>>>>>>>> Grant Total Comparision <<<<<<<<<<<<<<<<<");
    console.log(" grand total stakes: ", web3.utils.fromWei(grantTotalStakes.toString(10)), "DMD");
    console.log(" contract balance:   ", web3.utils.fromWei(contractBalanace), "DMD");
    const grantTotalDiff = grantTotalStakes.sub(web3.utils.toBN(contractBalanace));
    console.log(" grand total difference: ", web3.utils.fromWei(grantTotalDiff.toString(10)), "DMD");
}

printNodeOperatorShares();
