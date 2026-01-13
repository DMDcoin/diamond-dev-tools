import { config } from "process";
import { cmd, cmdR, cmdRemoteAsync } from "../remoteCommand";
import { getNodesFromCliArgs } from "./remotenetArgs";
import { ConfigManager } from "../configManager";


async function run() {

    const nodes = await getNodesFromCliArgs();
    for (const n of nodes) {
      cmdR(n.sshNodeName(), 'reboot');
    }
    console.log('Finished');
}


run();