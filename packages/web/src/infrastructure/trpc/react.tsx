"use client";

import type { Permission } from "@stu/lib";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  skipToken,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";

import {
  addPersonFn,
  addUserFn,
  addYearFn,
  deletePersonFn,
  deleteUserFn,
  getOneYearFn,
  getSchoolThemeFn,
  getSessionFn,
  hasPermissionFn,
  listClassesByYearFn,
  listPersonsFn,
  listSchoolsFn,
  listUserScopeOptionsFn,
  listUsersFn,
  listYearsFn,
  loginFn,
  logoutFn,
  setSchoolThemeFn,
  setUserPermissionsFn,
  updateManyPersonsFn,
  updateUserPasswordFn,
  updateYearFn,
} from "~/server/functions";

type MutationOptions<TData, TVariables> = Omit<
  UseMutationOptions<TData, Error, TVariables, unknown>,
  "mutationFn"
>;

const queryKeys = {
  auth: {
    session: ["auth", "session"] as const,
    permission: (permission: Permission) => ["auth", "permission", permission] as const,
  },
  schools: {
    list: ["schools", "list"] as const,
    theme: (school: string) => ["schools", "theme", school] as const,
    years: (input: unknown) => ["schools", "years", input] as const,
    year: (input: { school: string; startYear: number }) => ["schools", "year", input.school, input.startYear] as const,
    classes: (input: { school: string; startYear: number }) =>
      ["schools", "classes", input.school, input.startYear] as const,
  },
  management: {
    users: ["management", "users"] as const,
    persons: ["management", "persons"] as const,
    userScopeOptions: (option: string) => ["management", "users", "scope-options", option] as const,
  },
};

const useQueryWithOptionalInput = <TInput, TData>(
  input: TInput | typeof skipToken,
  keyFor: (input: TInput) => readonly unknown[],
  queryFn: (input: TInput) => Promise<TData>,
) => {
  if (input === skipToken) {
    return useQuery<TData>({
      queryKey: ["skip-token"],
      queryFn: skipToken,
    });
  }

  return useQuery<TData>({
    queryKey: keyFor(input),
    queryFn: () => queryFn(input),
  });
};

const useMutationWithServerFn = <TInput, TData>(
  fn: (input: TInput) => Promise<TData>,
  options?: MutationOptions<TData, TInput>,
) => {
  return useMutation<TData, Error, TInput>({
    mutationFn: fn,
    ...options,
  });
};

export const api = {
  auth: {
    getSession: {
      useQuery: () => {
        const getSession = useServerFn(getSessionFn);
        return useQuery({
          queryKey: queryKeys.auth.session,
          queryFn: () => getSession(),
        });
      },
    },
    login: {
      useMutation: (options?: MutationOptions<Awaited<ReturnType<ReturnType<typeof useServerFn<typeof loginFn>>>, { email: string; password: string }>) => {
        const login = useServerFn(loginFn);
        return useMutationWithServerFn((input: { email: string; password: string }) => login({ data: input }), options as any);
      },
    },
    logout: {
      useMutation: (options?: MutationOptions<Awaited<ReturnType<ReturnType<typeof useServerFn<typeof logoutFn>>>, void>) => {
        const logout = useServerFn(logoutFn);
        return useMutationWithServerFn(() => logout(), options as any);
      },
    },
    hasPermission: {
      useQuery: (permission: Permission | typeof skipToken) => {
        const hasPermission = useServerFn(hasPermissionFn);
        return useQueryWithOptionalInput(
          permission,
          (p) => queryKeys.auth.permission(p),
          (p) => hasPermission({ data: { permission: p } }),
        );
      },
    },
  },
  schools: {
    list: {
      useQuery: () => {
        const listSchools = useServerFn(listSchoolsFn);
        return useQuery({
          queryKey: queryKeys.schools.list,
          queryFn: () => listSchools(),
        });
      },
    },
    getTheme: {
      useQuery: (school: string | typeof skipToken) => {
        const getTheme = useServerFn(getSchoolThemeFn);
        return useQueryWithOptionalInput(
          school,
          (value) => queryKeys.schools.theme(value),
          (value) => getTheme({ data: value }),
        );
      },
    },
    years: {
      list: {
        useQuery: (input: { school?: string; activeOnly?: boolean }) => {
          const listYears = useServerFn(listYearsFn);
          return useQuery({
            queryKey: queryKeys.schools.years(input),
            queryFn: () => listYears({ data: input }),
          });
        },
      },
      getOne: {
        useQuery: (input: { school: string; startYear: number } | typeof skipToken) => {
          const getOneYear = useServerFn(getOneYearFn);
          return useQueryWithOptionalInput(
            input,
            (value) => queryKeys.schools.year(value),
            (value) => getOneYear({ data: value }),
          );
        },
      },
    },
    classes: {
      list: {
        useQuery: (input: { school: string; startYear: number } | undefined) => {
          const listClasses = useServerFn(listClassesByYearFn);
          return useQueryWithOptionalInput(
            input ? input : skipToken,
            (value) => queryKeys.schools.classes(value),
            (value) => listClasses({ data: value }),
          );
        },
      },
    },
  },
  management: {
    users: {
      list: {
        useQuery: () => {
          const listUsers = useServerFn(listUsersFn);
          return useQuery({
            queryKey: queryKeys.management.users,
            queryFn: () => listUsers(),
          });
        },
      },
      add: {
        useMutation: (options?: MutationOptions<any, any>) => {
          const addUser = useServerFn(addUserFn);
          return useMutationWithServerFn((input: any) => addUser({ data: input }), options);
        },
      },
      delete: {
        useMutation: (options?: MutationOptions<any, string>) => {
          const deleteUser = useServerFn(deleteUserFn);
          return useMutationWithServerFn((input: string) => deleteUser({ data: input }), options);
        },
      },
      updatePassword: {
        useMutation: (options?: MutationOptions<any, { id: string; password: string }>) => {
          const updatePassword = useServerFn(updateUserPasswordFn);
          return useMutationWithServerFn((input) => updatePassword({ data: input }), options);
        },
      },
      setPermissions: {
        useMutation: (options?: MutationOptions<any, any>) => {
          const setPermissions = useServerFn(setUserPermissionsFn);
          return useMutationWithServerFn((input: any) => setPermissions({ data: input }), options);
        },
      },
      listScopeOptions: {
        useQuery: (option: string | typeof skipToken) => {
          const listScopeOptions = useServerFn(listUserScopeOptionsFn);
          return useQueryWithOptionalInput(
            option,
            (value) => queryKeys.management.userScopeOptions(value),
            (value) => listScopeOptions({ data: value as any }),
          );
        },
      },
    },
    persons: {
      list: {
        useQuery: () => {
          const listPersons = useServerFn(listPersonsFn);
          return useQuery({
            queryKey: queryKeys.management.persons,
            queryFn: () => listPersons(),
          });
        },
      },
      add: {
        useMutation: (options?: MutationOptions<any, any>) => {
          const addPerson = useServerFn(addPersonFn);
          return useMutationWithServerFn((input: any) => addPerson({ data: input }), options);
        },
      },
      delete: {
        useMutation: (options?: MutationOptions<any, string>) => {
          const deletePerson = useServerFn(deletePersonFn);
          return useMutationWithServerFn((input: string) => deletePerson({ data: input }), options);
        },
      },
      updateMany: {
        useMutation: (options?: MutationOptions<any, any[]>) => {
          const updateManyPersons = useServerFn(updateManyPersonsFn);
          return useMutationWithServerFn((input: any[]) => updateManyPersons({ data: input }), options);
        },
      },
    },
    schools: {
      setTheme: {
        useMutation: (options?: MutationOptions<any, any>) => {
          const setTheme = useServerFn(setSchoolThemeFn);
          return useMutationWithServerFn((input: any) => setTheme({ data: input }), options);
        },
      },
    },
    years: {
      add: {
        useMutation: (options?: MutationOptions<any, any>) => {
          const addYear = useServerFn(addYearFn);
          return useMutationWithServerFn((input: any) => addYear({ data: input }), options);
        },
      },
      update: {
        useMutation: (options?: MutationOptions<any, any>) => {
          const updateYear = useServerFn(updateYearFn);
          return useMutationWithServerFn((input: any) => updateYear({ data: input }), options);
        },
      },
    },
  },
  useUtils: () => {
    const queryClient = useQueryClient();
    return {
      schools: {
        list: {
          invalidate: () => queryClient.invalidateQueries({ queryKey: queryKeys.schools.list }),
        },
        years: {
          list: {
            invalidate: () => queryClient.invalidateQueries({ queryKey: ["schools", "years"] }),
          },
        },
        getTheme: {
          invalidate: () => queryClient.invalidateQueries({ queryKey: ["schools", "theme"] }),
        },
      },
      management: {
        users: {
          list: {
            invalidate: () => queryClient.invalidateQueries({ queryKey: queryKeys.management.users }),
          },
        },
        persons: {
          list: {
            invalidate: () => queryClient.invalidateQueries({ queryKey: queryKeys.management.persons }),
          },
        },
      },
      auth: {
        getSession: {
          invalidate: () => queryClient.invalidateQueries({ queryKey: queryKeys.auth.session }),
        },
      },
    };
  },
};

export function TRPCReactProvider(props: { children: ReactNode }) {
  return <>{props.children}</>;
}
