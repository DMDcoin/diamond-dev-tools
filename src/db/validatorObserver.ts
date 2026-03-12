import { ContractManager } from "../contractManager";

import { DbManager } from "./database";

import {
    PendingValidatorStateEvent,
    PendingValidatorStateEvent_InsertParameters
} from "./schema";

import { addressToBuffer, bufferToAddress } from "../utils/ether";

import { Watchdog } from '../watchdog';


export enum ValidatorState {
    Current = 'current',
    Pending = 'pending'
};


export class Validator {
    public constructor(
        public state: ValidatorState,
        public node: string,
        public enterBlockNumber: number,
        public keyGenRound: number, 
        public exitBlockNumber?: number | null,
    ) { }

    // public static fromEntity(record: PendingValidatorStateEvent, contractManager: ContractManager): Validator {

        
        
    //     return new Validator(
    //         record.state as ValidatorState,
    //         bufferToAddress(record.node),
    //         record.on_enter_block_number,
    //         record.keygen_round,
    //         record.on_exit_block_number,
    //         record.
    //     );
    // }

    public toEntity(): PendingValidatorStateEvent_InsertParameters {
        return {
            state: this.state.valueOf(),
            on_enter_block_number: this.enterBlockNumber,
            on_exit_block_number: this.exitBlockNumber,
            node: addressToBuffer(this.node),
            keygen_round: this.keyGenRound
        };
    }
}

export class ValidatorObserver {
    public currentValidators: Array<string>;
    public pendingValidators: Array<string>;
    public currentKeyGenRound: number = 0;
    public currentPosdaoEpoch: number = 0;

    public constructor(
        public contractManager: ContractManager,
        public dbManager: DbManager
    ) {
        this.currentValidators = new Array<string>();
        this.pendingValidators = new Array<string>();
    }

    public static async build(
        contractManager: ContractManager,
        dbManager: DbManager
    ): Promise<ValidatorObserver> {
        let observer = new ValidatorObserver(contractManager, dbManager);

        await observer.initialize();

        return observer;
    }

    public async initialize(): Promise<void> {
        const result = await this.dbManager.getValidators();

        this.currentValidators = new Array<string>();
        this.pendingValidators = new Array<string>();

        for (const entity of result) {
            const validatorAddress = bufferToAddress(entity.node).toLowerCase();
            
            if (entity.state === ValidatorState.Current.valueOf()) {
                this.currentValidators.push(validatorAddress);
            }

            if (entity.state === ValidatorState.Pending.valueOf()) {
                this.pendingValidators.push(validatorAddress);
            }
        }
    }

    public async updateValidators(blockNumber: number, posdaoEpoch: number): Promise<void> {
        
        const keyGenRound = await this.contractManager.getKeyGenRound(blockNumber);
        
        
        //console.log("updated validators: ", blockNumber);

        const pendingValidators = await this.fetchPendingValidators(blockNumber);

        if (this.currentKeyGenRound == keyGenRound && this.currentPosdaoEpoch == posdaoEpoch && Watchdog.deepEquals(this.pendingValidators, pendingValidators)) {
            // still on same key gen round, nothing to do.
            return;
        }


        const currentValidators = await this.fetchCurrentValidators(blockNumber);
        this.currentPosdaoEpoch = posdaoEpoch;


        if (!Watchdog.deepEquals(this.pendingValidators, pendingValidators) || this.currentKeyGenRound != keyGenRound) {
            // const { added, removed } = Watchdog.createDiffgram(this.pendingValidators, pendingValidators);

            // console.log(`Pending validators switch, added: ${added}  removed: ${removed}`);
            // console.log("processRemovedValidators: ", keyGenRound, this.pendingValidators);
            await this.processRemovedValidators(this.pendingValidators, blockNumber, ValidatorState.Pending, keyGenRound);
            // console.log("processAddedValidators: ", keyGenRound, pendingValidators);
            await this.processAddedValidators(pendingValidators, blockNumber, ValidatorState.Pending, keyGenRound);

            this.pendingValidators = pendingValidators;
            this.currentKeyGenRound = keyGenRound;
        }

        if (!Watchdog.deepEquals(this.currentValidators, currentValidators) || this.currentKeyGenRound != keyGenRound) {
            
            //const { added, removed } = Watchdog.createDiffgram(this.currentValidators, currentValidators);
            //console.log(`Current validators switch, added: ${added}  removed: ${removed}`);
            //this.currentValidators = currentValidators;

            await this.processRemovedValidators(this.currentValidators , blockNumber, ValidatorState.Current, keyGenRound);
            await this.processAddedValidators(currentValidators, blockNumber, ValidatorState.Current, keyGenRound);

            this.currentValidators = currentValidators;
        }
    }

    private async processAddedValidators(addedValidators: string[], blockNumber: number, state: ValidatorState, keyGenRound: number): Promise<void> {
        for (const added of addedValidators) {
            // Check if there's already an open record for this validator state
            const existingValidator = await this.dbManager.findValidator(added, state.valueOf());
            
            if (existingValidator) {
                continue;
            }

            const validator = new Validator(
                state,
                added,
                blockNumber,
                keyGenRound,
                null
            );

            await this.dbManager.insertValidator(validator.toEntity());
        }
    }

    private async processRemovedValidators(removedValidators: string[], blockNumber: number, state: ValidatorState, keygenRound: number): Promise<void> {
        // const keygenRound = await this.contractManager.getKeyGenRound(blockNumber);

        for (const removed of removedValidators) {
            const result = await this.dbManager.updateOrIgnoreValidator(
                removed,
                state.valueOf(),
                blockNumber,
                keygenRound
            );

            if (!result) {
                console.log(`Existing record of ${state.valueOf()} validator ${removed} not found!`);
            }
        }
    }

    private normalize(items: string[]): string[] {
        return items.map((x) => x.toLowerCase());
    }

    private async fetchCurrentValidators(blockNumber: number): Promise<string[]> {
        const validators = await this.contractManager.getValidators(blockNumber);

        return this.normalize(validators);
    }

    private async fetchPendingValidators(blockNumber: number): Promise<string[]> {
        const validators = await this.contractManager.getPendingValidators(blockNumber);

        return this.normalize(validators);
    }
}
