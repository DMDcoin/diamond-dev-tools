import { ConfigManager } from "../configManager";
import { NodeState } from "../net/nodeManager";
import { cmdR } from "../remoteCommand";

export function startRemoteNode(node: NodeState) {

    const installDir = ConfigManager.getRemoteInstallDir();

    const nodeName = `hbbft${node.nodeID}`;
    let runOnThisNode = true;

    try {
      const runningScreens = cmdR(nodeName, 'screen -ls', true, true);

      if (runningScreens.includes(ConfigManager.getRemoteScreenName())) {
        console.log(`WARNING: ${ConfigManager.getRemoteScreenName()} screen already running, not starting another one.!!`);
        runOnThisNode = false;
      } else {

      }
    } catch (e) {
      // if no screen, we get an error - all good.
    }

    if (runOnThisNode) {
      cmdR(nodeName, `cd ${installDir} && screen -S ${ConfigManager.getRemoteScreenName()} -d -m ~/${installDir}/start.sh`);
    }
}