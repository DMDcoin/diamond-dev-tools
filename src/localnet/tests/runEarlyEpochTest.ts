import Web3 from "web3";
import {
  LocalnetScriptRunnerBase,
  LocalnetScriptRunnerResult,
} from "./localnetBootstrapper";
import { sleep, spoolWait } from "../../utils/time";
import { ContractManager } from "../../contractManager";
import { Watchdog } from "../../watchdog";

export class EarlyEpochEndRunner extends LocalnetScriptRunnerBase {
  public constructor() {
    super("nodes-local-test-early-epoch-end", "early-epoch-end-test", 16);
  }

  async runImplementation(watchdog: Watchdog): Promise<boolean> {
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


    console.log(
      "stopping Node 2,3,4, creating block should still  work, because of fault tolerance."
    );

    await this.stopNode(2);
    await this.stopNode(3);
    await this.stopNode(4);



    console.log(
      "creating block to verify that block creation still works."
    );



    await this.createBlock();


    console.assert(epochOnStartup == await contractManager.getEpoch("latest"), "Epoch should not have changed yet.");

    console.log(
      "verifying that early epoch end triggers, if we stop an additional node."
    );

    await this.stopNode(5);



    console.log(
      "waiting for early epoch end...."
    );


    await spoolWait(1000, async () => await contractManager.getEpoch("latest") == epochOnStartup + 1);

    

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
}
