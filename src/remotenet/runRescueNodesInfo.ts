import { cmdR } from '../remoteCommand';
import { ConfigManager } from '../configManager';
import { NodeInfos } from '../net/nodeInfo';
import { ContractManager } from '../contractManager';

export async function rescueNodeInfoFromRemotenet() {

  console.log("rescuing nodes_info.json out of existing configuration. This can help to run this toolset again one the local files are lost.");
  console.log("The tool does not write the file, it just prints it to the console. You can copy and paste it to a file and save it.");

  // todo: get as CLI argument or ENV variable.
  const remotenet_size = 50;
  const addresses: Array<string> = [];
  const public_keys: string[] = [];
  const ip_addresses: string[] = [];
  const networkConfig = ConfigManager.getNetworkConfig();
  const staking_addresses: string[] = [];
  const contractManager = ContractManager.get();

  for (let n = 1; n <= remotenet_size; n++) {
    
    let nodeSshName = `hbbft${n}`; 
    try {
      const address_result = cmdR(nodeSshName, `cat ~/${networkConfig.installDir}/address.txt`);
      addresses.push(address_result); 
    } catch (e) {

      try {
      const keystoreFile = cmdR(nodeSshName, `cat ~/${networkConfig.installDir}/data/keys/DPoSChain/hbbft_validator_key.json`);
      console.log("got keystore:", keystoreFile);
      const keystoreObj = JSON.parse(keystoreFile);
      console.log("address: ", keystoreObj.address);


      
      staking_addresses.push(await contractManager.getAddressStakingByMining(keystoreObj.address));

      addresses.push("0x" + keystoreObj.address);
      // not found. retrieve from keystore
      } catch {
      console.log(`WARNING: no address information for  ${nodeSshName}`);
      addresses.push("0x0000000000000000000000000000000000000000");
      }
    }

    try {
      public_keys.push(cmdR(`hbbft${n}`, `cat ~/${networkConfig.installDir}/public_key.txt`));
    }
    catch {
      console.log(`WARNING: no public key information for  ${nodeSshName}`);
      public_keys.push("0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000");
    }

    ip_addresses.push(cmdR(`hbbft${n}`, `dig @resolver3.opendns.com myip.opendns.com +short`).replace(`\n`, ''));
  }
  
  const result : NodeInfos = {

    validators: addresses,
    staking_addresses: [],
    ip_addresses: ip_addresses,
    public_keys: public_keys,
    
    
    parts: [],
    acks: [],

  }

  console.log("Json data to write into the node_info.json");
  console.log(JSON.stringify(result));

  return result;
  
}

rescueNodeInfoFromRemotenet();