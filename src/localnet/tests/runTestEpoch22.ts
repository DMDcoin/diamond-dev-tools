

import Web3 from "web3";
import {
  LocalnetScriptRunnerBase,
  LocalnetScriptRunnerResult,
} from "./localnetBootstrapper";
import { ConfigManager } from "../../configManager";
import { Watchdog } from "../../watchdog";
import { ContractManager } from "../../contractManager";
import { spoolWait } from "../../utils/time";
import { all } from "axios";

export class Epch22NetworkRunner extends LocalnetScriptRunnerBase {
  public constructor() {
    super("nodes-local-test-epoch22", "incident_22", 4, 6);
    // "reproduces Epoch22 incident of DMD mainnet  https://github.com/DMDcoin/Diamond/issues/6"
  }

  async setNodeOperator(testPool: string) {
    
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
        console.log("setting rng node operator share ", testPool,  " testPool ", random);  
        
        let nodeOperatorAddress = "";

        if (Math.random() > 0.5) { 
          nodeOperatorAddress = poolMiner;
        }  else {
          // random address
          const randomAccount = web3.eth.accounts.create();
          nodeOperatorAddress = randomAccount.address;
        }

        let tx = staking.methods.setNodeOperator(testPool , random).send({ from: testPool, gas: 500000, gasPrice: web3.utils.toWei("1", "gwei") });
        tx.once("transactionHash", (hash: string) => {
          console.log("setting rng node operator share setNodeOperator tx:", hash);
        });

        await tx;
        console.log("WARN: User ", testPool, " managed to stake on own Node!!");
      }
      else {

        let nodeOperatorAddress = "0x0000000000000000000000000000000000000000";
        const rng = Math.random(); 
        
        if (rng > 0.5) { // in 50 % of cases, we switch to a random Node Operator instead of zero
          nodeOperatorAddress =  web3.eth.accounts.create().address;
        }

        console.log("setting rng node operator share to noone at pool: ", testPool);
        await staking.methods.setNodeOperator(nodeOperatorAddress, 0 ).send({ from: testPool, gas: 500000, gasPrice: web3.utils.toWei("1", "gwei") });
      }

      // console.log("setting validator share: ", testPool, " mining: ", poolMiner, " contract address ", staking.options.address, " balance: ", await web3.eth.getBalance(testPool));
      // console.log("wallet accounts: ", web3.eth.accounts.wallet.length);

      
      // tx.on("transactionHash", (hash: string) => { 
      //   console.log("setting validator share tx:", hash);
      
      
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

    let wait = async () => {
      console.log("waiting for epoch", epoch + 1);
      await spoolWait(1000, async () => {
        const newEpoch = await contractManager.getEpoch();      
        const result =  newEpoch > epoch;
        epoch = newEpoch;
        return result;
      });
    };

    const staking = await contractManager.getStakingHbbft();
    //const testPool = allPools[1];
    // pick random pool
    
    function getTestPoolAddress() {
      let rng = Math.floor((Math.random() * allPools.length));
      let result = allPools.at(rng)!;
      console.log("choosing pool", rng, result);
      return result;
    };

    console.log("setting first Node operator:");
    await this.setNodeOperator(getTestPoolAddress());


    console.log("Pools Operator Shares:");

    for (const pool of allPools) {

      //const operator = cm.getPoolOperatorAddress(pool);
      //const shares = await pool.getOperatorShares();
      //console.log(`Pool: ${pool.address} | Operator: ${operator} | Shares: ${web3.utils.fromWei(shares.toString(), "ether")} DMD`);

      const shareAddress = await contractManager.getPoolOperatorAddress(pool);
      console.log(pool, " -> ", shareAddress);
    }


    console.log("wait 1:");

    await wait();

    console.log("doing delegator stakes:");

    await stakeAsDelegatorOnPool( getTestPoolAddress(), contractManager);

    const interval = 1000;
    console.log("starting  applying Random Actions with an interval of ", interval, " ms");
    
    let isInProgress = false;
    setInterval(async () => {
      
      if (isInProgress) {
        console.log("skipping interval, still in progress");
        return;
      }
      isInProgress = true;
      try {
        const rng = Math.random()
        if (rng < 0.3)  {
          console.log("Interval delegator stake and node operator set:");
          await stakeAsDelegatorOnPool(getTestPoolAddress(), contractManager);
        } else if (rng < 0.65) {
          console.log("(un)setting Node operator:");
          await this.setNodeOperator(getTestPoolAddress());
        } else {
          console.log("withdrawing:");
          await this.withdraw(getTestPoolAddress(), contractManager);
        }
      } catch (e) {
        console.log("Error in interval action:", e);
      }
      isInProgress = false;
    }, interval);

    
    for (let index = 0; index < 10; index++) {
      console.log("Awaiting epoch end ", index);
      await wait();
    }

    console.log("stakes:");
    for (const pool of  allPools) {
      console.log(pool, " => ", (await contractManager.getTotalStake(pool)).toString());
      const poolDelegators = await staking.methods.poolDelegators(pool).call();
      for (const dele of poolDelegators) {
        const stake = await staking.methods.stakeAmount(pool, dele).call();
        console.log("   delegator ", dele, " stake: ", stake.toString());
      }

      //contractManager.getStakingHbbft(;)
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
      const validators = await contractManager.getValidators();

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

  const stakeTX = await staking.methods.stake(poolToStakeOn).send({ from: account.address, gas: 300000, value: web3.utils.toWei("100", 'ether') , gasPrice: web3.utils.toWei("1", 'gwei')})

  console.log("Delegator staked 100 DMD on pool ", poolToStakeOn, " tx:", stakeTX.transactionHash);
}