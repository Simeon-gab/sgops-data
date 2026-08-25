# Tests

```
npm test               # unit, no database, no network, always safe
npm run test:integration   # needs a throwaway Supabase project, see below
npm run test:watch     # unit, re-running on change
```

The runner is Node's built-in `node --test` with `tsx` for TypeScript and the
`@/` alias. No test framework dependency.

## What is covered, and why these things

These suites exist because the code they cover has produced real bugs, twice.
Each file guards a specific way this product can fail quietly.

| Suite | Guards against |
| --- | --- |
| `unit/schedule.test.ts` | Sending at the wrong hour in the recipient's timezone, or twice as fast as intended. Includes both sides of a daylight-saving shift and windows that wrap past midnight. |
| `unit/merge-fields.test.ts` | Mailing "Hi ," to a whole list. An unfillable placeholder must be reported so the recipient is skipped, never silently blanked. |
| `unit/eligibility.test.ts` | Mailing someone who unsubscribed, bounced, or whose address was only ever guessed. |
| `unit/crypto.test.ts` | Mailbox passwords being readable, or a tampered ciphertext decrypting to something that then gets used. |
| `unit/smtp-transport.test.ts` | Pointing the sender at an internal host, and failures that do not say what to fix. Runs against a real socket, not a mock. |
| `integration/campaign-drive.test.ts` | The whole chain: identity, credentials, the SMTP conversation, the send log, the pipeline. And the failure path, where a rejected login must be reported rather than looking like nothing happened. |

## Integration tests and the database

They write real rows, so they refuse to run unless pointed at a Supabase
project that is not the one the app is configured against:

```
TEST_SUPABASE_URL=https://<throwaway-project>.supabase.co
TEST_SUPABASE_SERVICE_ROLE_KEY=<its service role key>
```

Without both they skip. If `TEST_SUPABASE_URL` matches
`NEXT_PUBLIC_SUPABASE_URL` they also skip, with a message saying why, because
the most likely way to lose real data here is to point them at the live
project by accident.

The throwaway project needs the migrations from `supabase/migrations/` applied
and one row in `workspaces`. Every row the tests create is tagged and removed
afterwards, including when a test fails.

No message ever leaves the machine: the mail server in
`helpers/smtp-server.ts` is a socket on localhost that speaks enough SMTP to
be talked to properly and discards what it receives. Recipient addresses use
the reserved `.invalid` TLD, which cannot resolve.
