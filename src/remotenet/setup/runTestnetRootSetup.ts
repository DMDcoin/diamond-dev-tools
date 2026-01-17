import { cmd } from "../../remoteCommand";
import { getNodesFromCliArgs } from ".././remotenetArgs";


async function run() {

    const nodes = await getNodesFromCliArgs();
    for (const n of nodes) {
      cmd('scp ./public_keys/authorized_keys root@' + n.sshNodeName() + ':~/.ssh/authorized_keys');
    }
    console.log('Finished');
}


run();