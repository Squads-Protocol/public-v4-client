import type { ReactNode } from 'react';
import { PublicKey } from '@solana/web3.js';
import { formatSol } from '@/lib/transaction/describe';
import { isPublickey } from '@/lib/isPublickey';

export function Labeled({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function NativeSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { readonly value: T; readonly label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <select
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-start gap-2">
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}

export const solHint = (label: string, lamports: bigint) => `${label}: ${formatSol(lamports)}`;

/** Returns the PublicKey, or throws an Error with a readable message. */
export function toPublicKey(value: string, name: string): PublicKey {
  if (!isPublickey(value)) throw new Error(`Enter a valid address for the ${name}.`);
  return new PublicKey(value);
}

/** Integer in [min, max], or null. */
export function parseWholeNumber(value: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}
