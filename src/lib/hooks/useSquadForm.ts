"use client";
import { useCallback, useState } from "react";
import type { MouseEvent } from "react";

type SubmitHandler<T> = () => Promise<T>;

export interface FormValues {
  [key: string]: unknown;
}

export type ValidationErrors = Record<string, string>;
export type ValidationFunction = (value: unknown) => Promise<string | null>;
export interface ValidationRules {
  [key: string]: ValidationFunction;
}

export interface FormState {
  values: FormValues;
  errors: ValidationErrors;
  isValid: boolean;
  isLoading: boolean;
}

export function useSquadForm<T>(
  initialValues: FormValues,
  validationRules: ValidationRules
) {
  const [formState, setFormState] = useState<FormState>({
    values: initialValues,
    errors: {},
    isValid: true,
    isLoading: false,
  });

  const validateField = useCallback(
    async (field: string, value: unknown) => {
      if (validationRules[field]) {
        const error = await validationRules[field](value);
        return error;
      }
      return null;
    },
    [validationRules]
  );

  const handleChange = useCallback(
    async (field: string, value: unknown) => {
      setFormState((prev) => ({
        ...prev,
        isLoading: true,
        values: { ...prev.values, [field]: value },
      }));

      const error = await validateField(field, value);

      setFormState((prev) => {
        const newErrors = { ...prev.errors, [field]: error || "" };
        const isValid = Object.values(newErrors).every((err) => !err);

        return {
          ...prev,
          errors: newErrors,
          isValid,
          isLoading: false,
        };
      });
    },
    [validateField]
  );

  const handleAddMember = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const current = formState.values.members as { count: number; memberData: unknown[] };
    handleChange("members", {
      count: current.count + 1,
      memberData: [
        ...current.memberData,
        { key: null, permissions: { mask: 0 } },
      ],
    });
  };

  const onSubmit = async (handler: SubmitHandler<T>): Promise<T> => {
    setFormState((prev) => ({
      ...prev,
      isLoading: true,
    }));
    try {
      return await handler();
    } catch (error: unknown) {
      throw error;
    } finally {
      setFormState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }
  };

  return { formState, handleChange, handleAddMember, onSubmit };
}
