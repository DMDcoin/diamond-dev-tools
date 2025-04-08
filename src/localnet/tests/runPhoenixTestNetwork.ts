import { whilst } from "async";
import { ContractManager } from "../../contractManager";
import { NodeManager } from "../../net/nodeManager";
import { sleep } from "../../utils/time";
import Web3 from "web3";
import { create } from "underscore";
import { createBlock } from "./testUtils";
import { stakeOnValidators } from "../../net/stakeOnValidators";





async function runPhoenixTestNetwork() {

    let nodesManager = NodeManager.get("nodes-local-test-phoenix");

    if (nodesManager.nodeStates.length != 5) {
        console.log(`ABORTING: expected 5 nodes to run this test, got `, nodesManager.nodeStates.length);
        return;
    }   


    let heartbeatInterval = 600;
    
    console.log(`starting rpc`);
    nodesManager.rpcNode?.start();
    
    console.log(`Starting up the network. Total nodes: ${nodesManager.nodeStates.length}`);

    for (let node of nodesManager.nodeStates) {
        node.start();
    }

    console.log(`all normal nodes started.`);

    console.log(`waiting for rpc`);
    await sleep(10000);

    await stakeOnValidators(4);

    console.log("waiting until 4 validators took over the ownership of the network.");

    let contractManager = ContractManager.get();

    let currentValidators = await contractManager.getValidators();
    while(currentValidators.length < 4) {
        await sleep(1000);
        currentValidators = await contractManager.getValidators();
    }


    console.log("we are running now on a 4 validator testnetwork. starting with phoenix test.");
    
    let web3 = contractManager.web3;

    let start_block =  await web3.eth.getBlockNumber();
    console.log('current block:', start_block);

    let last_checked_block = start_block;

    let refreshBlock = async () => {
        last_checked_block = await web3.eth.getBlockNumber();
    };

    await createBlock(web3, last_checked_block);

    let stopNode = async (n: number) => { 
        console.log(`stopping node ${n}`);
        await nodesManager.getNode(n).stop();
        console.log(`node ${n} stopped`);
    };


    let startNode = async (n: number) => { 
        console.log(`starting node ${n}`);
        await nodesManager.getNode(n).start();
        console.log(`node ${n} started`);
    };

    await stopNode(1);
    await createBlock(web3, last_checked_block);

    console.log('node 1 stopped, creating block should work, because of fault tolerance');

    await stopNode(2);

    await refreshBlock();

    console.log('triggering block creation that should not create block, because of tolerance reached.');
    let createBlockFailing = createBlock(web3);

    console.log('waiting for nodes...');
    
    await sleep(3000);

    let blockBeforeNewTransaction = last_checked_block;
    await refreshBlock();

    // console.log('Block was not created as expected:', last_checked_block > blockBeforeNewTransaction);

    await startNode(1);
    await sleep(15000);
    await refreshBlock();

    console.assert(last_checked_block > blockBeforeNewTransaction);

    console.log('Block created after tolerance reached was achieved again.:');

    
    nodesManager.stopAllNodes();
    nodesManager.stopRpcNode();

    // todo: add a condition to stop this test.
    // maybe phoenix managed a recovery 3 times ?
    // while(true) {
    //     // verify that network is running.
    //     // by sending a transaction and waiting for a new block.
        
        



    // }

}



runPhoenixTestNetwork();
