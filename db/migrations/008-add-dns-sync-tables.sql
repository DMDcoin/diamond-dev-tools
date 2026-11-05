-- State of the DNS / email forwarding sync service (src/dns).
-- Last block that was fully ingested per chain.
CREATE TABLE IF NOT EXISTS dns_sync_checkpoint (
    chain_id INTEGER PRIMARY KEY,

    block_number INTEGER NOT NULL,

    -- Hash of block_number at ingestion time, compared on every poll to detect reorgs.
    block_hash BYTEA NOT NULL,

    updated_at TIMESTAMP DEFAULT NOW()
);

-- Every naming system log the sync service has seen, with its processing status.
CREATE TABLE IF NOT EXISTS dns_sync_events (
    id SERIAL PRIMARY KEY,

    chain_id INTEGER NOT NULL,
    tx_hash BYTEA NOT NULL,
    log_index INTEGER NOT NULL,

    block_number INTEGER NOT NULL,
    block_hash BYTEA NOT NULL,

    -- Emitting contract (registrar controller, resolver or DMDNames).
    contract_address BYTEA NOT NULL,

    -- DNSRecordChanged, EmailForwardingTargetChanged, NameActivated, NameDeactivated, NameModerated,
    -- NameBlockedSet, NameRegistered, Transfer
    event_type VARCHAR(40) NOT NULL,

    -- NULL for resolver events until their node is matched to a known name.
    label_hash BYTEA,

    -- namehash(<label>.dmd)
    node BYTEA,

    -- Decoded event values.
    payload JSONB,

    -- pending, processing, done, failed (waiting for retry), dead (gave up), orphaned (removed by a reorg)
    status VARCHAR(20) NOT NULL DEFAULT 'pending',

    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP,
    last_error TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,

    UNIQUE (chain_id, tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_dns_sync_events_label_hash ON dns_sync_events (label_hash, block_number, log_index);
CREATE INDEX IF NOT EXISTS idx_dns_sync_events_status ON dns_sync_events (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_dns_sync_events_node ON dns_sync_events (node) WHERE label_hash IS NULL;

-- One row per known name: node mapping and the DNS state that was last published for it.
CREATE TABLE IF NOT EXISTS dns_sync_names (
    -- keccak256(label), same value as dmd_names.label_hash.
    label_hash BYTEA PRIMARY KEY,

    label VARCHAR(255),

    -- namehash(<label>.dmd), the key used by resolver events.
    node BYTEA NOT NULL UNIQUE,

    -- Website record as last published: A, AAAA or CNAME. NULL when nothing is published.
    applied_website_kind VARCHAR(10),
    applied_website_value TEXT,

    -- Email forwarding target as last published. NULL when nothing is published.
    applied_email TEXT,

    -- Operation sent to the DNS handler but not yet confirmed. Replayed on startup.
    pending_op JSONB,

    -- Set after a reorg removed already processed events of this name.
    dirty BOOLEAN NOT NULL DEFAULT false,

    last_synced_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
);
