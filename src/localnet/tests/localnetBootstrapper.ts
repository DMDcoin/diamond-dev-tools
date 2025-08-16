
import { ContractManager } from "../../contractManager";
import { NodeManager } from "../../net/nodeManager";
import { sleep } from "../../utils/time";
import Web3 from "web3";
import { createBlock } from "./testUtils";
import { stakeOnValidators } from "../../net/stakeOnValidators";
import { Watchdog } from "../../watchdog";
import { ConfigManager } from "../../configManager";
import { LocalNetworkCheckpointIo } from "../localNetworkCache";

export interface LocalnetScriptRunnerResult {
  // stdOut: string,
  // stdError: string,
  success: boolean;
}

/// runs a programm on a localnet definition, spins up this localnet,
/// and executes the asynchronous function `runTestImplementation` with the web3 instance of the localnet.
export abstract class LocalnetScriptRunnerBase {


  currentNodeManager: NodeManager;
  lastCheckedBlock: number;
  web3: Web3;
  expectedValidators: number;

  cacheCreatedNetwork: boolean;

  constructor(
    public networkName: string,
    public networkOperation: string,
    public expectedValidators_: number | undefined = undefined
  ) {
    ConfigManager.setNetwork(networkName);
    this.web3 = ConfigManager.getWeb3();
    this.currentNodeManager = NodeManager.get(networkName);
    this.networkOperation = networkOperation;

    this.cacheCreatedNetwork = process.env.TEST_CACHED_NETWORKS ? JSON.parse(process.env.TEST_CACHED_NETWORKS) : false; // Parse TEST_CACHED_NETWORKS

    if (expectedValidators_ === undefined) {
      this.expectedValidators = this.currentNodeManager.nodeStates.length - 1;
    } else {
      this.expectedValidators = expectedValidators_;
    }
    this.lastCheckedBlock = 0;
  }

  protected async createBlock() {
    await createBlock(this.web3, this.lastCheckedBlock);
    await this.refreshBlock();
  }

  protected async stopNode(n: number) {
    console.log(`stopping node ${n}`);
    await this.currentNodeManager!.getNode(n).stop();
    console.log(`node ${n} stopped`);
  }

  protected async stopNodes(nodes: number[]) {

    console.log(`stopping nodes ${nodes.join(", ")}`);
    await this.currentNodeManager!.stopNodes(nodes);
  }

  protected startNode(n: number) {
    console.log(`starting node ${n}`);
    this.currentNodeManager!.startNode(n);
    console.log(`node ${n} started`);
  }


  protected startNodes(nodes: number[]) {
    console.log(`starting nodes ${nodes}`);
    this.currentNodeManager!.startNodes(nodes);
    console.log(`nodes ${nodes} started`);
  }

  protected async refreshBlock() {
    this.lastCheckedBlock = await this.web3.eth.getBlockNumber();
  }

  public async start() {

    console.log("starting localnet script runner for network:", this.networkName, " test operation: ", this.networkOperation);

    let isFreshBoot = true;

    // split the console output.
    let outLog: string[] = [];
    let outError: string[] = [];

    const origConsoleLog = console.log;
    const origConsoleError = console.error;

    console.log = (...args: any[]) => {
      outLog.push(...args);
      origConsoleLog(...args);
    };

    console.error = (...args: any[]) => {
      outError.push(...args);
      origConsoleError(...args);
    };

    const networkName = this.networkName;

    let createNewNetwork = true;
    if (this.cacheCreatedNetwork) {

      const localNetworkCache = new LocalNetworkCheckpointIo(this.networkName, this.networkOperation);
      if (localNetworkCache.restoreNetworkFromState()) {
        console.log(
          `Restored network ${networkName} from cache. Continuing with existing network.`
        );
        createNewNetwork = false;
        isFreshBoot = false;
      } else {
        console.log(
          `No cache found for network ${networkName}. Creating new network.`
        );
      }
    }

    let nodesManager = NodeManager.get(networkName);

    if (createNewNetwork) {
      console.log("creating new network");
      await nodesManager.createLocalNetwork();
      console.log("new network created");
    }

    // if (!nodesManager) {
    //   throw new Error(
    //     `Network ${networkName} not found. Please create it with 'npm run testnet-fresh-${networkName}'`
    //   );
    // }

    // we need to reinitialize the nodesManager after creating the network.
    nodesManager = NodeManager.get(networkName);

    console.log(`starting rpc`);
    nodesManager.rpcNode?.start();

    console.log(
      `Starting up the network. Total nodes: ${nodesManager.nodeStates.length}`
    );

    for (let node of nodesManager.nodeStates) {
      node.start();
    }

    console.log(`all normal nodes started.`);

    await nodesManager.awaitRpcReady();
    console.log("rpc is ready!");
    let contractManager = ContractManager.getForNetwork(this.networkName);

    let watchdog = new Watchdog(contractManager, nodesManager);
    watchdog.startWatching(true);

    if (isFreshBoot) {
      await stakeOnValidators(this.expectedValidators);
    }

    console.log(
      `waiting until ${this.expectedValidators} validators took over the ownership of the network.`
    );

    let currentValidators = await contractManager.getValidators();
    while (currentValidators.length < this.expectedValidators) {
      await sleep(1000);
      currentValidators = await contractManager.getValidators();
    }

    console.log(
      `we are running now on a ${this.expectedValidators} validator testnetwork ${this.networkName}. starting test:`,
      this.networkOperation
    );

    let web3 = contractManager.web3;

    let start_block = await web3.eth.getBlockNumber();
    console.log("current block:", start_block);

    this.lastCheckedBlock = start_block;

    // if we want a rerun cache, we need to store the current state here.

    if (createNewNetwork && this.cacheCreatedNetwork) {
      console.log(
        `creating a cache of the current network state for future performance increase. shutting down.`
      );

      await watchdog.stopWatching();

      await nodesManager.stopAllNodes();
      await nodesManager.stopRpcNode();

      const localNetworkCache = new LocalNetworkCheckpointIo(this.networkName, this.networkOperation);
      await localNetworkCache.saveCurrentNetwork();

      console.log(
        `cache of current network state created. starting all nodes.`
      );

      nodesManager.startRpcNode();
      nodesManager.startAllNodes();

      await nodesManager.awaitRpcReady();
      watchdog = new Watchdog(contractManager, nodesManager);
      watchdog.startWatching(true);
    }



    const result = await this.runImplementation();

    if (result) {
      console.log(
        "SUCCESS: Block created after tolerance reached was achieved again.:"
      );
    } else {
      console.log("FAILURE: this test failed");
    }

    /// console.assert(last_checked_block > blockBeforeNewTransaction);

    await watchdog.stopWatching();

    // write operation result.

    // LogFileManager.writeNetworkOperationOutput(networkName, networkOperation)

    await nodesManager.stopAllNodes(true);
    await nodesManager.stopRpcNode(true);

    // todo: add a condition to stop this test.
    // maybe phoenix managed a recovery 3 times ?
    // while(true) {
    //     // verify that network is running.
    //     // by sending a transaction and waiting for a new block.
    // }

    process.exit(result ? 0 : 1);
  }

  abstract runImplementation(): Promise<boolean>;
}
