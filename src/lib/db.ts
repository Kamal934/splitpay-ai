import "server-only";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import type { Group } from "./types";

/**
 * Tiny JSON-file store. Good enough for a hackathon demo; swap for Postgres later.
 * Writes are serialized through a promise chain so concurrent requests don't clobber each other.
 */
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

type DB = { groups: Group[] };

let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<DB> {
  try {
    return JSON.parse(await fs.readFile(DB_FILE, "utf8")) as DB;
  } catch {
    return { groups: [] };
  }
}

async function save(db: DB) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(db, null, 2));
  await fs.rename(tmp, DB_FILE);
}

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export const newId = (prefix: string) => `${prefix}_${crypto.randomBytes(5).toString("hex")}`;

export async function listGroups(): Promise<Group[]> {
  return (await load()).groups;
}

export async function getGroup(id: string): Promise<Group | undefined> {
  return (await load()).groups.find((g) => g.id === id);
}

export async function createGroup(group: Group): Promise<Group> {
  return withLock(async () => {
    const db = await load();
    db.groups.unshift(group);
    await save(db);
    return group;
  });
}

/** Read-modify-write a group atomically. */
export async function updateGroup(id: string, mutate: (g: Group) => void | Promise<void>): Promise<Group> {
  return withLock(async () => {
    const db = await load();
    const group = db.groups.find((g) => g.id === id);
    if (!group) throw new Error(`Group ${id} not found`);
    await mutate(group);
    await save(db);
    return group;
  });
}
