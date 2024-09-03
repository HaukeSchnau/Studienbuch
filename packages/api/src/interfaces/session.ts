export interface Session {
  user: {
    id: string;
    name: string;
    isSuperUser: boolean;
  } | null;
  token: string;
}
