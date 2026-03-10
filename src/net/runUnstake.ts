import BigNumber from "bignumber.js";
import { PromiEvent, TransactionReceipt } from "web3-core";
import { ContractManager } from "../contractManager";
import { getNodesFromCliArgs } from "../remotenet/remotenetArgs";
import { ConfigManager } from "../configManager";


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


  const contractManager = ContractManager.get();
  const staking = await contractManager.getStakingHbbft();
  const pools = await staking.methods.getPools().call();

  const web3 = contractManager.web3;

  ConfigManager.insertWallets(web3);

  const validators = await contractManager.getValidators();

  const nodes = await getNodesFromCliArgs();

  console.log('running unstake for : ', nodes);

  for(let node of nodes) {
    
    if (!node.address) {
      console.log(`INFO: No Address for node: ${node.nodeID} ${node.address}`);
      continue;
    }


    let nodeText =  `${node.nodeID} ${node.address}`;

    const stakingAddress = await contractManager.getAddressStakingByMining(node.address);
    const stakingAddressBN = new BigNumber(stakingAddress);

    if (stakingAddressBN.isZero()) {
      console.log(`skipping: Not a Pool: ${nodeText}`);
      continue;
    }

    const stakeAmount = new BigNumber(await staking.methods.stakeAmount(stakingAddress, stakingAddress).call());
    nodeText = `${node.nodeID} ${node.address} staking Address: ${stakingAddress}`;

    if (stakeAmount.isZero()) {
      console.log(`INFO: nothing at stake for: ${nodeText}`);
      continue;
    }

    const maxWithdrawAllowed = await staking.methods.maxWithdrawAllowed(stakingAddress, stakingAddress).call({from: stakingAddress });
    const maxWithdrawAllowedBN = web3.utils.toBN(maxWithdrawAllowed);

    if (maxWithdrawAllowedBN.isZero()) {
      console.log(`INFO: nothing withdrawable for: ${nodeText}`);
      continue;
    }

    // we keep a symbolik  stake so the pool does not get removed.
    console.log("max withdraw allowed for ", stakingAddress, ": ", maxWithdrawAllowed);
    const withdrawAmount = maxWithdrawAllowed //stakeAmount.minus(1.0).toString(10);
    console.log(`${nodeText} withdrawing ${withdrawAmount}`);

    if (validators.includes(node.address)) {
      console.log(`INFO: Node is validator, skipping this node: ${nodeText}`);
      continue;
    } else {
      
      const sendTx = staking.methods.withdraw(stakingAddress, withdrawAmount).send({ from: stakingAddress, gas: '1000000' });
      logPromiEvent(sendTx);

      const sendResult = await sendTx;
      console.log(`Executed withdraw for ${nodeText} tx: ${sendResult.transactionHash}`);    
    }
  }  
}

unstake();