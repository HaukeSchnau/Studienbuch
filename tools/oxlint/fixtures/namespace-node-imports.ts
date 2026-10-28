// oxlint-disable-next-line studienbuch/namespace-node-imports -- fixture: a named import
import { join } from "node:path";
// oxlint-disable-next-line studienbuch/namespace-node-imports -- fixture: a namespace with another name
import * as fs from "node:fs";
import * as NodeChildProcess from "node:child_process";
import * as NodeFSP from "node:fs/promises";

export const used = [join, fs, NodeChildProcess, NodeFSP];
