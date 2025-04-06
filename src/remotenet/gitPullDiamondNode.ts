import { ConfigManager } from "../configManager";
import { NodeState } from "../net/nodeManager";
import { cmdR } from "../remoteCommand";

export async function gitUpdateBranchAndPull(n: NodeState) {


    const nodeBranch = ConfigManager.getNodeBranch();
  
    const installDir = ConfigManager.getRemoteInstallDir();
    
    const nodeName = `hbbft${n.nodeID}`;
      console.log(`=== ${nodeName} ===`);
  
      const remoteAlias =  ConfigManager.getNodeRepoAlias();
      const remotes = cmdR(nodeName, `cd ~/${installDir}/diamond-node-git && git remote show`);
  
      if (remotes.indexOf(remoteAlias) === -1) {
        const url = ConfigManager.getNodeRepoUrl();
        console.log(`Adding remote ${remoteAlias}: ${url}`);
  
        cmdR(nodeName, `cd ~/${installDir}/diamond-node-git && git remote add ${remoteAlias} ${url}`);
      }
  
      cmdR(nodeName, `cd ~/${installDir}/diamond-node-git && git fetch ${remoteAlias} && git checkout ${nodeBranch} && git pull`);
  
  }