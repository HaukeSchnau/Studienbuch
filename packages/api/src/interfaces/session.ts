export interface Session {
  user: {
    id: number;
    name: string;
    isSuperUser: boolean;
  } | null;
  token: string;
}
