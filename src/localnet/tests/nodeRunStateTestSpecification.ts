import { forEachLimit } from "async";
import { NodeManager } from "../../net/nodeManager";
import { sleep } from "../../utils/time";
import fs from "fs";
import { each } from "underscore";


export interface NodeRunStateTestSpecificationEntry {

    states: boolean[]
    // ms second sleep after this state switch
    sleep?: number
}

export interface NodeRunStateTestSpecification {

    entries: NodeRunStateTestSpecificationEntry[];


}

/// A random walk algorithm, around the node states. 
export class NodeRunStateRandomWalkGenerator {



    /// generates a random walk around the nodes states to be around "targetValueOn" percentage. 
    public generate(count: number, numOfValidators: number, targetValueActive: number = 2/3) : NodeRunStateTestSpecificationEntry[] {


        // the first entry has all nodes ON:

        
        let entries: NodeRunStateTestSpecificationEntry[] = [];
        

        let latestEntry : NodeRunStateTestSpecificationEntry = {
            states: new Array(numOfValidators).fill(true), // all nodes ON
            sleep: 1000
        }

        entries.push(latestEntry);

        

        while (entries.length < count) {

            // we do a random walk with a bias towards the targetValueActive

            let newEntry: NodeRunStateTestSpecificationEntry = {
                states: [...latestEntry.states], // first node is always the MOC node, so we start with it ON
                sleep: 1000
            };

            let currentNumOfActive = NodeRunStateExecuter.countActiveNodes(newEntry);
            let targetNumOfActive = Math.ceil(numOfValidators * targetValueActive);

            let missing = targetNumOfActive - currentNumOfActive;

            // random walk, we either increase the number of active nodes by one or decrease it.
            // with a bias towards the targetValueActive.

            // example
            // 7 nodes
            // targetValueActive = 0.66
            // targetNumOfActive = 5

            let bias = 2 * missing / targetNumOfActive;
            let addOrRemove = Math.random() + bias > targetValueActive;

            // find a random Node that we can flip state.
            let indexToActivate = Math.floor(Math.random() * numOfValidators);
            while (newEntry.states[indexToActivate] == addOrRemove) {
                indexToActivate = Math.floor(Math.random() * numOfValidators);
            }

            
            newEntry.states[indexToActivate] = addOrRemove;
            
            latestEntry = newEntry;
            entries.push(newEntry);
        }


        return entries;

    }
}



export class NodeRunStateExecuter {

    /// counts the number of nodes that are in the "on" state, ignoring the first, wich acts as MOC.
    public static countActiveNodes(entry: NodeRunStateTestSpecificationEntry) {

        let hbbftCount = 0;
        // PREMISE:
        // first Node is the MOC node, so we ignore the first noded.
        for (let i = 1; i < entry.states.length; i++) {
            const state = entry.states[i];
            if (state) {
                hbbftCount++;
            }
        }
        return hbbftCount; // more than 66% of the time HBBFT is running
    }

    public static hbbftTreshholdReached(entry: NodeRunStateTestSpecificationEntry, treshold: number = 2/3) {

        let count = NodeRunStateExecuter.countActiveNodes(entry);
        return count / entry.states.length > treshold;
    }

    public static getEntriesAsCSV(entries: NodeRunStateTestSpecificationEntry[]) : string {

        let csv = entries[0].states.map((v,i) => {return "node" + (i + 2)}).join(",") + ",sleep,total_active,should_produce_blocks\n";
        for (let entry of entries) {
            let totalActive = NodeRunStateExecuter.countActiveNodes(entry);
            let shouldProduceBlocks = NodeRunStateExecuter.hbbftTreshholdReached(entry) ? "yes" : "no";
            csv += entry.states.map(s => s ? "1" : "0").join(",") + "," + (entry.sleep || 0) + "," + totalActive + "," + shouldProduceBlocks + "\n";
        }
        return csv;
    }


    public static exportEntriesToCsvFile(entries: NodeRunStateTestSpecificationEntry[], filename: string ){

        let csv = NodeRunStateExecuter.getEntriesAsCSV(entries);
        fs.writeFileSync(filename, csv, { encoding: "utf-8" });
    }


    public currentStep = 0;

    constructor(
        public specification: NodeRunStateTestSpecification,
        public nodeManager: NodeManager
    ) { }

    public finished() {
        return this.currentStep >= this.specification.entries.length;
    }

    public async next() {

        if (this.currentStep >= this.specification.entries.length) {
            throw new Error("No more steps to execute, check finished() method.");
        }


        let entry = this.specification.entries[this.currentStep];
        
        for (let i = 0; i < this.nodeManager.nodeStates.length; i++) {
            let nodeState = this.nodeManager.getNode(i + 2); // +2 because node 0 = rpc, node 1 = moc. 
            if (entry.states[i]) {
                
                if (!nodeState.isStarted) {
                    await nodeState.start();
                }
                
            } else {
                if (nodeState.isStarted) {
                    await nodeState.stop();
                }
            }
        }
        if (entry.sleep) {
            await sleep(entry.sleep);
        }

        this.currentStep++;

        return NodeRunStateExecuter.hbbftTreshholdReached(entry);
    
    }
}
