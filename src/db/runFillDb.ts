import { ContractEvent, ContractManager } from "../contractManager";
import { DbManager, convertBufferToEthAddress } from "./database";
import { truncate0x } from "../utils/hex";
import { sleep } from "../utils/time";
import { Node } from "./schema";
import BigNumber from "bignumber.js";
import { EventVisitor, MovedStakeEvent, StakeChangedEvent } from "../eventsVisitor";

// class Node {
//     public constructor(public string
// }


const StakeMovementEvents = [
    'PlacedStake',
    'MovedStake',
    'WithdrewStake',
    'OrderedWithdrawal',
    'ClaimedOrderedWithdrawal',
    'GatherAbandonedStakes'
];


function isStakeMovementEvent(event: ContractEvent): boolean {
    return StakeMovementEvents.includes(event.eventName);
}


function getPoolsSet(events: ContractEvent[]): Set<string> {
    let result = new Set<string>();

    for (const event of events) {
        if (!isStakeMovementEvent(event)) {
            continue;
        }

        if (event.eventName == 'MovedStake') {
            result.add((event as MovedStakeEvent).fromPoolAddress);
            result.add((event as MovedStakeEvent).toPoolAddress);
        } else {
            result.add((event as StakeChangedEvent).poolAddress);
        }
    }

    return result;
}


async function buildEventCache(fromBlock: number, toBlock: number, contractManager: ContractManager) {
    let allEvents = await contractManager.getAllEvents(fromBlock, toBlock);

    const totalEvents = allEvents.length;

    console.log(`building event cache for block range ${fromBlock} to ${toBlock}. total events ${totalEvents}`);

    return new EventCache(fromBlock, toBlock, allEvents);
}

class EventCache {

    // private lastEventIndex = 0;

    public constructor(
        public fromBlock: number,
        public toBlock: number,
        public events: ContractEvent[]
    ) { }

    public getEvents(blockNumber: number): ContractEvent[] {
        if (blockNumber < this.fromBlock || blockNumber > this.toBlock) {
            throw new Error(`blockNumber ${blockNumber} is not in range ${this.fromBlock} - ${this.toBlock}`);
        }

        // ok this could be implemented in a more efficient way.
        // but we do not have many events, so this is ok for now.
        return this.events.filter((event) => event.blockNumber == blockNumber);
    }
}

async function run() {

    // we start from head of the chain to the tail.
    // we process each block.

    let contractManager = ContractManager.get();
    let web3 = contractManager.web3;
    let dbManager = new DbManager();

    let eventVisitor = new EventVisitor(dbManager);

    // await dbManager.deleteCurrentData();
    // let currentBlock = await dbManager.getLastProcessedBlock();
    // console.log(`currentBlock: ${currentBlock}`);

    let latest_known_block = await web3.eth.getBlockNumber();


    let lastProcessedEpochRow = await dbManager.getLastProcessedEpoch();

    let lastInsertedPosdaoEpoch = lastProcessedEpochRow ? lastProcessedEpochRow.id : - 1;


    // let knownNodes = {};
    let knownNodes: { [name: string]: Node } = {};
    let knownNodesByMining: { [name: string]: Node } = {};
    let knownNodesStakingByMining: { [name: string]: string } = {};

    let nodesFromDB = await dbManager.getNodes();


    for (let nodeFromDB of nodesFromDB) {

        //nodeFromDB.pool_address
        let ethAddress = convertBufferToEthAddress(nodeFromDB.pool_address).toLowerCase();
        knownNodes[ethAddress.toLowerCase()] = nodeFromDB;

        let miningAddress = convertBufferToEthAddress(nodeFromDB.mining_address);
        knownNodesByMining[miningAddress.toLowerCase()] = nodeFromDB;
        knownNodesStakingByMining[miningAddress.toLowerCase()] = ethAddress;
    }

    // let dbConnection = createConnectionPool(connectionString);

    // let currentStakeUpdates = contractManager.getStakeUpdatesEvents(blockHeader.number);

    // get's the StakeUpdateEvents from current block and latest known block.

    let lastProcessedBlock = await dbManager.getLastProcessedBlock();
    let currentBlockNumber = lastProcessedBlock ? lastProcessedBlock.block_number + 1 : 0;
    //if currentBlockNumber < latest_known_block

    let blockBeforeTimestamp = lastProcessedBlock ? lastProcessedBlock.block_time.getSeconds() : 0;

    console.log(`importing blocks from ${currentBlockNumber} to ${latest_known_block}`);

    let eventCache = await buildEventCache(currentBlockNumber, latest_known_block, contractManager);


    let insertNode = async (miningAddress: string, blockNumber: number) => {
        // retrieve node information from the contracts.
        //let miningAddress = await contractManager.getAddressMiningByStaking(poolAddress, currentBlockNumber);
        let poolAddress = (await contractManager.getAddressStakingByMining(miningAddress, blockNumber)).toLowerCase();
        let publicKey = await contractManager.getPublicKey(poolAddress, blockNumber);
        let newNode = await dbManager.insertNode(poolAddress, miningAddress, publicKey, blockNumber);
        knownNodes[poolAddress.toLowerCase()] = newNode;
        knownNodesByMining[miningAddress.toLowerCase()] = newNode;
        knownNodesStakingByMining[miningAddress.toLowerCase()] = poolAddress;
    }

    while (currentBlockNumber <= latest_known_block) {
        let blockHeader = await web3.eth.getBlock(currentBlockNumber);
        const { timeStamp, duration, transaction_count, txs_per_sec, posdaoEpoch } = await contractManager.getBlockInfos(blockHeader, blockBeforeTimestamp);
        //console.log(`"${blockHeader.number}","${blockHeader.hash}","${blockHeader.extraData}","${blockHeader.timestamp}","${new Date(timeStamp * 1000).toISOString()}","${duration}","${num_of_validators}","${transaction_count}","${txs_per_sec.toFixed(4)}"`);
        // console.log( `${blockHeader.number} ${blockHeader.hash} ${blockHeader.extraData} ${blockHeader.timestamp} ${new Date(thisTimeStamp * 1000).toUTCString()} ${lastTimeStamp - thisTimeStamp}`);
        blockBeforeTimestamp = timeStamp;

        let delta = await contractManager.getRewardDeltaPot(blockHeader.number);
        let reinsert = await contractManager.getRewardReinsertPot(blockHeader.number);
        let rewardContractTotal = await contractManager.getRewardContractTotal(blockHeader.number);
        let unclaimed = new BigNumber(rewardContractTotal);

        unclaimed = unclaimed.minus(delta);
        unclaimed = unclaimed.minus(reinsert);

        //lastTimeStamp = thisTimeStamp;
        //blockHeader = blockBefore;
        await dbManager.insertHeader(blockHeader.number, truncate0x(blockHeader.hash), duration, new Date(timeStamp * 1000), truncate0x(blockHeader.extraData), transaction_count, posdaoEpoch, txs_per_sec, reinsert, delta, rewardContractTotal, unclaimed.toString(10));


        if (currentBlockNumber == 0) {

            // on the first block we need to add the MOC.
            let validators = await contractManager.getValidators(currentBlockNumber);

            for (let miningAddress of validators) {


                await insertNode(miningAddress, currentBlockNumber);

            }
        }

        const eventCacheByBlock = eventCache.getEvents(blockHeader.number);
        const poolsSet = getPoolsSet(eventCacheByBlock);

        for (const pool of poolsSet) {
            if (Object.keys(knownNodes).includes(pool)) {
                continue;
            }

            // retrieve node information from the contracts.
            let miningAddress = await contractManager.getAddressMiningByStaking(pool, currentBlockNumber);
            let publicKey = await contractManager.getPublicKey(pool, currentBlockNumber);
            let node = await dbManager.insertNode(pool, miningAddress, publicKey, currentBlockNumber);
            knownNodes[pool.toLowerCase()] = node;
            knownNodesByMining[miningAddress.toLowerCase()] = node;
            knownNodesStakingByMining[miningAddress.toLowerCase()] = pool;
        }

        // insert the posdao information
        if (posdaoEpoch > lastInsertedPosdaoEpoch) {
            // we insert the posdao information for the epoch.
            //let posdaoEpoch = await contractManager.getPosdaoEpoch(posdaoEpoch);
            if (lastInsertedPosdaoEpoch >= 0) {
                dbManager.endStakingEpoch(lastInsertedPosdaoEpoch, blockHeader.number - 1);

                // update the rewards of last staking epoch.

                // get the validator infos.
                let rewardedValidators = await contractManager.getValidators(blockHeader.number - 1);

                for (let rewardedValidator of rewardedValidators) {

                    let pool = knownNodesStakingByMining[rewardedValidator.toLowerCase()];

                    if (!pool) {
                        console.log(`Could not find pool for mining address ${rewardedValidator}`);
                        continue;
                    }
                    let validatorReward = (await contractManager.getReward(pool, pool, lastInsertedPosdaoEpoch, blockHeader.number));
                    await dbManager.updateValidatorReward(rewardedValidator, lastInsertedPosdaoEpoch, validatorReward);
                }

            }

            await dbManager.insertStakingEpoch(posdaoEpoch, blockHeader.number);
            lastInsertedPosdaoEpoch = posdaoEpoch;

            // get the validator infos.
            let validators = await contractManager.getValidators(currentBlockNumber);

            for (let validator of validators) {
                let poolAddressBin = knownNodesByMining[validator.toLowerCase()].pool_address;
                let poolAddress = convertBufferToEthAddress(poolAddressBin);
                await dbManager.insertEpochNode(posdaoEpoch, poolAddress, contractManager);
            }
        }

        // fill db with events
        for (const event of eventCacheByBlock) {
            event.accept(eventVisitor);
        }

        // if there is still no change, sleep 1s
        while (currentBlockNumber == latest_known_block) {

            // do something to make further processing possible.
            latest_known_block = await web3.eth.getBlockNumber();

            if (latest_known_block > currentBlockNumber) {
                console.log(`building EventCache ${currentBlockNumber} ${latest_known_block}`);
                eventCache = await buildEventCache(currentBlockNumber, latest_known_block, contractManager);
            } else {
                await sleep(1000);
            }
        }

        currentBlockNumber += 1;
    }

    // we managed to read the last block.
    // press q to quit.
    // this way it can be ran as a server that keeps importing new blocks.

}


run();
