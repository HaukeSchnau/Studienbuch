import { expect, test } from "vitest";

import { guessSubject } from "./subject";

test("guessSubject", () => {
  expect(guessSubject("deutsch")).toBe("de");
  expect(guessSubject("mathe")).toBe("ma");
  expect(guessSubject("englisch")).toBe("en");
  expect(guessSubject("physik")).toBe("ph");
  expect(guessSubject("chemie")).toBe("ch");
  expect(guessSubject("biologie")).toBe("bi");
  expect(guessSubject("informatik")).toBe("if");
  expect(guessSubject("geschichte")).toBe("ge");

  expect(guessSubject("politik-wirtschaft")).toBe("pw");
  expect(guessSubject("darstellendes spiel")).toBe("ds");

  expect(guessSubject("musik")).toBe("mu");
  expect(guessSubject("sport")).toBe("sp");
  expect(guessSubject("kunst")).toBe("ku");
  expect(guessSubject("religion")).toBe("re");

  expect(guessSubject("werte und normen")).toBe("wn");

  expect(guessSubject("französisch")).toBe("fr");
  expect(guessSubject("latein")).toBe("la");
});
