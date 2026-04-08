import { Connection, SignatureStatus } from '@solana/web3.js';

const TIMEOUT_MS = 30_000;
const INITIAL_DELAY_MS = 1_000;

export async function waitForConfirmation(
  connection: Connection,
  signatures: string[]
): Promise<(SignatureStatus | null)[]> {
  const startTime = Date.now();
  let delayMs = INITIAL_DELAY_MS;

  while (Date.now() - startTime < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, delayMs));
    delayMs *= 2;

    const { value: statuses } = await connection.getSignatureStatuses(signatures);

    // Explicit on-chain failure — return null for failed, status for others
    if (statuses.some((s) => s?.err != null)) {
      return statuses.map((s) => (s?.err != null ? null : s));
    }

    // All confirmed or finalized — success
    if (
      statuses.every(
        (s) =>
          s?.confirmationStatus === 'confirmed' || s?.confirmationStatus === 'finalized'
      )
    ) {
      return statuses;
    }
  }

  // 30s elapsed without explicit success or failure — treat as failure
  return signatures.map(() => null);
}
