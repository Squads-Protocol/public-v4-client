import { Button } from './ui/button';
import { Input } from './ui/input';
import { useRef } from 'react';
import { Member, createMultisig } from '@/lib/createSquad';
import { formatTransactionError } from '@/lib/utils';
import { Keypair, PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { CheckSquare, Copy, ExternalLink, PlusCircleIcon, XIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from 'sonner';
import { isPublickey } from '@/lib/isPublickey';
import { ValidationRules, useSquadForm } from '@/lib/hooks/useSquadForm';
import { useMultisigData } from '@/hooks/useMultisigData';
import { useMultisigAddress } from '@/hooks/useMultisigAddress';
import {Link} from "react-router-dom";
import { waitForConfirmation } from '@/lib/transactionConfirmation';

interface MemberAddresses {
  count: number;
  memberData: Member[];
}

interface CreateSquadFormData {
  members: MemberAddresses;
  threshold: number;
  rentCollector: string;
  configAuthority: string;
  createKey: string;
}

export default function CreateSquadForm({}: {}) {
  const { publicKey, connected, sendTransaction } = useWallet();

  const { connection, programId } = useMultisigData();
  const { setMultisigAddress } = useMultisigAddress();
  const signatureRef = useRef<string>('');
  const validationRules = getValidationRules();

  const { formState, handleChange, handleAddMember, onSubmit } = useSquadForm<{
    signature: string;
    multisig: string;
  }>(
    {
      threshold: 1,
      rentCollector: '',
      configAuthority: '',
      createKey: '',
      members: {
        count: 0,
        memberData: [],
      },
    },
    validationRules
  );

  async function submitHandler() {
    if (!connected) throw new Error('Please connect your wallet.');
    const values = formState.values as unknown as CreateSquadFormData;
    try {
      const createKey = Keypair.generate();

      const { transaction, multisig } = await createMultisig(
        connection,
        publicKey!,
        values.members.memberData,
        values.threshold,
        createKey.publicKey,
        values.rentCollector,
        values.configAuthority,
        programId.toBase58()
      );

      toast.loading('Waiting for wallet approval...', { id: 'create', duration: Infinity });

      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: true,
        signers: [createKey],
      });
      signatureRef.current = signature;

      const shortSig = `${signature.slice(0, 8)}...${signature.slice(-4)}`;
      toast.info(`Sent: ${signature}`, { duration: 6000 });
      toast.info(`Confirming: ${shortSig}`, { id: 'create', duration: Infinity });

      const [confirmed] = await waitForConfirmation(connection, [signature]);
      if (!confirmed) {
        throw `Transaction failed or timed out. Check ${signature}`;
      }

      setMultisigAddress.mutate(multisig.toBase58());

      return { signature, multisig: multisig.toBase58() };
    } catch (error: unknown) {
      throw error;
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  const values = formState.values as unknown as CreateSquadFormData;

  return (
    <>
      <div className="grid grid-cols-8 gap-4 mb-6">
        <div className="col-span-6 flex-col space-y-2">
          <label htmlFor="members" className="font-medium">
            Members <span className="text-red-600">*</span>
          </label>
          {values.members.memberData.map((member: Member, i: number) => (
            <div key={i} className="grid grid-cols-4 items-center gap-2">
              <div className="relative col-span-3">
                <Input
                  defaultValue={member.key ? member.key.toBase58() : ''}
                  placeholder={`Member key ${i + 1}`}
                  onChange={(e) => {
                    handleChange('members', {
                      count: values.members.count,
                      memberData: values.members.memberData.map(
                        (member: Member, index: number) => {
                          if (index === i) {
                            let newKey = null;
                            try {
                              if (e.target.value && PublicKey.isOnCurve(e.target.value)) {
                                newKey = new PublicKey(e.target.value);
                              }
                            } catch (_) {
                              // invalid key — newKey stays null
                            }
                            return {
                              ...member,
                              key: newKey,
                            };
                          }
                          return member;
                        }
                      ),
                    });
                  }}
                />
                {i > 0 && (
                  <XIcon
                    onClick={() => {
                      handleChange('members', {
                        count: values.members.count,
                        memberData: values.members.memberData.filter(
                          (_: Member, index: number) => index !== i
                        ),
                      });
                    }}
                    className="absolute inset-y-3 right-2 w-4 h-4 text-zinc-400 hover:text-zinc-600"
                  />
                )}
              </div>
              <Select
                defaultValue={member.permissions.mask.toString()}
                onValueChange={(e: string) => {
                  handleChange('members', {
                    count: values.members.count,
                    memberData: values.members.memberData.map(
                      (member: Member, index: number) => {
                        if (index === i) {
                          return {
                            ...member,
                            permissions: {
                              mask: Number(e),
                            },
                          };
                        }
                        return member;
                      }
                    ),
                  });
                }}
              >
                <SelectTrigger className="col-span-1">
                  <SelectValue placeholder="Select permissions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="0">None</SelectItem>
                    <SelectItem value="1">Proposer</SelectItem>
                    <SelectItem value="2">Voter</SelectItem>
                    <SelectItem value="4">Executor</SelectItem>
                    <SelectItem value="7">All</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          ))}
          <button
            onClick={(e) => handleAddMember(e)}
            className="mt-2 flex gap-1 items-center text-zinc-400 hover:text-zinc-600"
          >
            <PlusCircleIcon className="w-4" />
            <p className="text-sm">Add Address</p>
          </button>
          {formState.errors.members && (
            <div className="mt-1.5 text-red-500 text-xs">{formState.errors.members}</div>
          )}
        </div>
        <div className="col-span-4 flex-col space-y-2">
          <label htmlFor="threshold" className="font-medium">
            Threshold <span className="text-red-600">*</span>
          </label>
          <Input
            type="number"
            placeholder="Approval threshold for execution"
            defaultValue={values.threshold}
            onChange={(e) => handleChange('threshold', parseInt(e.target.value))}
            className=""
          />
          {formState.errors.threshold && (
            <div className="mt-1.5 text-red-500 text-xs">{formState.errors.threshold}</div>
          )}
        </div>
        <div className="col-span-4 flex-col space-y-2">
          <label htmlFor="rentCollector" className="font-medium">
            Rent Collector
          </label>
          <Input
            type="text"
            placeholder="Optional rent collector"
            defaultValue={values.rentCollector}
            onChange={(e) => handleChange('rentCollector', e.target.value)}
            className=""
          />
          {formState.errors.rentCollector && (
            <div className="mt-1.5 text-red-500 text-xs">{formState.errors.rentCollector}</div>
          )}
        </div>
        <div className="col-span-4 flex-col space-y-2">
          <label htmlFor="configAuthority" className="font-medium">
            Config Authority
          </label>
          <Input
            type="text"
            placeholder="Optional config authority"
            defaultValue={values.configAuthority}
            onChange={(e) => handleChange('configAuthority', e.target.value)}
            className=""
          />
          {formState.errors.configAuthority && (
            <div className="mt-1.5 text-red-500 text-xs">{formState.errors.configAuthority}</div>
          )}
        </div>
      </div>
      <Button
        onClick={async () => {
          try {
            const res = await onSubmit(submitHandler);
            toast.success(
              <div className="w-full flex items-center justify-between">
                <div className="flex gap-4 items-center">
                  <CheckSquare className="w-4 h-4 text-green-600" />
                  <div className="flex flex-col space-y-0.5">
                    <p className="font-semibold">
                      Squad Created:{' '}
                      <span className="font-normal">
                        {res.multisig.slice(0, 4) + '...' + res.multisig.slice(-4)}
                      </span>
                    </p>
                    <p className="font-light">Your new Squad has been set as active.</p>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <Copy
                    onClick={() => {
                      navigator.clipboard.writeText(res.multisig);
                      toast.success('Copied address!');
                    }}
                    className="w-4 h-4 hover:text-stone-500"
                  />
                  <Link
                    to={`https://explorer.solana.com/address/${res.multisig}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="w-4 h-4 hover:text-stone-500" />
                  </Link>
                </div>
              </div>,
              { id: 'create', duration: 10000 }
            );
          } catch (e) {
            toast.error(
              `Failed to create squad: ${formatTransactionError(e)}${signatureRef.current ? ` (${signatureRef.current})` : ''}`,
              { id: 'create' }
            );
          }
        }}
      >
        Create Squad
      </Button>
    </>
  );
}

function getValidationRules(): ValidationRules {
  return {
    threshold: async (value: unknown) => {
      if ((value as number) < 1) return 'Threshold must be greater than 0';
      return null;
    },
    rentCollector: async (value: unknown) => {
      if (!isPublickey(value as string)) return 'Rent collector must be a valid public key';
      return null;
    },
    configAuthority: async (value: unknown) => {
      if (!isPublickey(value as string)) return 'Config authority must be a valid public key';
      return null;
    },
    members: async (value: unknown) => {
      const { count, memberData } = value as { count: number; memberData: Member[] };
      if (count < 1) return 'At least one member is required';

      const valid = await Promise.all(
        memberData.map(async (member) => {
          if (member.key == null) return 'Invalid Member Key';
          if (!isPublickey(member.key.toBase58())) return 'Invalid Member Key';
          return null;
        })
      );

      const firstInvalid = valid.findIndex((v) => v === 'Invalid Member Key');
      if (firstInvalid !== -1) return `Member ${firstInvalid + 1} is invalid`;

      return null;
    },
  };
}
