import { PublicKey } from '@solana/web3.js';

export class ReaderOverflowError extends Error {}

/** Little-endian, bounds-checked reader for bincode-encoded instruction data. */
export class ByteReader {
  private offset = 0;
  private readonly view: DataView;

  constructor(private readonly data: Uint8Array) {
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  get remaining(): number {
    return this.data.length - this.offset;
  }

  private take(length: number): number {
    if (length < 0 || this.offset + length > this.data.length) {
      throw new ReaderOverflowError(`need ${length} bytes at offset ${this.offset}`);
    }
    const start = this.offset;
    this.offset += length;
    return start;
  }

  u8(): number {
    return this.view.getUint8(this.take(1));
  }

  u16(): number {
    return this.view.getUint16(this.take(2), true);
  }

  u32(): number {
    return this.view.getUint32(this.take(4), true);
  }

  u64(): bigint {
    return this.view.getBigUint64(this.take(8), true);
  }

  i64(): bigint {
    return this.view.getBigInt64(this.take(8), true);
  }

  bytes(length: number): Uint8Array {
    const start = this.take(length);
    return this.data.slice(start, start + length);
  }

  pubkey(): PublicKey {
    return new PublicKey(this.bytes(32));
  }

  /** bincode `String`: u64 length prefix + UTF-8 bytes. */
  string(): string {
    const length = this.u64();
    if (length > BigInt(this.remaining)) {
      throw new ReaderOverflowError(`string length ${length} exceeds remaining bytes`);
    }
    return new TextDecoder().decode(this.bytes(Number(length)));
  }

  /** bincode `Option<T>`: one tag byte (0 = None, 1 = Some). */
  option<T>(read: () => T): T | null {
    const tag = this.u8();
    if (tag === 0) return null;
    if (tag === 1) return read();
    throw new ReaderOverflowError(`invalid option tag ${tag}`);
  }
}
