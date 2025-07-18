import Web3 from "web3";
import {
  LocalnetScriptRunnerBase,
  LocalnetScriptRunnerResult,
} from "./localnetBootstrapper";
import { sleep } from "../../utils/time";

export class SingleNodeRunner extends LocalnetScriptRunnerBase {
  public constructor() {
    super("nodes-local-test-single", "simple 1 validator network", 1);
  }

  async runImplementation(): Promise<boolean> {
    // we are on a 16 node validator network now.
    // we expect a early epoch end tolerance of 2. -> todo: maybe we should read that from contract
    // required: 2f + 1
    // f = 5
    return true;
  }
}


async function run() {
    let runner = new SingleNodeRunner();
    await runner.start();
}
  
run();
  