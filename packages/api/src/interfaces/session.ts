export interface Session {
  user: {
    id: string;
    name: string;
    isSuperUser: boolean;
    isOfAge: boolean;
  } | null;
  token: string;
}
