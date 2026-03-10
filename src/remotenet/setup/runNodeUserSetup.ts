import { cmd, cmdR } from "../../remoteCommand";
import { getNodesFromCliArgs } from "../remotenetArgs";


async function run() {
    const nodes = await getNodesFromCliArgs();
    for (const n of nodes) {
      const scriptName = "promoteUser.sh";
      const remoteScriptLocation = "/tmp/" + scriptName;
      cmd('scp ./remotenet/scripts/' + scriptName + ' root@' + n.sshNodeName() + ':' + remoteScriptLocation);
      cmdR("root@" + n.sshNodeName(), 'chmod +x ' + remoteScriptLocation);
      cmdR("root@" + n.sshNodeName(), remoteScriptLocation + ' ' + "dmdnode" + n.nodeID);
      
      // activate this to host more nodes on one server.
      //cmdR("root@" + n.sshNodeName(), remoteScriptLocation + ' ' + "dmdnode" + (n.nodeID + 25));
    }
    console.log('Finished');
}

run();