import { Queryable, sql } from "@databases/pg";

import { hexToBuffer } from "../utils/hex";


/**
 * Server side moderation list. Names on it are never published.
 * The on-chain blocklist of the registrar controller is checked separately with the chain state.
 */
export interface DnsModerationSource {
    isHidden(labelHash: string): Promise<boolean>;
}

/**
 * Uses the `blocked` flag of the dmd_names directory, the list behind GET /names/blacklisted.
 */
export class DmdNamesModerationSource implements DnsModerationSource {

    public constructor(
        public db: Queryable
    ) { }

    public async isHidden(labelHash: string): Promise<boolean> {
        const [row] = await this.db.query(sql`
            SELECT blocked FROM dmd_names WHERE label_hash = ${hexToBuffer(labelHash)}
        `);

        return row?.blocked === true;
    }
}
