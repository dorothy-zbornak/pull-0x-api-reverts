const { BigQuery } = require('@google-cloud/bigquery');
const chrono = require('chrono-node');
const fs = require('fs');
const path = require('path');

const CREDENTIALS_FILE = path.resolve(__dirname, '../credentials.json');
const CREDENTIALS = JSON.parse(fs.readFileSync(CREDENTIALS_FILE));
const BQ_OPTS = {
    projectId: CREDENTIALS.project_id,
    credentials: {
        client_email: CREDENTIALS.client_email,
        private_key: CREDENTIALS.private_key,
    },
};

module.exports = async (opts = {}) => {
    const qs = createQuery(opts);
    const bq = new BigQuery(BQ_OPTS);
    const [ job ] = await bq.createQueryJob({ query: qs, location: 'US' });
    const [ rows ] = await job.getQueryResults();
    return rows;
};

function createQuery(opts = {}) {
    const since = chrono.parseDate(opts.since || 'one day ago');
    const until = chrono.parseDate(opts.until || 'now');
    const selectors = opts.selectors || [];
    const limit = opts.limit || 1024 * 16;
    const targets = opts.targets || [];
    return `
        SELECT
            a.*,
            b.gas_price,
            b.receipt_status
        FROM
            \`bigquery-public-data.crypto_ethereum.traces\` a,
            (
                SELECT
                    a.transaction_hash,
                    t.gas_price,
                    t.receipt_status
                FROM
                    \`bigquery-public-data.crypto_ethereum.traces\` a,
                    (
                        SELECT
                            *
                        FROM \`bigquery-public-data.crypto_ethereum.transactions\`
                        WHERE
                                -- Must be >= since
                                block_timestamp >= TIMESTAMP_MILLIS(${since.getTime()})
                            AND
                                -- Must be <= until
                                block_timestamp <= TIMESTAMP_MILLIS(${until.getTime()})
                        ORDER BY block_timestamp, transaction_index ASC
                    ) t
                WHERE
                        a.transaction_hash = t.hash
                    AND
                        -- Must not be an internal/delegated call
                        a.from_address <> a.to_address
                    AND
                        -- Must be a call or delegatecall
                        a.call_type IN ('call', 'delegatecall')
                    AND
                        -- Must have reverted
                        a.error IS NOT NULL
                    AND
                        -- Must be to a target function
                        (${
                            targets.length == 0
                            ? '1 = 1'
                            : targets.map(t => `
                                (
                                    a.to_address IN (${t.addresses.map(s => `'${s.toLowerCase()}'`).join(',')})
                                    AND
                                    SUBSTR(a.input, 0, 10) IN (${t.selectors.map(s => `'${s.toLowerCase()}'`).join(',')})
                                )
                            `).join(' OR ')
                        })
                GROUP BY a.transaction_hash, t.gas_price, t.receipt_status
            ) b
        WHERE
            a.transaction_hash = b.transaction_hash
        ORDER BY CONCAT(a.block_number, '_', a.transaction_index, '_', a.trace_address) ASC
        LIMIT ${limit}
    `;
}
