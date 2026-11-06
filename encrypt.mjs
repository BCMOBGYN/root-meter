#!/usr/bin/env node
// Encrypts a self-contained HTML page so it can sit on static hosting (GitHub
// Pages) behind a password. Uses only Node's built-in Web Crypto:
//   key   = PBKDF2-SHA256(password, random 16-byte salt, 600,000 iterations)
//   data  = AES-256-GCM(key, random 12-byte IV, page bytes)
// The page is decrypted in the visitor's browser by gate.html; the server and
// this repo only ever hold ciphertext. The password is trimmed and lowercased
// on both sides, so it is not case-sensitive.
//
// Usage:
//   node encrypt.mjs <plain.html> [--out index.html] [--env .env] [--verify]
// The password comes from ROOTMETER_PASSWORD in the environment or in the
// .env file next to this script (gitignored). --verify decrypts the result
// again and checks it byte for byte against the input.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const subtle = webcrypto.subtle;
const here = dirname(fileURLToPath(import.meta.url));
const ITERATIONS = 600000;

const argv = process.argv.slice(2);
const takes = new Set(["--out", "--env"]);
const opts = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (takes.has(a)) opts[a] = argv[++i];
  else if (a.startsWith("--")) opts[a] = true;
  else pos.push(a);
}
if (pos.length !== 1) {
  console.error("usage: node encrypt.mjs <plain.html> [--out index.html] [--env .env] [--verify]");
  process.exit(2);
}
const input = resolve(pos[0]);
const outPath = resolve(opts["--out"] || join(here, "index.html"));
const envPath = resolve(opts["--env"] || join(here, ".env"));

function readEnv(p) {
  const env = {};
  if (!existsSync(p)) return env;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return env;
}
const raw = process.env.ROOTMETER_PASSWORD || readEnv(envPath).ROOTMETER_PASSWORD;
if (!raw) {
  console.error(`No password: set ROOTMETER_PASSWORD in the environment or in ${envPath}`);
  process.exit(2);
}
const password = raw.trim().toLowerCase();

const b64 = (u8) => Buffer.from(u8).toString("base64");
const unb64 = (s) => new Uint8Array(Buffer.from(s, "base64"));

async function deriveKey(pw, salt, iterations) {
  const base = await subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, base,
                          { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

const plain = readFileSync(input);
const salt = webcrypto.getRandomValues(new Uint8Array(16));
const iv = webcrypto.getRandomValues(new Uint8Array(12));
const key = await deriveKey(password, salt, ITERATIONS);
const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
const payload = { v: 1, kdf: "PBKDF2-SHA256", iter: ITERATIONS, salt: b64(salt), iv: b64(iv), ct: b64(ct) };

const PH = "/*__PAYLOAD__*/";
const gate = readFileSync(join(here, "gate.html"), "utf8");
if (gate.split(PH).length !== 2) throw new Error("gate.html must contain the payload placeholder exactly once");
const out = gate.split(PH).join(JSON.stringify(payload));
writeFileSync(outPath, out);
console.log(`Wrote ${outPath} (${out.length.toLocaleString("en-US")} bytes; plaintext ${plain.length.toLocaleString("en-US")} bytes)`);

if (opts["--verify"]) {
  const m = readFileSync(outPath, "utf8").match(/<script id="payload" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error("verify: payload not found in output");
  const p = JSON.parse(m[1]);
  const k = await deriveKey(password, unb64(p.salt), p.iter);
  const back = Buffer.from(await subtle.decrypt({ name: "AES-GCM", iv: unb64(p.iv) }, k, unb64(p.ct)));
  if (!back.equals(plain)) throw new Error("verify: decrypted bytes differ from the input");
  let wrongRejected = false;
  try {
    const kw = await deriveKey(password + "x", unb64(p.salt), p.iter);
    await subtle.decrypt({ name: "AES-GCM", iv: unb64(p.iv) }, kw, unb64(p.ct));
  } catch { wrongRejected = true; }
  if (!wrongRejected) throw new Error("verify: a wrong password decrypted the page");
  console.log("Verified: the password decrypts to the exact input bytes and a wrong password is rejected.");
}
