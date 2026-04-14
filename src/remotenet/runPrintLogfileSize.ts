

import { ConfigManager } from "../configManager";
import { cmdR } from "../remoteCommand";
import { executeOnRemotesFromCliArgs } from "./executeOnRemotes";
import { getNodesFromCliArgs } from "./remotenetArgs";



async function run() {

    let config = ConfigManager.getNetworkConfig();
    let nodes = await getNodesFromCliArgs();

    let result = "";
    for(let node of nodes) { 
        try {
            let r = cmdR(node.sshNodeName(), `wc -c ~/${config.installDir}/diamond-node.log`);
            let splittet = r.split(" ");

            if (splittet.length > 1) {
                let parsed = Number.parseInt(splittet[0]);
                result += `${node.sshNodeName()}: ${(parsed / (1024 * 1024)).toFixed(3)} MB\n`;
            }
        } catch (e) { 
            result += `${node.sshNodeName()}: ERROR \n`;
        }
    }

    console.log(result);
} 

run();