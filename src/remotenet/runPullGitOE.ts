import { ConfigManager } from '../configManager';
import { NodeState } from '../net/nodeManager';
import { cmdR } from '../remoteCommand';
import { gitUpdateBranchAndPull } from './gitPullDiamondNode';
import { getNodesFromCliArgs } from './remotenetArgs';




async function run() {
  const nodes = await getNodesFromCliArgs();

  nodes.forEach((n) => {
    gitUpdateBranchAndPull(n);
    
  });
}

// todo find better command, this kind of hard kills it.
run();
