import Web3 from "web3";
import {
  LocalnetScriptRunnerBase,
  LocalnetScriptRunnerResult,
} from "./localnetBootstrapper";
import { sleep, spoolWait } from "../../utils/time";
import { ContractManager } from "../../contractManager";

export class EarlyEpochEndRunner extends LocalnetScriptRunnerBase {
  public constructor() {
    super("nodes-local-test-phoenix", "phoenix test", 7);
  }

  async runImplementation(): Promise<boolean> {
    // we are on a 16 node validator network now.
    // we expect a early epoch end tolerance of 2. -> todo: maybe we should read that from contract
    // required: 2f + 1
    // f = 5
    // required for consensus: 11.
    // therefor 5 Nodes can be stopped.
    // early epoch end tolerance: 2
    // failable nodes without early epoch end.

    const contractManager = new ContractManager(this.web3);

    const epochOnStartup = await contractManager.getEpoch("latest");

    console.log("epoch on startup:", epochOnStartup.toString());


    let nodesToStop = [2, 3, 4];
    console.log(
      `stopping Node ${nodesToStop} block creation should fail.`
    );

    await this.stopNodes(nodesToStop);

    console.log(
      "creating block, that cannot be mined (yet)."
    );

    let block = this.createBlock();

    console.log(
      "booting up Node 2,3,4, to verify block creation is able to work again."
    );

    this.startNodes(nodesToStop);

    
    console.log(
      "Hbbft message caching should work, and be able to create this block."
    );


    
    let timeout = setTimeout(() => {
      this.handleTimoutError();
    }, 30000);

    await block;//  spoolWait(1000, async () => await contractManager.getEpoch("latest") == epochOnStartup + 1);

    clearTimeout(timeout);
    

    // console.log(
    //   "starting all stopped nodes to test the recovery from missed hbbft messages."
    // );

    // await this.refreshBlock();
    // console.log("waiting for block inclusion...:");
    // await this.refreshBlock();

    // const epochAfterShutdown3Nodes = await contractManager.getEpoch("latest");

    // console.log(`epoch after shutdown of 3 nodes: ${epochAfterShutdown3Nodes.toString()}`);

    return true;
  }


  handleTimoutError() {
    throw new Error("Operation was not finished in specified time!");
  }
}



async function run() {
  let runner = new EarlyEpochEndRunner();
  await runner.start();
}

run();
