import BigNumber from "bignumber.js";
import Web3 from "web3";
import { ConfigManager } from "../configManager";
import { ContractManager } from "../contractManager";
import { cmdR } from "../remoteCommand";
import { getNodesFromCliArgs } from "./remotenetArgs";

async function run() {

  const nodes = await getNodesFromCliArgs();


  const csvLines: Array<String> = [];
  for (const n of nodes) {

    const nodeName = `hbbft${n.nodeID}`;
    console.log(`=== ${nodeName} ===`);

    let dirSize = 0;
    let available = 0;

    const config = ConfigManager.getNetworkConfig();
    try {
      let cmdResult = cmdR(nodeName, `du -d 0 ~/${config.installDir}/data/chains/`);

      let fragments = cmdResult.split(" ");

      dirSize = Number.parseInt(fragments[0]);
    } catch (e) {
      console.log(`error on node ${nodeName}`, e);
    }


    try {
      let cmdResult = cmdR(nodeName, `df --output=avail ~/${config.installDir}/data/chains/`);

      let lines = cmdResult.split("\n");
      console.log(lines[1]);

      available = Number.parseInt(lines[1]);
    } catch (e) {
      console.log(`error on node ${nodeName}`, e);
    }

    csvLines.push(`"${n.sshNodeName()}";"${dirSize}";"${available}"`);
  }

  console.log('"node";"size";"available"');
  csvLines.forEach(x => console.log(x));
}


run();