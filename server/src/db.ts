import { MongoClient, ObjectId, type Collection, type Db } from "mongodb";
import dns from "node:dns";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Question } from "./scoring.js";
import "./tlsSetup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, "..", ".env"));
loadEnvFile(path.join(__dirname, "..", "..", ".env"));

export type UserRole = "user" | "admin";

export interface UserDoc {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

export interface TestDoc {
  _id: string;
  title: string;
  titleKz: string;
  section: string;
  examType: string;
  subject: string;
  durationMinutes: number;
  questionCount: number;
  isFree: boolean;
  priceTenge: number | null;
  description: string;
  questions: Question[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AttemptDoc {
  _id: ObjectId;
  userId: ObjectId;
  testId: string;
  answers: Record<string, unknown>;
  score: number;
  maxScore: number;
  startedAt: Date;
  finishedAt: Date;
}

let client: MongoClient | null = null;
let database: Db | null = null;

export function toObjectId(id: string): ObjectId | null {
  try {
    if (!ObjectId.isValid(id)) return null;
    const oid = new ObjectId(id);
    return oid.toHexString() === id ? oid : null;
  } catch {
    return null;
  }
}

function mongoHost(uri: string): string {
  try {
    return new URL(uri.replace(/^mongodb\+srv/, "https")).host;
  } catch {
    return "(unparsed)";
  }
}

export async function connectDb(): Promise<Db> {
  if (database) return database;

  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI не задан. Добавьте его в server/.env или в переменные Railway.");
  }

  console.log(
    `Mongo connecting host=${mongoHost(uri)} node=${process.version} openssl=${process.versions.openssl} ipv4`,
  );

  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 20_000,
    connectTimeoutMS: 20_000,
    family: 4,
    autoSelectFamily: false,
    lookup(hostname, _options, callback) {
      dns.lookup(hostname, { family: 4, all: false }, callback);
    },
  });
  try {
    await client.connect();
  } catch (err) {
    await client.close().catch(() => undefined);
    client = null;
    throw err;
  }
  database = client.db("prob");

  await database.collection<UserDoc>("users").createIndex({ email: 1 }, { unique: true });
  await database.collection<AttemptDoc>("attempts").createIndex({ userId: 1 });
  await database.collection<AttemptDoc>("attempts").createIndex({ testId: 1 });
  await database.collection<AttemptDoc>("attempts").createIndex({ finishedAt: -1 });

  console.log("MongoDB connected: db=prob");
  return database;
}

export function isDbReady(): boolean {
  return database !== null;
}

function requireDb(): Db {
  if (!database) {
    throw new Error("MongoDB ещё не подключена. Вызовите connectDb() при старте.");
  }
  return database;
}

export function users(): Collection<UserDoc> {
  return requireDb().collection<UserDoc>("users");
}

export function tests(): Collection<TestDoc> {
  return requireDb().collection<TestDoc>("tests");
}

export function attempts(): Collection<AttemptDoc> {
  return requireDb().collection<AttemptDoc>("attempts");
}

export function publicUser(doc: UserDoc) {
  return {
    id: doc._id.toHexString(),
    email: doc.email,
    name: doc.name,
    role: doc.role,
  };
}

export async function closeDb(): Promise<void> {
  await client?.close();
  client = null;
  database = null;
}
