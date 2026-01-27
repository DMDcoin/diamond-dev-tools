import BigNumber from "bignumber.js";
import { PromiEvent, TransactionReceipt } from "web3-core";
import { ContractManager } from "../contractManager";
import { getNodesFromCliArgs } from "../remotenet/remotenetArgs";
import { ConfigManager } from "../configManager";
import { del } from "request";


function logPromiEvent(tx: PromiEvent<TransactionReceipt>) {
  tx.on("transactionHash", (hash) => {
    console.log(`Hash: ${hash}`);
  });

  tx.on("sending", (payload) => {
    console.log(`sending:`, payload);
  });


  tx.on("receipt", (receipt) => {
    console.log(`receipt: ${receipt}`);
  });
}

export async function unstake(){


  console.log("Unstakes all delegator stake associated with the .mnemonic");


  const contractManager = ContractManager.get();
  const staking = await contractManager.getStakingHbbft();
  const pools = await contractManager.getPoolsInactive();
  

  const web3 = contractManager.web3;

  const accounts = ConfigManager.insertWallets(web3, 100);

  const validators = await contractManager.getValidators();

  
  for(let pool of pools) {

    console.log("checking pool: ", pool);
    
    const miningAddress = await contractManager.getAddressMiningByStaking(pool);
    //const stakingAddressBN = new BigNumber(stakingAddress);

    if (validators.includes(miningAddress)) {
      console.log(`INFO: Node is validator, skipping this node: ${pool}`);
      continue;
    }


    const delegators = await contractManager.getPoolDelegators(pool);

    for (const delegator of delegators) {

      const foundStaker = accounts.find((v) => { v.address.toLowerCase() == delegator.toLowerCase()})      
      if (!foundStaker) {
        console.log("not a delegator managed by this wallet: ", delegator, " on pool ", pool);
        continue;
      }

      console.log("delegator: ", delegator, " on pool ", pool);

      //const stakeAmount = new BigNumber(await staking.methods.stakeAmount(pool, delegator).call());
      const maxWithdrawAllowed = await staking.methods.maxWithdrawAllowed(pool, delegator).call({from: delegator });
      const maxWithdrawAllowedBN = web3.utils.toBN(maxWithdrawAllowed);


      if (maxWithdrawAllowedBN.isZero()) {
        console.log(`INFO: nothing withdrawable for: ${delegator}`);
        continue;
      }

      const withdraw = staking.methods.withdraw(pool, maxWithdrawAllowed).send({from: delegator, gas: 1000000 });

      logPromiEvent(withdraw);

      await withdraw;


    }



    // nodeText = `${node.nodeID} ${node.address} staking Address: ${stakingAddress}`;

    // if (stakeAmount.isZero()) {
    //   console.log(`INFO: nothing at stake for: ${nodeText}`);
    //   continue;
    // }



    // // we keep a symbolik  stake so the pool does not get removed.
    // console.log("max withdraw allowed for ", stakingAddress, ": ", maxWithdrawAllowed);
    // const withdrawAmount = maxWithdrawAllowed //stakeAmount.minus(1.0).toString(10);
    // console.log(`${nodeText} withdrawing ${withdrawAmount}`);

  }  
}

unstake();