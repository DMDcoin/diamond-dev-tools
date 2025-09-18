import Web3 from "web3";
import {
  LocalnetScriptRunnerBase,
  LocalnetScriptRunnerResult,
} from "./localnetBootstrapper";
import { sleep, spoolWait } from "../../utils/time";
import { ContractManager } from "../../contractManager";

export class AutoUpscaleRunner extends LocalnetScriptRunnerBase {
  public constructor() {
    super("nodes-local-test-early-epoch-end", "auto-upscale", 16);
  }

  async runImplementation(): Promise<boolean> {


    // first we need to downscale


    const contractManager = new ContractManager(this.web3);
    const validatorsOnStartup = await contractManager.getValidators();
    const nodeManager = this.currentNodeManager;

    console.assert(validatorsOnStartup.length == 16, "expected 16 nodes at startup.");

    // we are going to stop all nodes until we ran down to 1.


    // 0: rpc
    // 1: MoC
    // 2: the node that should take over the network.
    // 3..n: all other nodes that we will stop.
    for(let i = 3; i < validatorsOnStartup.length; i++) { 
        await nodeManager.stopNode(i);
    }

    spoolWait(1000, async () => (await contractManager.getValidators()).length == 1);

    

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
