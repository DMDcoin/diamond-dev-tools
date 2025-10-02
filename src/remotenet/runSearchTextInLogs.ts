
import { ConfigManager } from '../configManager';
import { cmdR, cmdRemoteAsync } from '../remoteCommand';
import { getNodesFromCliArgs } from './remotenetArgs';



/// removed leading and trailing whitespace and newlines
function trimString(str: string): string {
  
  let charsToRemove = ['\n', '\r', ' ', '\t'];


  let firstCharToKeep: number = 0;


  for (let i = 0; i < str.length; i++) {
    if (!charsToRemove.includes(str[i])) {
      firstCharToKeep = i;
      break;
    }
  }

  let lastCharToKeep: number = str.length - 1;


  for (let i = str.length - 1; i >= 0; i--) {
    if (!charsToRemove.includes(str[i])) {
      lastCharToKeep = i;
      break;
    }
  }

  return str.substring(firstCharToKeep, lastCharToKeep + 1);
  
}

async function doSearch() {

  const nodes = await getNodesFromCliArgs();

  const results: { [name: number]: string } = {};

  const installDir = ConfigManager.getNetworkConfig().installDir;

  let promis : Promise<void>[] = [];

  let limitOutput = true;
  let limitTail = false 

  let grepLimit = limitOutput ? " -m 10" : "";
  //let tailLimit = limitOutput ? " -n 100000" : "";

  let gatherCommand = limitTail ? `tail -n 10000` : `cat`;


  let knownWatchedSearchterms = [
    'deadlock(s) detected',
    "number of connections has been reached",
    "HostCacheInconsistency",
    "verification failed",
  ];
  

  for (let watchTerm of knownWatchedSearchterms) {

    nodes.forEach(async(x) => {
      const filename = `~/${installDir}/diamond-node.log`;
      //const searchterm = 'Initiating Shutdown: Honey Badger Consensus detected that this Node has been flagged as unavailable, while it should be available.';
      const searchterm = watchTerm;
      //const searchterm = "BadProtocol";
      //
      const promise = cmdRemoteAsync(x.sshNodeName(), `${gatherCommand} ${filename} | grep ${grepLimit} '${searchterm}'  | cat`).then((result) => { 
        results[x.nodeID] = result;
        
      });
  
      promis.push(promise);
    });
  
  }



  // await Promise.all(nodes.map(x => {
  //   return new Promise(async () => {

  //     const filename = `~/${installDir}/parity.log`;
  //     //const searchterm = 'Initiating Shutdown: Honey Badger Consensus detected that this Node has been flagged as unavailable, while it should be available.';
  //     const searchterm = 'shutdown-on-missing-block-import';

  //     try {
  //       const result = await cmdRemoteAsync(x.sshNodeName(), `grep '${searchterm}' ${filename} | cat`);
  //       results[x.nodeID] = result;
  //     } catch (e: any) {
  //       results[x.nodeID] = e.toString();
  //     }

  //   })
  // }));

  await Promise.all(promis);
  let noOutputNodes: Array<number> = [];
  for (let nodeName in results) {


    const result = results[nodeName];
    let trimmedResult = result.trim();

    
    
    console.log(nodeName);
    console.log("--------------");

    console.log(trimmedResult);

    console.log(result);
    console.log("--------------");

    if (trimmedResult.length == 0) {
      noOutputNodes.push(parseInt(nodeName));
    }
  }

  if (noOutputNodes.length > 0) {
    console.warn("No output for nodes: ", noOutputNodes);
  }
  // executeOnRemotesFromCliArgs("grep '0xe9d5ea9355c245af3950c0052b38beeb208ca29507983c1b5c8b3c3ab4435b87' ~/dmdv4-testnet/parity.log");
}


doSearch();



