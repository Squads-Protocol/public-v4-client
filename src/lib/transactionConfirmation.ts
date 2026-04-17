import { Connection, SignatureStatus } from '@solana/web3.js';

const TIMEOUT_MS = 30_000;
const INITIAL_DELAY_MS = 1_000;
const RPC_CALL_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`RPC call timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export async function waitForConfirmation(
  connection: Connection,
  signatures: string[]
): Promise<(SignatureStatus | null)[]> {
  const startTime = Date.now();
  let delayMs = INITIAL_DELAY_MS;

  while (Date.now() - startTime < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, delayMs));
    delayMs *= 2;

    let statuses: (SignatureStatus | null)[];
    try {
      const result = await withTimeout(
        connection.getSignatureStatuses(signatures, { searchTransactionHistory: true }),
        RPC_CALL_TIMEOUT_MS
      );
      statuses = result.value;
    } catch {
      // RPC call timed out or failed — skip this iteration and retry
      continue;
    }

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
