import { ContractManager } from "../../contractManager";
import { NodeManager } from "../../net/nodeManager";
import { sleep } from "../../utils/time";
import Web3 from "web3";
import { createBlock } from "./testUtils";
import { Watchdog } from "../../watchdog";
import { stakeOnValidators } from "../../net/stakeOnValidators";
import { EarlyEpochEndRunner } from "./runEarlyEpochTest";

async function runEarlyEpochTestNetwork() {
  let runner = new EarlyEpochEndRunner();

  runner.start();
}
runEarlyEpochTestNetwork();
