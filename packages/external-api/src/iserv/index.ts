import type { MakeRequest } from "./auth";
import { loginIservWithDefaultCredentials } from "./auth";
import { findAbbrvName } from "./findAbbrvName";

export class IservClient {
  private makeIservRequest: MakeRequest | null = null;

  public async findAbbrv(abbrv: string) {
    this.makeIservRequest ??= await loginIservWithDefaultCredentials();
    return findAbbrvName(this.makeIservRequest, abbrv);
  }
}
