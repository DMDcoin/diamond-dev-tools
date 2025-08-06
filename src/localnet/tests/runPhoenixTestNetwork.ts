import Web3 from "web3";
import {
  LocalnetScriptRunnerBase,
  LocalnetScriptRunnerResult,
} from "./localnetBootstrapper";
import { sleep, spoolWait } from "../../utils/time";
import { ContractManager } from "../../contractManager";
import { NodeRunStateExecuter, NodeRunStateRandomWalkGenerator, NodeRunStateTestSpecification } from "./nodeRunStateTestSpecification";

export class PhoenixTestRunner extends LocalnetScriptRunnerBase {

  public constructor() {
    super("nodes-local-test-phoenix", "phoenix test", 7);
  }

  async restartSet(nodes: number[]) {
      
    // Note: Phonix is designed to handle unknown situations where the network might get stuck.
    // Once the next evolution of the Reliable Message Broadcasting protocol is implemented, 
    // we need a special flag to deactivate the implementation as cargo feature, 
    // so we can mimic a situation where HBBFT cannot progress anymore.
    console.log(
      `restarting Nodes ${nodes}, to mess up unreliable Reliable Message Broadcasting protocol.`
    );
    
  
    await this.stopNodes(nodes);
    this.startNodes(nodes);


    const waitTimeNodeBoot = 2000;
    
    await sleep(waitTimeNodeBoot);

    

  }

  async runImplementation(): Promise<boolean> {


    let randomStates = new  NodeRunStateRandomWalkGenerator().generate(1000, 7);

    console.log(
      `Random walk generated with ${randomStates.length} entries, starting to execute it.`
    );
    NodeRunStateExecuter.exportEntriesToCsvFile(randomStates, "phoenix-test-random-walk.csv");


    const contractManager = new ContractManager(this.web3);

    const epochOnStartup = await contractManager.getEpoch("latest");

    console.log("epoch on startup:", epochOnStartup.toString());

    
    //let nodesToStop = [2, 3, 4];
    // console.log(
    //   `stopping Node ${nodesToStop} block creation should fail.`
    // );

   // await this.stopNodes(nodesToStop);

    // console.log(
    //   "creating block, that cannot be mined (yet)."
    // );
    
   

    const waitTimeForBlockCreation = 1000;
    
    await sleep(waitTimeForBlockCreation);



    let specification : NodeRunStateTestSpecification  = {
      entries: randomStates
    };
    let runStateExecutor = new NodeRunStateExecuter(specification, this.currentNodeManager);

   

   //await this.stopNodes([5, 6 , 7]);
    

   // this.startNodes(nodesToStop);
    

   // await this.startNodes([5, 6 , 7]);

    // await this.restartSet([5,6,7]);
    // await this.restartSet([5,6,7]);
    // await this.restartSet([2,3,4]);
    // // await this.restartSet([5,6,7]);



    // let timeout = setTimeout(() => {
    //   this.handleTimoutError();
    // }, 30000);


    console.log("triggering block production");
    let unminedBlock: Promise<void> = this.createBlock(); 
    //await unminedBlock;//  spoolWait(1000, async () => await contractManager.getEpoch("latest") == epochOnStartup + 1);

    //clearTimeout(timeout);

    while (!runStateExecutor.finished()) {
      
      let shouldProduceBlock = await runStateExecutor.next();

      console.log(
        "....."
      );

      if (shouldProduceBlock) {
        console.log("state ", runStateExecutor.currentStep, " should produce a block awaiting....");
        await unminedBlock;
        unminedBlock = this.createBlock();
      }
    }
    
    console.log(
      "phoenix protocol should now detect a stalled network and therefore should trigger the ."
    );
    
    return true;
  }


  handleTimoutError() {
    throw new Error("Operation was not finished in specified time!");
  }
}



async function run() {
  let runner = new PhoenixTestRunner();
  await runner.start();
}

run();
