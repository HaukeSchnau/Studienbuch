export const capitalize = (str?: string | null) => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const snakeToCamel = (str: string) =>
  str
    .toLowerCase()
    .replace(/([-_][a-z])/g, (group) =>
      group.toUpperCase().replace("-", "").replace("_", ""),
    );
