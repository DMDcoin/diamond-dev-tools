import { WatchdogPlugin } from "./watchdog-plugin";


export class ConnectivityTrackerWatchdogPlugin extends WatchdogPlugin{


    public async processBlock(blockNumber: number ) {
        const cm = this.contractManager!;
        const web3 = cm.web3;

        const bonusScoreSystem = cm.getBonusScoreSystem();

        //const eventName = bonusScoreSystem.events.ValidatorScoreChanged.; 
        // console.log("eventName:", eventName);
        //const latest = web3.eth.getBlock("latest");
        
        const pastEvents = await bonusScoreSystem.getPastEvents("ValidatorScoreChanged", { fromBlock: blockNumber, toBlock: blockNumber});

        if (pastEvents.length > 0) {
            console.log("ValidatorScoreChanged:", blockNumber);

            for( const event of pastEvents) {
                console.log("address:", event.address, "return:",  event.returnValues);
            }
        }
    }
}