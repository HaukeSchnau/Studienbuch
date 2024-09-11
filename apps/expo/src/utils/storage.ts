import type { ZodSchema } from "zod";
import { useCallback, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import { Store, useStore } from "@tanstack/react-store";
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

const store = new Store<
  Partial<{
    [K in Keys]: StorageValue<K> | null;
  }>
>({});

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
  const value = useStore(store, (state) => state[key]) as
    | StorageValue<TKey>
    | null
    | undefined;

  const set = useCallback(
    async (newValue: StorageValue<TKey>) => {
      const schema = schemas[key];
      const strValue = JSON.stringify(schema.parse(newValue));

      await SecureStore.setItemAsync(key, strValue);
      store.setState((state) => ({ ...state, [key]: newValue }));
    },
    [key],
  );

  const definedValue = value === undefined ? getStorageValue(key) : value;

  useEffect(() => {
    if (value === undefined) {
      store.setState((state) => ({ ...state, [key]: definedValue }));
    }
  }, [key, value, definedValue]);

  return [definedValue, set] as const;
};

export const setStorage = async <TKey extends Keys>(
  key: TKey,
  newValue: StorageValue<TKey>,
): Promise<void> => {
  store.setState(() => ({ [key]: newValue }));

  const strValue = JSON.stringify(newValue);
  await SecureStore.setItemAsync(key, strValue);
};

export const getStorage = <TKey extends Keys>(
  key: TKey,
): StorageValue<TKey> | null => {
  const val = store.state[key];
  if (val === undefined) {
    const newValue = getStorageValue(key);
    store.setState((state) => ({ ...state, [key]: newValue }));
    return newValue;
  }

  return val;
};
