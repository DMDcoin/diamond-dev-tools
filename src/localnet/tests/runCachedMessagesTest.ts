import Web3 from "web3";
import {
  LocalnetScriptRunnerBase,
  LocalnetScriptRunnerResult,
} from "./localnetBootstrapper";
import { sleep } from "../../utils/time";

export class CachedMessageTest extends LocalnetScriptRunnerBase {
  public constructor() {
    super("nodes-local-test-early-epoch-end", "early-epoch-end-test", 16);
  }

  async runImplementation(): Promise<boolean> {
    // we are on a 16 node validator network now.
    // we expect a early epoch end tolerance of 2. -> todo: maybe we should read that from contract
    // required: 2f + 1
    // f = 5

    await this.stopNode(2);

    // console.log("alternating between stopping and starting nodes 2, 3 and 4 - in a way always only 2 Nodes are available in any given moment.");
    //await this.stopNode(4);
    //console.log("starting node 3");

    await this.stopNode(3);

  await this.stopNode(2);
  await this.createBlockAndRefresh();
  console.log(
    "node 2 stopped, creating block should work, because of fault tolerance."
  );

  await stopNode(3);
  await createBlockAndRefresh();
  console.log(
    "node 3 stopped, creating block should work, because of fault tolerance."
  );

  await stopNode(4);
  await createBlockAndRefresh();
  console.log(
    "node 4 stopped, creating block should work, because of fault tolerance. but above early epoch end tolerance"
  );



    await sleep(5000);

    console.log(
      "starting all stopped nodes to test the recovery from missed hbbft messages."
    );

    await this.refreshBlock();
    await this.startNode(2);
    await this.startNode(3);

    console.log("waiting for nodes...");

    await sleep(3000);

    await this.refreshBlock();

    console.log("waiting for block inclusion...:");

    await sleep(15000);
    await this.refreshBlock();

    return true;
  }
}
