import type { Salutation } from "./teacher";

interface NameParts {
  salutation?: Salutation | null;
  firstName?: string | null;
  lastName?: string | null;
}

interface NameString {
  name?: string | null;
}

type FormalNameInput = NameParts & NameString;

export const formalName = (person: FormalNameInput) => {
  const name = person.name?.trim();
  if (name) {
    return name;
  }

  const firstName = person.firstName?.trim();
  const lastName = person.lastName?.trim();
  if (!firstName || !lastName) {
    return "";
  }

  if (!person.salutation) {
    return `${firstName} ${lastName}`;
  }

  return `${person.salutation} ${lastName}`;
};
