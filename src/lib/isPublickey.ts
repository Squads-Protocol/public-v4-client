"use client";
import { PublicKey } from "@solana/web3.js";

export function isPublickey(key: string) {
  try {
    new PublicKey(key);
    return true;
  } catch (err) {
    return false;
  }
}
