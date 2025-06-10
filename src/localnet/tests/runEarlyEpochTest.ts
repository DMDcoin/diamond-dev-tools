import Web3 from "web3";
import { LocalnetScriptRunnerBase, LocalnetScriptRunnerResult } from "./localnetBootstrapper";
import { sleep } from "../../utils/time";


export class EarlyEpochEndRunner extends LocalnetScriptRunnerBase {


    async runImplementation(web3: Web3): Promise<LocalnetScriptRunnerResult> {
                
        await this.startNode(2);
        await sleep(5000);
        await this.stopNode(2);

        // console.log("alternating between stopping and starting nodes 2, 3 and 4 - in a way always only 2 Nodes are available in any given moment.");
        //await this.stopNode(4);
        //console.log("starting node 3");

        await this.stopNode(4);

        await this.startNode(3);
        await sleep(5000);
        await this.stopNode(3);

        await this.startNode(4);


        console.log("starting all stopped nodes to test the recovery from missed hbbft messages.");

        await this.refreshBlock();
        await this.startNode(2);
        await this.startNode(3);


        console.log('waiting for nodes...');

        await sleep(3000);

        await this.refreshBlock();

        console.log('waiting for block inclusion...:');

        await sleep(15000);
        await this.refreshBlock();


        return { success: true };  
    }


} 
