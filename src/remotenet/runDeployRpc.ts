import { ConfigManager } from "../configManager";
import { cmd, cmdR } from "../remoteCommand";

const { installDir } = ConfigManager.getConfig();
const realInstallDir = installDir + "-rpc";
const node = 'dmdblockscout';


try {
  cmdR(node, `mkdir -p ~/${realInstallDir}`);
} catch (error) {

}

const nodesSubdir = 'testnet/nodes';
const nodesDirAbsolute = process.cwd() + '/' + nodesSubdir;


const scpRpcCommand = `scp -pr ${nodesDirAbsolute}/rpc_node/* ${node}:~/${realInstallDir}`;
cmd(scpRpcCommand);