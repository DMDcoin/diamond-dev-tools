import { ConfigManager } from '../configManager';
import { NodeState } from '../net/nodeManager';
import { cmdR, cmdRemoteAsync } from '../remoteCommand';
import { getBuildFromSourceCmd } from './buildFromSource';
import { getNodesFromCliArgs } from './remotenetArgs';

async function doRunBuildFromSource(n: NodeState): Promise<string> {

    const nodeName = `hbbft${n.nodeID}`;
    console.log(`=== ${nodeName} ===`);

    let installDir = ConfigManager.getRemoteInstallDir()
    let buildScript = ConfigManager.getBuildFromSourceScript();
    // todo: "-fast" wont exist in future - fast will be the default.
    return cmdR(n.sshNodeName(), `cd ${installDir} && ./${buildScript}`);
}

async function runAllNodes() {

    console.log("running build from source on all nodes in a parallel manner...");
    console.log("due some limitations, it does not allways finish");
    console.log("try to use the non parallized version in this case");

    let nodes = await getNodesFromCliArgs();
    for (const n of nodes) { 
        
        await doRunBuildFromSource(n);
        try {
            await n.stopRemoteNode();
        } catch (e) {
            // ignore error.
        }
        
        await doRunBuildFromSource(n);
        n.startRemote();
    }
    
    console.log("all jobs done...");
}


runAllNodes();