import { ConfigManager } from "../configManager";
import { cmdR, cmdRemoteAsync } from "../remoteCommand";
import { getNodesFromCliArgs } from "./remotenetArgs";

async function run() {

  const nodes = await getNodesFromCliArgs();

  const config = ConfigManager.getConfig();
  const promises = nodes.map(n => cmdRemoteAsync(n.sshNodeName(), `cd ~/${config.installDir} && git checkout start.sh && git pull && nohup ~/${config.installDir}/build-from-source.sh`));

  console.log('awaiting promises.');
  for (let p in promises) {
    await p;
    console.log('ok');
  }

  console.log('all work done - build might take 1 hour');

}


//todo find better command, this kind of hard kills it.
run();