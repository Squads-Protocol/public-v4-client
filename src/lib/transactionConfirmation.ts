import { Connection, RpcResponseAndContext, SignatureStatus } from '@solana/web3.js';

export async function waitForConfirmation(
  connection: Connection,
  signatures: string[],
  timeoutMs: number = 10000
): Promise<(null | SignatureStatus)[]> {
  const startTime = Date.now();
  let latestStatuses: (null | SignatureStatus)[] = [];

  while (Date.now() - startTime < timeoutMs) {
    const response: RpcResponseAndContext<(SignatureStatus | null)[]> =
      await connection.getSignatureStatuses(signatures);
    latestStatuses = response.value;

    if (
      latestStatuses.every(
        (status) =>
          (!status?.err || Object.keys(status?.err).length === 0) &&
          status?.confirmationStatus === 'confirmed'
      )
    ) {
      return latestStatuses;
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  return latestStatuses;
}
