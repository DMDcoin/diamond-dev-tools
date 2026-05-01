import { ContractEvent, ContractManager } from "./contractManager";
import {
    EventVisitor,
    MovedStakeEvent,
    StakeChangedEvent
} from "./eventsVisitor";


export class EventProcessor {
    public events: ContractEvent[];

    public constructor(
        public contractManager: ContractManager,
        public eventsVisitor: EventVisitor,
    ) {
        this.events = new Array<ContractEvent>();
    }

    public async fetchBlockEvents(blockNumber: number) {
        this.events = await this.contractManager.getAllEvents(blockNumber, blockNumber);

        if (this.events.length == 0) {
            return;
        }

        console.log(`pulled block ${blockNumber} with ${this.events.length} events`);
    }

    public async processEvents() {
        if (this.events.length == 0) {
            return;
        }

        for (const event of this.events) {
            await event.accept(this.eventsVisitor);
        }
    }

    public getPoolsSet(): Set<string> {
        let result = new Set<string>();

        for (const event of this.events) {
            if (!EventProcessor.isStakeMovementEvent(event)) {
                continue;
            }

            if (event.eventName == 'MovedStake') {
                result.add((event as MovedStakeEvent).fromPoolAddress.toLowerCase());
                result.add((event as MovedStakeEvent).toPoolAddress.toLowerCase());
            } else {
                result.add((event as StakeChangedEvent).poolAddress.toLowerCase());
            }
        }

        return result;
    }

    public getDelegatorsSet(): Set<string> {
        let result = new Set<string>();

        for (const event of this.events) {
            if (!EventProcessor.isPlacedStakeEvent(event)) {
                continue;
            }

            if ((event as StakeChangedEvent).isDelegatorStake()) {
                result.add((event as StakeChangedEvent).stakerAddress);
            }
        }

        return result;
    }


    public static getStakeMovementEvents(): string[] {
        return [
            'PlacedStake',
            'MovedStake',
            'WithdrewStake',
            'OrderedWithdrawal',
            'ClaimedOrderedWithdrawal',
            'GatherAbandonedStakes'
        ];
    }

    public static isStakeMovementEvent(event: ContractEvent): boolean {
        return EventProcessor.getStakeMovementEvents().includes(event.eventName);
    }

    public static isPlacedStakeEvent(event: ContractEvent): boolean {
        return event.eventName == 'PlacedStake';
    }
}
