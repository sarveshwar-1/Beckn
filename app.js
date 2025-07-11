const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Generate Ed25519 key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" }
});

// Save private key to PEM file
fs.writeFileSync(path.join(__dirname, "keys", "private_key.pem"), privateKey, "utf8");

// Save public key to PEM file (optional)
fs.writeFileSync(path.join(__dirname, "keys", "public_key.pem"), publicKey, "utf8");

// --- Extract raw 32-byte public key (from SPKI format) ---
const spkiDer = crypto.createPublicKey(publicKey).export({ format: "der", type: "spki" });

// The Ed25519 public key is always the **last 32 bytes** of the SPKI DER
const rawPublicKey = spkiDer.slice(-32); // Buffer of 32 bytes
const rawPublicKeyBase64 = rawPublicKey.toString("base64");

// Save base64 version (like: mPC/GhP6hv9XF2nIZAI77GD0MmZkC5XI8o+oifkpsgE=)
fs.writeFileSync(path.join(__dirname, "keys", "public_key.b64"), rawPublicKeyBase64, "utf8");

console.log("✅ Ed25519 key pair generated.");
console.log("🔑 Public key (base64):", rawPublicKeyBase64);
