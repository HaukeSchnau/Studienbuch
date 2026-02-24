"use client";

import type {
  Class,
  Permission,
  PermissionOnUser,
  Salutation,
  School,
  SchoolId,
  ScopeOption,
  Theme,
  Year,
} from "@stu/lib";
import { defaultTheme } from "@stu/lib";
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";

import type { LoginInput, LoginResult, WebSessionUser } from "~/server/auth";
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

type SessionData = { user: WebSessionUser } | null;
type YearsInput = { school?: SchoolId; activeOnly?: boolean };
type YearIdInput = { school: SchoolId; startYear: number };
type ClassesByYearInput = YearIdInput;
type SchoolThemeData = { theme: Theme; image?: string };

type ListedUser = {
  id: string;
  email: string | null;
  hasPassword: boolean;
  roles: Array<{ id: string; name: string }>;
  isSuperUser: boolean;
  permissions: PermissionOnUser[];
  person: {
    id: string;
    firstName: string;
    lastName: string;
    abbrv: string | null;
    salutation: Salutation | null;
  };
};

type AddUserInput = {
  firstName: string;
  lastName: string;
  email?: string;
  password?: string;
  salutation?: Salutation;
  abbrv?: string;
};

type ListedPerson = {
  id: string;
  name: string;
  email: string | null;
  abbrv: string | null;
  salutation: Salutation | null;
};

type AddPersonInput =
  | {
      name: string;
      email?: string;
      salutation?: Salutation;
      abbrv?: string;
    }
  | {
      firstName: string;
      lastName: string;
      email?: string;
      salutation?: Salutation;
      abbrv?: string;
    };

type UpdateManyPersonsInput = Array<{ id: string } & Partial<Omit<ListedPerson, "id">>>;

type SetUserPermissionsInput = {
  userId: string;
  isSuperUser: boolean;
  permissions: PermissionOnUser[];
};

type UserScopeOptionResult = Array<{ name: string } & Record<string, unknown>>;

type SetSchoolThemeInput = {
  school: SchoolId;
  image?: string;
  theme: Theme;
};

type AddYearInput = Year;
type UpdateYearInput = Partial<Year> & Pick<Year, "school" | "startYear">;

const queryKeys = {
  auth: {
    session: ["auth", "session"] as const,
    permission: (permission: Permission) => ["auth", "permission", permission] as const,
  },
  schools: {
    list: ["schools", "list"] as const,
    theme: (school: SchoolId) => ["schools", "theme", school] as const,
    years: (input: YearsInput) => ["schools", "years", input] as const,
    year: (input: YearIdInput) => ["schools", "year", input.school, input.startYear] as const,
    classes: (input: ClassesByYearInput) => ["schools", "classes", input.school, input.startYear] as const,
  },
  management: {
    users: ["management", "users"] as const,
    persons: ["management", "persons"] as const,
    userScopeOptions: (option: ScopeOption) => ["management", "users", "scope-options", option] as const,
  },
};

const useQueryWithOptionalInput = <TInput, TData>(
  input: TInput | typeof skipToken,
  keyFor: (input: TInput) => readonly unknown[],
  queryFn: (input: TInput) => Promise<TData>,
): UseQueryResult<TData, Error> => {
  if (input === skipToken) {
    return useQuery<TData, Error>({
      queryKey: ["skip-token"],
      queryFn: skipToken,
    });
  }

  return useQuery<TData, Error>({
    queryKey: keyFor(input),
    queryFn: () => queryFn(input),
  });
};

export const api = {
  auth: {
    getSession: {
      useQuery: () => {
        const getSession = useServerFn(getSessionFn);
        return useQuery<SessionData>({
          queryKey: queryKeys.auth.session,
          queryFn: async () => (await getSession()) as SessionData,
        });
      },
    },
    login: {
      useMutation: (options?: MutationOptions<LoginResult, LoginInput>) => {
        const login = useServerFn(loginFn);
        return useMutation({
          mutationFn: async (input: LoginInput) => (await login({ data: input })) as LoginResult,
          ...options,
        });
      },
    },
    logout: {
      useMutation: (options?: MutationOptions<{ ok: true }, void>) => {
        const logout = useServerFn(logoutFn);
        return useMutation({
          mutationFn: async () => (await logout()) as { ok: true },
          ...options,
        });
      },
    },
    hasPermission: {
      useQuery: (permission: Permission | typeof skipToken) => {
        const hasPermission = useServerFn(hasPermissionFn);
        return useQueryWithOptionalInput(
          permission,
          (value) => queryKeys.auth.permission(value),
          async (value) => (await hasPermission({ data: { permission: value } })) as boolean,
        );
      },
    },
  },
  schools: {
    list: {
      useQuery: () => {
        const listSchools = useServerFn(listSchoolsFn);
        return useQuery<School[]>({
          queryKey: queryKeys.schools.list,
          queryFn: async () => (await listSchools()) as School[],
        });
      },
    },
    getTheme: {
      useQuery: (school: SchoolId | typeof skipToken) => {
        const getTheme = useServerFn(getSchoolThemeFn);
        return useQueryWithOptionalInput(
          school,
          (value) => queryKeys.schools.theme(value),
          async (value) => {
            const result = (await getTheme({ data: value })) as
              | {
                  theme: Theme;
                  image?: string | null;
                }
              | null;

            if (!result) {
              return { theme: defaultTheme };
            }

            return {
              theme: result.theme,
              image: result.image ?? undefined,
            };
          },
        );
      },
    },
    years: {
      list: {
        useQuery: (input: YearsInput) => {
          const listYears = useServerFn(listYearsFn);
          return useQuery<Year[]>({
            queryKey: queryKeys.schools.years(input),
            queryFn: async () => (await listYears({ data: input })) as Year[],
          });
        },
      },
      getOne: {
        useQuery: (input: YearIdInput | typeof skipToken) => {
          const getOneYear = useServerFn(getOneYearFn);
          return useQueryWithOptionalInput(
            input,
            (value) => queryKeys.schools.year(value),
            async (value) => (await getOneYear({ data: value })) as Year,
          );
        },
      },
    },
    classes: {
      list: {
        useQuery: (input: ClassesByYearInput | undefined) => {
          const listClasses = useServerFn(listClassesByYearFn);
          return useQueryWithOptionalInput(
            input ?? skipToken,
            (value) => queryKeys.schools.classes(value),
            async (value) => (await listClasses({ data: value })) as Class[],
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
          return useQuery<ListedUser[]>({
            queryKey: queryKeys.management.users,
            queryFn: async () => (await listUsers()) as ListedUser[],
          });
        },
      },
      add: {
        useMutation: (options?: MutationOptions<unknown, AddUserInput>) => {
          const addUser = useServerFn(addUserFn);
          return useMutation({
            mutationFn: async (input: AddUserInput) => addUser({ data: input }),
            ...options,
          });
        },
      },
      delete: {
        useMutation: (options?: MutationOptions<void, string>) => {
          const deleteUser = useServerFn(deleteUserFn);
          return useMutation({
            mutationFn: async (input: string) => {
              await deleteUser({ data: input });
            },
            ...options,
          });
        },
      },
      updatePassword: {
        useMutation: (options?: MutationOptions<void, { id: string; password: string }>) => {
          const updatePassword = useServerFn(updateUserPasswordFn);
          return useMutation({
            mutationFn: async (input: { id: string; password: string }) => {
              await updatePassword({ data: input });
            },
            ...options,
          });
        },
      },
      setPermissions: {
        useMutation: (options?: MutationOptions<void, SetUserPermissionsInput>) => {
          const setPermissions = useServerFn(setUserPermissionsFn);
          return useMutation({
            mutationFn: async (input: SetUserPermissionsInput) => {
              await setPermissions({ data: input });
            },
            ...options,
          });
        },
      },
      listScopeOptions: {
        useQuery: (option: ScopeOption | typeof skipToken) => {
          const listScopeOptions = useServerFn(listUserScopeOptionsFn);
          return useQueryWithOptionalInput(
            option,
            (value) => queryKeys.management.userScopeOptions(value),
            async (value) => (await listScopeOptions({ data: value })) as UserScopeOptionResult,
          );
        },
      },
    },
    persons: {
      list: {
        useQuery: () => {
          const listPersons = useServerFn(listPersonsFn);
          return useQuery<ListedPerson[]>({
            queryKey: queryKeys.management.persons,
            queryFn: async () => (await listPersons()) as ListedPerson[],
          });
        },
      },
      add: {
        useMutation: (options?: MutationOptions<unknown, AddPersonInput>) => {
          const addPerson = useServerFn(addPersonFn);
          return useMutation({
            mutationFn: async (input: AddPersonInput) => addPerson({ data: input }),
            ...options,
          });
        },
      },
      delete: {
        useMutation: (options?: MutationOptions<void, string>) => {
          const deletePerson = useServerFn(deletePersonFn);
          return useMutation({
            mutationFn: async (input: string) => {
              await deletePerson({ data: input });
            },
            ...options,
          });
        },
      },
      updateMany: {
        useMutation: (options?: MutationOptions<void, UpdateManyPersonsInput>) => {
          const updateManyPersons = useServerFn(updateManyPersonsFn);
          return useMutation({
            mutationFn: async (input: UpdateManyPersonsInput) => {
              await updateManyPersons({ data: input });
            },
            ...options,
          });
        },
      },
    },
    schools: {
      setTheme: {
        useMutation: (options?: MutationOptions<unknown, SetSchoolThemeInput>) => {
          const setTheme = useServerFn(setSchoolThemeFn);
          return useMutation({
            mutationFn: async (input: SetSchoolThemeInput) => setTheme({ data: input }),
            ...options,
          });
        },
      },
    },
    years: {
      add: {
        useMutation: (options?: MutationOptions<unknown, AddYearInput>) => {
          const addYear = useServerFn(addYearFn);
          return useMutation({
            mutationFn: async (input: AddYearInput) => addYear({ data: input }),
            ...options,
          });
        },
      },
      update: {
        useMutation: (options?: MutationOptions<unknown, UpdateYearInput>) => {
          const updateYear = useServerFn(updateYearFn);
          return useMutation({
            mutationFn: async (input: UpdateYearInput) => updateYear({ data: input }),
            ...options,
          });
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
