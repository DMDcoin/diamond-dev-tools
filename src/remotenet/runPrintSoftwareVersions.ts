import { ConfigManager } from '../configManager';
import { cmdR } from '../remoteCommand';
import { getNodesFromCliArgs } from './remotenetArgs';

async function run() {
  const nodes = await getNodesFromCliArgs();
  const installDir = ConfigManager.getInstallDir();
  nodes.forEach((n) => {
    const nodeName = `hbbft${n.nodeID}`;
    console.log(`=== ${nodeName} ===`);
    cmdR(nodeName, `~/${installDir}/diamond-node --version`);
    cmdR(nodeName, `sha1sum ~/${installDir}/diamond-node`);
  });
}

// todo find better command, this kind of hard kills it.
run();
