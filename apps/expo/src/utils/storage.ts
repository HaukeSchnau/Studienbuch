import type { PrimitiveAtom } from "jotai";
import type { ZodSchema } from "zod";
import { useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import { atom, getDefaultStore, useAtom } from "jotai";
import { z } from "zod";

const schemas = {
  "auth.session": z
    .object({
      user: z
        .object({
          id: z.string(),
          name: z.string(),
          isSuperUser: z.boolean(),
        })
        .nullable(),
      token: z.string(),
    })
    .nullable(),
  "auth.licenseKey": z.string(),
} as const satisfies Record<string, ZodSchema>;

type Keys = keyof typeof schemas;

const atoms: Partial<{
  [K in Keys]: StorageAtom<K>;
}> = {};

type StorageAtom<TKey extends Keys> = PrimitiveAtom<StorageValue<TKey> | null>;
type StorageValue<TKey extends Keys> = z.infer<(typeof schemas)[TKey]>;

const getStorageValue = <TKey extends Keys>(
  key: TKey,
): StorageValue<TKey> | null => {
  const strValue = SecureStore.getItem(key);
  if (strValue === null) return null;

  const schema = schemas[key];

  const parseResult = schema.safeParse(JSON.parse(strValue));
  if (!parseResult.success) {
    console.error(`Failed to parse ${key} from storage:`, parseResult.error);
    return null;
  }

  return parseResult.data;
};

export const useStorage = <TKey extends Keys>(
  key: TKey,
): [
  StorageValue<TKey> | null,
  (newValue: StorageValue<TKey>) => Promise<void>,
] => {
  // @ts-expect-error TODO: fix this
  const storageAtom = (atoms[key] ??= atom(getStorageValue(key)));

  const [value, setValue] = useAtom(storageAtom);

  const set = useCallback(
    async (newValue: StorageValue<TKey>) => {
      const schema = schemas[key];
      const strValue = JSON.stringify(schema.parse(newValue));

      await SecureStore.setItemAsync(key, strValue);
      setValue(newValue);
    },
    [key, setValue],
  );

  return [value, set] as const;
};

export const setStorage = async <TKey extends Keys>(
  key: TKey,
  newValue: StorageValue<TKey>,
): Promise<void> => {
  // @ts-expect-error TODO: fix this
  atoms[key] ??= atom(newValue);

  getDefaultStore().set(atoms[key], newValue);

  const strValue = JSON.stringify(newValue);
  await SecureStore.setItemAsync(key, strValue);
};

export const getStorage = <TKey extends Keys>(
  key: TKey,
): StorageValue<TKey> | null => {
  // @ts-expect-error TODO: fix this
  const storageAtom = (atoms[key] ??= atom(getStorageValue(key)));

  return getDefaultStore().get(storageAtom);
};
