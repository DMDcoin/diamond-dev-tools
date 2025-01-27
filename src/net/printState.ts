// the RPC Nodes holds the data, 
// all other nodes get deleted the caches.

import { ContractManager } from "../contractManager";
import { NodeManager } from "./nodeManager";

export async function printState(nodeManager: NodeManager, contractManager: ContractManager) {


  const validatorSet = contractManager.getValidatorSetHbbft();
  const staking = await contractManager.getStakingHbbft();
  const keyGenHistory = await contractManager.getKeyGenHistory();

  const epochStartTime = new Date(Number.parseInt(await staking.methods.stakingEpochStartTime().call()) * 1000);
  const phaseTransition = new Date(Number.parseInt(await staking.methods.startTimeOfNextPhaseTransition().call()) * 1000);
  const epochEndTime = new Date(Number.parseInt(await staking.methods.stakingFixedEpochEndTime().call()) * 1000);


  console.log(`epoch start time UTC: ${epochStartTime.toUTCString()}`);
  console.log(`next Phase Transition UTC: ${phaseTransition.toUTCString()}`);
  console.log(`Epoch End Time: UTC: ${epochEndTime.toUTCString()}`);


  const pendingValidators = await validatorSet.methods.getPendingValidators().call()
  console.log(`pending validators:`, pendingValidators);

  for (let i = 0; i < pendingValidators.length; i++) {
    const pendingValidator = pendingValidators[i];
    const currentKeyGenMode = await validatorSet.methods.getPendingValidatorKeyGenerationMode(pendingValidator).call();
    console.log(`pending validator ${pendingValidator} key gen mode: `, currentKeyGenMode);
  }

  if (pendingValidators.length > 0) {

    const numberOfKeyFragmentsWritten = await keyGenHistory.methods.getNumberOfKeyFragmentsWritten().call();
    console.log(`number of key fragments written:`, numberOfKeyFragmentsWritten);
  }

  //validatorSetContract.getPendingValidatorKeyGenerationMode(_sender)

  console.log(`likehilihood:`, await staking.methods.getPoolsLikelihood().call());

  nodeManager.nodeStates.forEach(async (s) => {
    if (s.address) {
      // const stakingAddress =  await validatorSet.methods.stakingByMiningAddress(s.address).call();
      // const encodedABI = validatorSet.methods.validatorAvailableSince(stakingAddress).encodeABI();
      // console.log(`call Encoded for ${s.address}:`, encodedABI);
      const callResult = await validatorSet.methods.validatorAvailableSince(s.address).call();
      console.log(`${s.address} available since: ${callResult} ${new Date(Number.parseInt(callResult) * 1000).toUTCString()}`);
      //s.address
    }
  })

}