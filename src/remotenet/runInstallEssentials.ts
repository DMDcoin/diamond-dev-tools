import { config } from "process";
import { cmd, cmdR, cmdRemoteAsync } from "../remoteCommand";
import { getNodesFromCliArgs } from "./remotenetArgs";
import { ConfigManager } from "../configManager";


async function run() {

    const nodes = await getNodesFromCliArgs();
    for (const n of nodes) {
      cmdR("root@" + n.sshNodeName(), 'apt-get update -y && apt-get install git build-essential cmake curl wget btop htop zsh -y');
    }
    console.log('Finished');
}


run();