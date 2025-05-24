
import { ConfigManager } from '../configManager';
import { cmdR, cmdRemoteAsync } from '../remoteCommand';
import { getNodesFromCliArgs } from './remotenetArgs';

async function getLogTails() {

  const nodes = await getNodesFromCliArgs();
  const installDir = ConfigManager.getNetworkConfig().installDir;

  for (let n of nodes) {
    const nodeName = `hbbft${n.nodeID}`;
    console.log(`=== ${nodeName} ===`);
    cmdR(nodeName, `tail ~/${installDir}/diamond-node.log`);
    console.log(`END ${nodeName} END`);
  }
}


getLogTails();



