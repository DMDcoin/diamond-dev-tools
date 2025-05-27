import { FAILSAFE_SCHEMA } from 'js-yaml';
import { ConfigManager } from '../configManager';
import { NodeState } from '../net/nodeManager';
import { cmdR, cmdRemoteAsync } from '../remoteCommand';
import { getBuildFromSourceCmd } from './buildFromSource';
import { getNodesFromCliArgs } from './remotenetArgs';
import { gitUpdateBranchAndPull } from './gitPullDiamondNode';

async function doRunBuildFromSource(n: NodeState): Promise<string> {

    const nodeName = `hbbft${n.nodeID}`;
    console.log(`=== ${nodeName} ===`);


    // git pull here.

    let deleteOldBuild = false;


    let deleteCmd = deleteOldBuild ? `&& rm -r ./diamond-node-git/target` : `` ;

    let installDir = ConfigManager.getRemoteInstallDir();

    let buildScript  =  ConfigManager.getBuildFromSourceScript();
    // todo: "-fast" wont exist in future - fast will be the default.
    return cmdRemoteAsync(n.sshNodeName(), `cd ${installDir} ${deleteCmd} && ./${buildScript}`);
}

async function runAllNodes() {

    console.log("running build from source on all nodes in a parallel manner...");
    console.log("due some limitations, it does not allways finish");
    console.log("try to use the non parallized version in this case");

    let nodes = await getNodesFromCliArgs();
    let finished = 0;
    let error = 0;
    let results = nodes.map( (n) => {

        let result = gitUpdateBranchAndPull(n).then( async () => await doRunBuildFromSource(n)).then(
            (result) => {
                finished++;
                console.log("finished: ", n.sshNodeName());
                console.log(result);
                console.log(" === end: ", n.sshNodeName(), " === ");
                console.log("finished: ", finished);
                console.log("error: ", error);
                console.log("finalized: ", finished + error);
                console.log("progress: ", (finished + error / nodes.length) * 100);
            }, (error) => {
                error++;
                console.log("Error: ", n.sshNodeName());
                console.log(error);
                console.log(" === end: ", n.sshNodeName(), " === ");
                console.log("finished: ", finished);
                console.log("error: ", error);
                console.log("finalized: ", finished + error);
                console.log("progress: ", (finished + error / nodes.length) * 100);
            });
         return result; 
    } );

    console.log("did start all build from source processes");
    console.log("awaiting results...");

    
    for (const n of results) {
        await n;    
    }

    console.log("all jobs done...");
}


runAllNodes();