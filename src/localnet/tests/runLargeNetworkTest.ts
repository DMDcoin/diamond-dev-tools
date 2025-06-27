

import Web3 from "web3";
import { LocalnetScriptRunnerBase, LocalnetScriptRunnerResult } from "./localnetBootstrapper";


class LargeNetworkTestRunner extends LocalnetScriptRunnerBase {


    constructor() {
        super("nodes-local-test-large-network", "staking test", 25);

    }

    async runImplementation(): Promise<boolean> {

        // we just wanted to know if we can manage to scale up to this network size.
        return true;
    }
}


async function run() {
    let runner = new LargeNetworkTestRunner();
    await runner.start();
}
let runner = new LargeNetworkTestRunner();

run();

