import Web3 from "web3";
import {
  LocalnetScriptRunnerBase,
  LocalnetScriptRunnerResult,
} from "./localnetBootstrapper";
import { FastTxSender } from "../../tools/FastTxSender";
import { runPerformanceTests } from "../../tests/performanceTest";

class LargeNetworkTestRunner extends LocalnetScriptRunnerBase {
  constructor() {
    super("nodes-local-test-large-network", "staking test", 25);
  }

  async runImplementation(): Promise<boolean> {

    console.log("Running Performance test.");
    let startTime = Date.now();
    await runPerformanceTests(this.web3);

    let duration = Date.now() - startTime;

    console.log("Performance test took ", duration, " ms");

    
    // we just wanted to know if we can manage to scale up to this network size.
    return true;
  }
}

async function run() {
  let runner = new LargeNetworkTestRunner();
  await runner.start();
}

run();
