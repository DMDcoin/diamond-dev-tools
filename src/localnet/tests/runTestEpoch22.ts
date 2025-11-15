import {
  LocalnetScriptRunnerBase
} from "./localnetBootstrapper";
import { ConfigManager } from "../../configManager";
import { Watchdog } from "../../watchdog";
import { ContractManager } from "../../contractManager";
import { spoolWait } from "../../utils/time";
export class Epch22NetworkRunner extends LocalnetScriptRunnerBase {
  public constructor() {
    super("nodes-local-test-epoch22", "incident_22", 13, 13);
    // "reproduces Epoch22 incident of DMD mainnet  https://github.com/DMDcoin/Diamond/issues/6"
  }

  async unsetNodeOperator(testPool: string) {

    let contractManager = this.createContractManager();
    let staking = await contractManager.getStakingHbbft();
    let web3 = contractManager.web3;

    const poolMiner = await contractManager.getAddressMiningByStaking(testPool);

    let currentOperator = web3.utils.toBN(await contractManager.getPoolOperatorAddress(testPool));

    let isZero = currentOperator.isZero();
    console.log("node operator ", testPool, " for miner ", poolMiner, " current operator  setup operator", currentOperator.toString(16), isZero);

    if (isZero) {
      throw "unsetNodeOperator was expected to have an operator set already.";
    }
    else {

      let nodeOperatorAddress = "0x0000000000000000000000000000000000000000";
      console.log("setting rng node operator share to noone at pool: ", testPool);
      await staking.methods.setNodeOperator(nodeOperatorAddress, 0).send({ from: testPool, gas: 500000, gasPrice: web3.utils.toWei("1", "gwei") });
    }
  }

  async setNodeOperator(testPool: string, operatorAddress: string = "") {


    let contractManager = this.createContractManager();
    let staking = await contractManager.getStakingHbbft();
    let web3 = contractManager.web3;

    const poolMiner = await contractManager.getAddressMiningByStaking(testPool);

    let currentOperator = web3.utils.toBN(await contractManager.getPoolOperatorAddress(testPool));

    let isZero = currentOperator.isZero();
    console.log("node operator ", testPool, " for miner ", poolMiner, " current operator  setup operator", currentOperator.toString(16), isZero);

    let random = Math.floor(Math.random() * 2000);
    console.log("setting node operator share ", testPool, " testPool ", random);

    let finalOperator = operatorAddress == "" ? poolMiner : operatorAddress;
    console.log("set operator: pools:", testPool, " miner: ", poolMiner, " current operator: ", currentOperator, " new operator", finalOperator);


    try {
      let tx = staking.methods.setNodeOperator(finalOperator, random).send({ from: testPool, gas: 500000, gasPrice: web3.utils.toWei("1", "gwei") });
      tx.once("transactionHash", (hash: string) => {
        console.log("setting node operator share setNodeOperator tx:", hash);
      });

      await tx;
      console.log("WARN: User ", testPool, " managed to stake on own Node!!");
    } catch (e) {

      // this is the problem, that is not allowed anymore.
      if (finalOperator.toLowerCase() == testPool.toLowerCase()) {
        console.log("Expected error: ");
        return;
      }
      throw e;
    }
  }

  async switchNodeOperator(testPool: string, operatorAddress: string = "") {

    try {

      let contractManager = this.createContractManager();
      let staking = await contractManager.getStakingHbbft();
      let web3 = contractManager.web3;

      const poolMiner = await contractManager.getAddressMiningByStaking(testPool);

      let currentOperator = web3.utils.toBN(await contractManager.getPoolOperatorAddress(testPool));

      let isZero = currentOperator.isZero();
      console.log("node operator ", testPool, " for miner ", poolMiner, " current operator  setup operator", currentOperator.toString(16), isZero);

      if (isZero) {
        let random = Math.floor(Math.random() * 2000);
        console.log("setting node operator share ", testPool, " testPool ", random);

        let finalOperator = operatorAddress == "" ? poolMiner : operatorAddress;

        let tx = staking.methods.setNodeOperator(finalOperator, random).send({ from: testPool, gas: 500000, gasPrice: web3.utils.toWei("1", "gwei") });
        tx.once("transactionHash", (hash: string) => {
          console.log("setting node operator share setNodeOperator tx:", hash);
        });

        await tx;
        console.log("WARN: User ", testPool, " managed to stake on own Node!!");
      }
      else {

        let nodeOperatorAddress = "0x0000000000000000000000000000000000000000";
        console.log("setting rng node operator share to noone at pool: ", testPool);
        await staking.methods.setNodeOperator(nodeOperatorAddress, 0).send({ from: testPool, gas: 500000, gasPrice: web3.utils.toWei("1", "gwei") });
      }

    } catch (e) {
      console.log("Expected error:");
    }
  }



  async runImplementation(watchdog: Watchdog): Promise<boolean> {

    console.log("Epch22NetworkRunner.runImplementation()");
    //let networkConfig = ConfigManager.getNetworkConfig(this.networkName);

    const contractManager = ContractManager.get();
    const web3 = contractManager.web3;

    ConfigManager.insertWallets(web3);

    console.log("Fetching all pools...");
    const allPools = await contractManager.getPools();
    console.log("pools:", allPools);

    let epoch = await contractManager.getEpoch();
    console.log("epoch:", epoch);

    let stakingEpochDuration: number = 0;

    let networkConfig = this.getNetworkConfig();
    if (networkConfig.builder) {
      if (networkConfig.builder.contractArgs) {

        let tmpNumber = Number.parseInt(networkConfig.builder.contractArgs["STAKING_EPOCH_DURATION"]);
        if (Number.isInteger(tmpNumber)) {
          stakingEpochDuration = tmpNumber;
        }
      }
    }

    if (stakingEpochDuration === 0) {
      throw new Error("Could not determine STAKING_EPOCH_DURATION from network config");
    }

    let waitForEpochSwitch = async () => {
      console.log(new Date().toLocaleTimeString() + " waiting for epoch", epoch + 1);

      const startDate = new Date();

      await spoolWait(1000, async () => {


        if ((new Date().getTime() - startDate.getTime()) > (stakingEpochDuration * 1000 * 1.5) /* 50 % extra time, so we dont run into timing issues.*/) {
          throw new Error("Epoch switch dit not happen in expected time");
        }

        const newEpoch = await contractManager.getEpoch();
        const result = newEpoch > epoch;
        epoch = newEpoch;
        return result;
      });
    };

    const staking = await contractManager.getStakingHbbft();

    console.log("waiting until validators become pending.");

    let waitForPending = async () => {
      // await a fresh epoch switch.
      await waitForEpochSwitch();
      let result: string[] = [];
      await spoolWait(1000, async () => {
        const pendingValidators = await contractManager.getPendingValidators();
        result = pendingValidators;
        return pendingValidators.length > 0;
      });

      return result;
    };

    console.log("Setting node operator...");
    const pending = await waitForPending();
    const validatorForExperiment = pending[0];
    let poolForExperiment = await contractManager.getAddressStakingByMining(pending[0]);

    //validatorForExperiment
    console.log("Pending validator for experiment: ", validatorForExperiment, " Pool: ", poolForExperiment);


    //let rngNodeOperatorAddress = web3.eth.accounts.create().address;

    await waitForEpochSwitch();
    await this.setNodeOperator(poolForExperiment, poolForExperiment);
    await waitForEpochSwitch();


    await waitForPending();
    // unset
    await waitForEpochSwitch();


    console.log("setting node operator share to RNG address...");
    //await this.unsetNodeOperator(poolForExperiment);
    await this.setNodeOperator(poolForExperiment, web3.eth.accounts.create().address);

    //console.log("Setting node operator 2...");
    //await waitForPending();
    //await this.setNodeOperator(poolForExperiment, rngNodeOperatorAddress);

    await waitForEpochSwitch();
    await waitForEpochSwitch();
    await waitForEpochSwitch();

    await watchdog.stopWatching();

    console.log("stakes:");
    for (const pool of allPools) {
      const totalStake = await contractManager.getTotalStake(pool);
      let totalStakeCalced = web3.utils.toBN(0);
      console.log(pool, " => ", web3.utils.fromWei(totalStake.toString(), "ether"));
      const poolDelegators = await staking.methods.poolDelegators(pool).call();
      console.log("= delegators =");
      for (const dele of poolDelegators) {
        const stake = await staking.methods.stakeAmount(pool, dele).call();
        const orderedWithdrawAmount = await contractManager.getOrderedWithdrawalAmount(pool, dele);
        totalStakeCalced = totalStakeCalced.add(web3.utils.toBN(stake));
        console.log("   delegator ", dele, " stake: ", web3.utils.fromWei(stake, "ether"), " withdraw ordered: ", web3.utils.toWei(orderedWithdrawAmount.toString(), "ether"));
      }
      console.log("= /delegators =");

      let stakeAmountSelf = await staking.methods.stakeAmount(pool, pool).call();
      totalStakeCalced = totalStakeCalced.add(web3.utils.toBN(stakeAmountSelf));
      console.log("self: ", stakeAmountSelf);


      console.log("   pool owner withdraw order: ",);
      //contractManager.getStakingHbbft(;)
      console.log("   calced total stake: ", web3.utils.fromWei(totalStakeCalced.toString(), "ether"));
      console.log("   difference", web3.utils.fromWei(totalStakeCalced.sub(web3.utils.toBN(totalStake.toString())).toString(), "ether"));
      console.log("======");
    }
    console.log("FINALIZED!!");

    return true;
  }


  async withdraw(pool: string, contractManager: ContractManager) {

    // make a node owner withdraw.

    console.log("withdrawing from pool: ", pool);
    const web3 = contractManager.web3;


    let minStake = await contractManager.getMinStake();

    let stakeAmount = await contractManager.getStake(pool, pool);


    let withdrawAmount = stakeAmount.minus(minStake);

    if (withdrawAmount.lte(0)) {
      console.log("nothing to withdraw for pool owner at pool: ", pool);
      return;
    }

    const poolMiner = await contractManager.getAddressMiningByStaking(pool);
    let validators = await contractManager.getValidators();
    validators.push(...await contractManager.getPendingValidators());

    if (validators.includes(poolMiner)) {
      const orderWithdraw = await contractManager.orderWithdraw(pool, pool, withdrawAmount);
    } else {
      const tx = await contractManager.withdraw(pool, pool, withdrawAmount);
      console.log("withdraw tx:", tx.transactionHash);
    }


    // const tx = web3.eth.sendTransaction({ from: web3.defaultAccount!, to: account.address, value: web3.utils.toWei("101", 'ether'), gas: 21000, gasPrice: web3.utils.toWei("1", 'gwei') })
    // tx.on("transactionHash", (hash: string) => { 
    //   console.log("funding delegator account tx:", hash);
    // });
    // await tx;
    // console.log("funded: ", poolToStakeOn);


    // const staking = await contractManager.getStakingHbbft();

    // const stakeTX = await staking.methods.stake(poolToStakeOn).send({ from: account.address, gas: 300000, value: web3.utils.toWei("100", 'ether') , gasPrice: web3.utils.toWei("1", 'gwei')})

    // console.log("Delegator staked 100 DMD on pool ", poolToStakeOn, " tx:", stakeTX.transactionHash);

  }

}

async function run() {
  let runner = new Epch22NetworkRunner();


  await runner.start();
}

run();


async function stakeAsDelegatorOnPool(poolToStakeOn: string, contractManager: ContractManager) {

  console.log("Staking as delegator on pool: ", poolToStakeOn);

  const web3 = contractManager.web3;

  const account = web3.eth.accounts.create();
  web3.eth.accounts.wallet.add(account);

  const tx = web3.eth.sendTransaction({ from: web3.defaultAccount!, to: account.address, value: web3.utils.toWei("101", 'ether'), gas: 21000, gasPrice: web3.utils.toWei("1", 'gwei') })
  tx.on("transactionHash", (hash: string) => {
    console.log("funding delegator account tx:", hash);
  });
  await tx;
  console.log("funded: ", poolToStakeOn);


  const staking = await contractManager.getStakingHbbft();

  const stakeTX = await staking.methods.stake(poolToStakeOn).send({ from: account.address, gas: 300000, value: web3.utils.toWei("100", 'ether'), gasPrice: web3.utils.toWei("1", 'gwei') })

  console.log("Delegator staked 100 DMD on pool ", poolToStakeOn, " tx:", stakeTX.transactionHash);
}