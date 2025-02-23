

import * as fs from 'fs';
import { ConfigManager } from '../configManager';
import { loadNodeInfosFromTestnetDirectory } from '../net/nodeInfo';
import { cmdR } from '../remoteCommand';
import { getNodesFromCliArgs } from './remotenetArgs';

export async function createReservedPeersFiles() {


  const nodeInfos = loadNodeInfosFromTestnetDirectory();
  let nodesDir = ConfigManager.getNetworkConfig().nodesDir;


  const nodeInfosFromCli = getNodesFromCliArgs();

  if (nodeInfos) {


    // let ips = iplist.split(/\r?\n/);
    let ips: Array<String> = [];

    for (let i = 0; i < nodeInfos.public_keys.length; i++) {

      
      if ((await nodeInfosFromCli).filter(x=> x.nodeID === i + 1).length !== 1) {
        continue;
      }

      const ip_from_node = cmdR(`hbbft${i + 1}`, 'curl ifconfig.me');
      ips.push(ip_from_node);
    }


    const maxNodes = Math.min(ips.length, nodeInfos.public_keys.length);

    //read the first file as template.
    let content = "";
    // example:
    // enode://37065cf0ab474ce6714b8c9b45584103827886498f8595310ba1620287a838939e67f91792141ef1752923c05ddb7f15d596909c8cfac054ed6e8b93c0c87823@127.0.0.1:30307
    for (let index = 0; index < maxNodes; index++) {
      content += `enode://${nodeInfos.public_keys[index].substr(2)}@${ips[index]}:${30300 + index + 1}\n`;
    }

    for (let index = 0; index < maxNodes; index++) {
      fs.writeFileSync(`testnet/${nodesDir}/node${index + 1}/reserved-peers`, content);
    }

    fs.writeFileSync(`testnet/${nodesDir}/rpc_node/reserved-peers`, content);

  } else {
    console.log('ERROR: could not load info file from testnet directory.');
  }

}