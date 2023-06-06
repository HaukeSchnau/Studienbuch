import { expect, test } from "vitest";

import { guessSubject } from "../src";

test("guessSubject", () => {
  expect(guessSubject("de")).toBe("Deutsch");
  expect(guessSubject("Deutsch")).toBe("Deutsch");
  expect(guessSubject("de1")).toBe("Deutsch");

  expect(guessSubject("ds")).toBe("Darstellendes Spiel");
  expect(guessSubject("DS")).toBe("Darstellendes Spiel");
  expect(guessSubject("ds1")).toBe("Darstellendes Spiel");

  expect(guessSubject("sn")).toBe("Spanisch");
  expect(guessSubject("SN")).toBe("Spanisch");
  expect(guessSubject("sn1")).toBe("Spanisch");

  expect(guessSubject("pw")).toBe("Politik-Wirtschaft");
  expect(guessSubject("PW")).toBe("Politik-Wirtschaft");
  expect(guessSubject("pw1")).toBe("Politik-Wirtschaft");

  expect(guessSubject("if")).toBe("Informatik");
  expect(guessSubject("IF")).toBe("Informatik");
  expect(guessSubject("if1")).toBe("Informatik");

  expect(guessSubject("sf")).toBe("Seminarfach");
  expect(guessSubject("SF")).toBe("Seminarfach");
  expect(guessSubject("sf1")).toBe("Seminarfach");

  expect(guessSubject("")).toBe("");
  expect(guessSubject(null)).toBe("");
  expect(guessSubject(undefined)).toBe("");
  expect(guessSubject(" ")).toBe("");

  expect(guessSubject("wn")).toBe("Werte und Normen");
  expect(guessSubject("wn1")).toBe("Werte und Normen");
  expect(guessSubject("wun")).toBe("Werte und Normen");
  expect(guessSubject("wun1")).toBe("Werte und Normen");
  expect(guessSubject("Werte und Normen")).toBe("Werte und Normen");
});
