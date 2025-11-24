
import Web3 from "web3";
import { ConfigManager } from "../configManager";
import { ContractManager } from "../contractManager";
import { cmd, cmdR } from "../remoteCommand";
import { getNodesFromCliArgs } from "./remotenetArgs";
import { getNodeVersion } from "./getNodeVersion";
import { NodeState } from "../net/nodeManager";
import BigNumber from "bignumber.js";
import { LogFileManager } from "../logFileManager";



function parseVersion(version: string) {
  try {
    const parts = version.split("/");
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


/// error guarded number proimise for web3 calls
async function egs(promise: Promise<string>) : Promise<string> {
  try {
    return (await promise).toString();
  } catch (e) {
    return " (Err) ";
  }
}

/// error guarded number proimise for web3 calls
async function egn(promise: Promise<number>) : Promise<string> {
  try {
    return (await promise).toString();
  } catch (e) {
    return " (Err) ";
  }
}

/// error guarded number proimise for web3 calls
async function egb(promise: Promise<boolean>) : Promise<string> {
  try {
    return (await promise) ? "true": "false";
  } catch (e) {
    return " (Err) ";
  }
}

async function csvLine(n: NodeState, contractManager: ContractManager, block: number, minStake: BigNumber, allValidators: string[]) {
  const nodeName = `hbbft${n.nodeID}`;
  console.log(`=== ${nodeName} ===`);
  let version = getNodeVersion(nodeName);
  let parsedVersion = parseVersion(version);
  let isAvailable = "";
  let isStaked = false;
  let bonusScore =  await egn(contractManager.getBonusScore(n.address ?? "", block));
  let totalStake = new BigNumber(0);
  let stakeString = "0";
  let poolAddress = "";
  if (n.address) {
    isAvailable = await egb(contractManager.isValidatorAvailable(n.address, block));
    poolAddress = await egs(contractManager.getAddressStakingByMining(n.address));
    try {
      totalStake = await contractManager.getTotalStake(poolAddress);
    } catch {}
    stakeString = totalStake.toString(10);
    console.log(`stake: ${stakeString}`);
    isStaked = totalStake.isGreaterThanOrEqualTo(minStake);
  }
  stakeString = totalStake.div(new BigNumber("1000000000000000000")).toString();
  let current = "FALSE";
  if (n.address && allValidators.includes(n.address.toLowerCase())) {
    current = "TRUE";
  }
  const sha1binaryDuo = cmdR(nodeName, `sha1sum ~/${ConfigManager.getNetworkConfig().installDir}/diamond-node`);
  const sha1binary = sha1binaryDuo.split(" ")[0];
  return `"${n.sshNodeName()}";"${current}";"${isAvailable}";"${isStaked}";"${stakeString}";"${n.address}";"${poolAddress}";"${sha1binary}";"${version}";"${parsedVersion.date}";"${parsedVersion.commit}";"${parsedVersion.versionString}";"${bonusScore}";`;
}


async function run() {

  const nodes = await getNodesFromCliArgs();
  const contractManager = ContractManager.get();
  const block = await contractManager.web3.eth.getBlockNumber();

  const minStake = await contractManager.getMinStake(block);

  
  let allValidators = (await contractManager.getValidators()).map(x => x.toLowerCase());

  console.log(`min stake: ${minStake.toString(10)}`);
  let csvLines: Array<String> = [];

  await Promise.all(nodes.map(async (n) => {
    csvLines.push(await csvLine(n, contractManager, block, minStake, allValidators));
  }));

  csvLines = csvLines.sort((a: String, b: String) => { return a.localeCompare(b.toString()) })

  
  const header = '"node";"current";"available";"staked";"stake";"address";"poolAddress", "sha1binary"; "version";"versionDate";"versionCommit";"versionNumber";"bonusScore";';
  console.log(header);
    //const csvLines: string[] = await Promise.all(nodes.map(n => csvLine(n, contractManager, block, minStake, allValidators)));
  
  csvLines.forEach(x => console.log(x));
  
  let csvContent = header + "\n" + csvLines.join("\n");

  let outputFile = LogFileManager.writeRaw(`remotenet-csv-${new Date().toISOString()}.csv`, csvContent);

  cmd("libreoffice --calc " + outputFile + " &");


}


run();
