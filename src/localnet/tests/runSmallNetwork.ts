
import { Watchdog } from "../../watchdog";
import {
  LocalnetScriptRunnerBase
} from "./localnetBootstrapper";

export class SmallNetworkRunner extends LocalnetScriptRunnerBase {
  public constructor() {
    super("nodes-local-test-small-network", "simple test with a network that consists of 4 nodes", 4);
  }

  async runImplementation(watchdog: Watchdog): Promise<boolean> {
    return true;
  }
}



async function run() {
  let runner = new SmallNetworkRunner();
  await runner.start();
}

run();
