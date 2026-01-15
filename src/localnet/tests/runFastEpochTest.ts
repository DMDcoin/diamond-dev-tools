import {
  LocalnetScriptRunnerBase
} from "./localnetBootstrapper";
import { sleep, spoolWait } from "../../utils/time";
import { ContractManager } from "../../contractManager";
import { Watchdog } from "../../watchdog";

export class FastEpochRunner extends LocalnetScriptRunnerBase {
  public constructor() {
    super("nodes-local-fast-epochs", "fast_epochs", 4);
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

    await spoolWait(1000, async () => await contractManager.getEpoch("latest") == epochOnStartup + 200);

    return true;
  }
}


let runner = new FastEpochRunner();
runner.start();