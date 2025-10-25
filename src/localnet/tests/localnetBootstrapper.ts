
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

  public createContractManager() {

    return new ContractManager(this.web3);
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
    let nodesManager = NodeManager.get(networkName);
    let contractManager = ContractManager.getForNetwork(this.networkName);

    let createNewNetwork = true;
    if (this.cacheCreatedNetwork) {

      const localNetworkCache = new LocalNetworkCheckpointIo(this.networkName, this.networkOperation);
      if (localNetworkCache.restoreNetworkFromState()) {
        console.log(
          `Restored network ${networkName} from cache. Continuing with existing network.`
        );
        let nodesManager = NodeManager.get(networkName);
        const startedNodes = nodesManager.startAllNodes();
        console.log("startedNodes from cache:", startedNodes);  
        nodesManager.startRpcNode();
        await this.runTestSteps(nodesManager, contractManager);
        return;
      } else {
        console.log(
          `No cache found for network ${networkName}. Creating new network.`
        );
      }
    }

    

    console.log("creating new network");
    await nodesManager.createLocalNetwork();
    console.log("new network created");
  
    nodesManager = NodeManager.get(networkName); 
    // if (!nodesManager) {
    //   throw new Error(
    //     `Network ${networkName} not found. Please create it with 'npm run testnet-fresh-${networkName}'`
    //   );
    // }

    // we need to reinitialize the nodesManager after creating the network.
    

    console.log(`starting rpc`);
    nodesManager.rpcNode!.start();

    console.log(
      `Starting up the network. Total nodes: ${nodesManager.nodeStates.length}`
    );

    for (let node of nodesManager.nodeStates) {
      node.start();
    }

    console.log(`all normal nodes started.`);

    await nodesManager.awaitRpcReady();
    console.log("rpc is ready!");
    

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


    //2000

    console.log("Filling delta pot with excess funds...");

    let rewardHbbft = await contractManager.getRewardHbbft();
    // we keep 1.000.000 for further tests, and send the rest to delta.
    let keep =  web3.utils.toBN(web3.utils.toWei("1000000", 'ether'));
    let balance = web3.utils.toBN(await web3.eth.getBalance(web3.eth.defaultAccount!));

    let deltaTransferString = balance.sub(keep).toString();
    
    console.log("delta transfer:",deltaTransferString );
    
    await rewardHbbft.methods.addToDeltaPot().send({ from: web3.eth.defaultAccount!, value: deltaTransferString, gas: 3000000 });
    console.log("Total balance of rewardHbbft: ", await web3.eth.getBalance(rewardHbbft.options.address));

    // if we want a rerun cache, we need to store the current state here.

    if (createNewNetwork && this.cacheCreatedNetwork) {
      console.log(
        `creating a cache of the current network state for future performance increase. shutting down.`
      );

      await watchdog.stopWatching();

      await nodesManager.stopAllNodes(true);
      await nodesManager.stopRpcNode();

      const localNetworkCache = new LocalNetworkCheckpointIo(this.networkName, this.networkOperation);
      await localNetworkCache.saveCurrentNetwork();

      console.log(
        `cache of current network state created. starting all nodes.`
      );

      nodesManager.startRpcNode();
      nodesManager.startAllNodes();

     
    }


    this.runTestSteps(nodesManager, contractManager);

  }
  
  async runTestSteps(nodesManager: NodeManager, contractManager: ContractManager) {
    
    
    await nodesManager.awaitRpcReady();
    let watchdog = new Watchdog(contractManager, nodesManager);
    watchdog.startWatching(true);

    const result = await this.runImplementation(watchdog);

    if (result) {
      console.log(
        `SUCCESS: test ${this.networkOperation} was successful.:`
      );
    } else {
      console.log("FAILURE: this test failed");
    }

    /// console.assert(last_checked_block > blockBeforeNewTransaction);

    await watchdog.stopWatching();

    // write operation result.

    // LogFileManager.writeNetworkOperationOutput(networkName, networkOperation)
    console.log("stopAllNodes");
    await nodesManager.stopAllNodes(false);
    console.log("stopRpcNode");
    await nodesManager.stopRpcNode(false);

    // todo: add a condition to stop this test.
    // maybe phoenix managed a recovery 3 times ?
    // while(true) {
    //     // verify that network is running.
    //     // by sending a transaction and waiting for a new block.
    // }
    console.log("process.exit");
    process.exit(result ? 0 : 1);
  }

  abstract runImplementation(watchdog: Watchdog): Promise<boolean>;

  protected createWatchdog(): Watchdog {
    let contractManager = ContractManager.getForNetwork(this.networkName);
    let nodesManager = NodeManager.get(this.networkName);
    let watchdog = new Watchdog(contractManager, nodesManager);
    return watchdog;
  }

  public getDescription(): string { 
    return `generic test ${this.networkOperation} on network ${this.networkName}`;
  }
}
