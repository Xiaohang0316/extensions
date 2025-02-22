import { environment } from "@raycast/api";
import { execa, ExecaChildProcess } from "execa";
import { existsSync } from "fs";
import { dirname } from "path/posix";
import { Item, PasswordGeneratorOptions, VaultState } from "./types";
import { getPasswordGeneratingArgs } from "./utils";

export class Bitwarden {
  private env: Record<string, string>;
  cliPath: string;
  constructor(clientId: string, clientSecret: string, cliPath: string) {
    if (!cliPath) {
      cliPath = process.arch == "arm64" ? "/opt/homebrew/bin/bw" : "/usr/local/bin/bw";
    }
    if (!existsSync(cliPath)) {
      throw new Error(`Bitwarden CLI not found at ${cliPath}`);
    }
    this.cliPath = cliPath;
    this.env = {
      BITWARDENCLI_APPDATA_DIR: environment.supportPath,
      BW_CLIENTSECRET: clientSecret.trim(),
      BW_CLIENTID: clientId.trim(),
      PATH: dirname(process.execPath),
    };
  }

  async sync(sessionToken: string): Promise<void> {
    await this.exec(["sync", "--session", sessionToken]);
  }

  async login(): Promise<void> {
    await this.exec(["login", "--apikey"]);
  }

  async logout(): Promise<void> {
    await this.exec(["logout"]);
  }

  async listItems(sessionToken: string): Promise<Item[]> {
    const { stdout } = await this.exec(["list", "items", "--session", sessionToken]);
    const items = JSON.parse(stdout);
    // Filter out items without a name property (they are not displayed in the bitwarden app)
    return items.filter((item: Item) => !!item.name);
  }

  async getTotp(id: string, sessionToken: string): Promise<string> {
    // this could return something like "Not found." but checks for totp code are done before calling this function
    const { stdout } = await this.exec(["get", "totp", "--session", sessionToken, id]);
    return stdout;
  }

  async unlock(password: string): Promise<string> {
    const { stdout: sessionToken } = await this.exec(["unlock", password, "--raw"]);
    return sessionToken;
  }

  async lock(): Promise<void> {
    await this.exec(["lock"]);
  }

  async status(): Promise<VaultState> {
    const { stdout } = await this.exec(["status"]);
    return JSON.parse(stdout);
  }

  async generatePassword(options?: PasswordGeneratorOptions, abortController?: AbortController): Promise<string> {
    const args = options ? getPasswordGeneratingArgs(options) : [];
    const { stdout } = await this.exec(["generate", ...args], abortController);
    return stdout;
  }

  private async exec(args: string[], abortController?: AbortController): Promise<ExecaChildProcess> {
    return execa(this.cliPath, args, { env: this.env, input: "", signal: abortController?.signal });
  }
}
