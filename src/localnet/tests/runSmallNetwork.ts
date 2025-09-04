import Web3 from "web3";
import {
  LocalnetScriptRunnerBase,
  LocalnetScriptRunnerResult,
} from "./localnetBootstrapper";

export class SmallNetworkRunner extends LocalnetScriptRunnerBase {
  public constructor() {
    super("nodes-local-test-small-network", "simple test with a network that consists of 4 nodes", 4);
  }

  async runImplementation(): Promise<boolean> {
    return true;
  }
}



async function run() {
  let runner = new SmallNetworkRunner();
  await runner.start();
}

run();
