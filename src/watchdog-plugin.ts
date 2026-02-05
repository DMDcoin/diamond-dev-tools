
import { ContractManager } from "./contractManager";



export class WatchdogPlugin {

    public contractManager?: ContractManager;

    public processBlock(blockNumber: number ) : Promise<void> {
        return Promise.resolve();
    }


    public processEpochStart(blockNumber: number, epochNumber: number) : Promise<void> {
        return Promise.resolve();
    }

}


export class WatchdogPluginComposite extends WatchdogPlugin {

    public constructor(cm: ContractManager, public plugins: WatchdogPlugin[]) {
        super(); 

        plugins.forEach( p => p.contractManager = cm );
    }

    public processBlock(blockNumber: number ) : Promise<void> {
        return Promise.all(this.plugins.map(p => p.processBlock(blockNumber))).then( () => {});
    }

    public processEpochStart(blockNumber: number, epochNumber: number) : Promise<void> {
        return Promise.all(this.plugins.map(p => p.processEpochStart(blockNumber, epochNumber))).then( () => {});
    }

}
