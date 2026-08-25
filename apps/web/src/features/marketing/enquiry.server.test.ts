import { describe, expect, it } from "vitest";
import { handleEnquiry } from "./enquiry.server.ts";

const valid = {
  schoolName: "IGS Musterstadt",
  contactName: "Erika Mustermann",
  email: "erika@igs-musterstadt.de",
  message: "Wir würden Studienbuch gern an unserer Schule einführen.",
};

/** Old enough to clear the fill-time check. */
const longEnough = () => Date.now() - 30_000;

const post = (body: unknown, contentType = "application/json") =>
  handleEnquiry(
    new Request("https://studienbuch.test/api/enquiry", {
      method: "POST",
      headers: { "content-type": contentType },
      body: JSON.stringify(body),
    }),
  );

/**
 * These cover everything the endpoint decides before it reaches the database, which is every
 * rejection path. Recording itself needs PostgreSQL and belongs in an integration test.
 */
describe("handleEnquiry", () => {
  it("rejects a body that is not JSON", async () => {
    const response = await post(valid, "text/plain");
    expect(response.status).toBe(422);
  });

  it("rejects a submission with missing fields", async () => {
    const response = await post({ startedAt: longEnough() });
    expect(response.status).toBe(422);
  });

  it("rejects a message below the minimum length", async () => {
    const response = await post({ ...valid, message: "zu kurz", startedAt: longEnough() });
    expect(response.status).toBe(422);
  });

  it("rejects an address that is not an e-mail", async () => {
    const response = await post({ ...valid, email: "erika-at-schule", startedAt: longEnough() });
    expect(response.status).toBe(422);
  });

  it("accepts a filled honeypot without storing it, and says nothing about why", async () => {
    const response = await post({ ...valid, startedAt: longEnough(), trap: "https://spam" });
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ status: "accepted" });
  });

  it("accepts a submission that arrives too quickly without storing it", async () => {
    const response = await post({ ...valid, startedAt: Date.now() });
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ status: "accepted" });
  });

  it("treats a whitespace-only honeypot as untouched", async () => {
    // Reaching the recorder means the screening let it through, which is what is under test; the
    // absent database is what fails it, so this must not be a 202.
    const response = await post({ ...valid, startedAt: longEnough(), trap: "   " });
    expect(response.status).not.toBe(202);
  });
});
