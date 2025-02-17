import BigNumber from "bignumber.js";
import Web3 from "web3";
import { ConfigManager } from "../configManager";
import { ContractManager } from "../contractManager";
import { cmdR } from "../remoteCommand";
import { getNodesFromCliArgs } from "./remotenetArgs";
import { getNodeVersion } from "./getNodeVersion";
import { NodeState } from "../net/nodeManager";


function parseVersion(version: string) {

  //Example: OpenEthereum/v3.3.5-hbbft-0.9.7-unstable-d8b55f726-20250210/x86_64-linux-gnu/rustc1.75.0

  try {

    const parts = version.split("/"); // v3.3.5-hbbft-0.9.7-unstable-d8b55f726-20250210
    const versionPart = parts[1];
    const versionParts = versionPart.split("-");

    const date = versionParts[versionParts.length - 1];
    
    const commit = versionParts[versionParts.length - 2];
    const versionString = versionParts.slice(0, versionParts.length - 2).join("-");

    return { date, commit, versionString };

  } catch {
    
    return { date: "", commit: "", versionString: "" };
  }
  
}

async function run() {

  const nodes = await getNodesFromCliArgs();
  const contractManager = ContractManager.get();
  const block = await contractManager.web3.eth.getBlockNumber();

  const minStake = await contractManager.getMinStake(block);

  
  let allValidators = (await contractManager.getValidators()).map(x => x.toLowerCase());

  console.log(`min stake: ${minStake.toString(10)}`);
  const csvLines: Array<String> = [];

  await nodes.forEach(async (n) => { 
    await csvLine(n);
  });
  

   async function csvLine(n: NodeState) {
    const nodeName = `hbbft${n.nodeID}`;
    console.log(`=== ${nodeName} ===`);



    let version = getNodeVersion(nodeName);

    let parsedVersion = parseVersion(version);

    let isAvailable = false;
    let isStaked = false;

    let bonusScore = await contractManager.getBonusScore(n.address ?? "", block);

    let totalStake = new BigNumber(0);
    let stakeString = "0";

    let poolAddress = "";
    if (n.address) {
      isAvailable = await contractManager.isValidatorAvailable(n.address, block);

      poolAddress = await contractManager.getAddressStakingByMining(n.address);
      totalStake = await contractManager.getTotalStake(poolAddress);
      stakeString = totalStake.toString(10);
      console.log(`stake: ${stakeString}`);
      isStaked = totalStake.isGreaterThanOrEqualTo(minStake);
    }

    stakeString = totalStake.div(new BigNumber("1000000000000000000")).toString();
    
    let current = "FALSE";
    if (n.address) {

      if (allValidators.includes(n.address.toLowerCase())) {
        current = "TRUE";
      } 

    }

    const sha1binaryDuo = cmdR(nodeName, `sha1sum ~/${ConfigManager.getNetworkConfig().installDir}/diamond-node`);
    const sha1binary = sha1binaryDuo.split(" ")[0];
    csvLines.push(`"${n.sshNodeName()}";"${current}";"${isAvailable}";"${isStaked}";"${stakeString}";"${n.address}";"${poolAddress}";"${sha1binary}";"${version}";"${parsedVersion.date}";"${parsedVersion.commit}"; ${parsedVersion.versionString}";" ${bonusScore}";`);
    
  }

  console.log('"node";"current";"available";"staked";"stake";"address";"poolAddress", "sha1binary"; "version";"versionDate";"versionCommit";"versionNumber";"bonusScore";');
  csvLines.forEach(x => console.log(x));
}


run();
