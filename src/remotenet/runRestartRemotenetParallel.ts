import { NodeState } from "../net/nodeManager";
import { sleep } from "../utils/time";
import { getNodesFromCliArgs } from "./remotenetArgs";
import { startRemoteNode } from "./startRemoteNode";
import { stopRemoteNode } from "./stopRemoteNode";


async function restartNode(n: NodeState) {

  const promise = new Promise<void>((resolve, reject) => {

    try {
      const nodeName = `hbbft${n.nodeID}`;
      console.log(`=== ${nodeName} ===`);
      stopRemoteNode(n);
      startRemoteNode(n);
      resolve();
    } catch (e) {
      reject(e);
    } 
  });

  return promise;
}

async function run() {
    const nodes = await getNodesFromCliArgs();

    let promisses = [];
    
    for (let n of nodes) {
      promisses.push(restartNode(n));
    };

    console.log("Sent all restart commands, waiting for completion");
    await Promise.all(promisses);
}

run();