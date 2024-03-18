export type ScopeOption = "schools" | "years" | "classes" | "courses";
export type PermissionScope = Partial<Record<ScopeOption, number[]>>;
