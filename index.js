// app.js
const express = require("express");
const morgan  = require("morgan");
const axios   = require("axios");
const { v4: uuid } = require("uuid");
const fs      = require("fs");
const path    = require("path");
const crypto  = require("crypto");

const app = express();
app.use(express.json());
app.use(morgan("dev"));

// 🔐 Load your Ed25519 private key (PKCS#8 PEM)
let PRIVATE_KEY;
try {
  const privateKeyPath = path.join(__dirname, "keys", "private_key.pem");
  if (!fs.existsSync(privateKeyPath)) {
    throw new Error("Private key file not found. Please run 'node generate-keys.js' first.");
  }
  
  PRIVATE_KEY = crypto.createPrivateKey({
    key:    fs.readFileSync(privateKeyPath),
    format: "pem",
    type:   "pkcs8"
  });
  
  console.log("✅ Ed25519 private key loaded successfully");
  
  // Load and display public key for verification
  const publicKeyPath = path.join(__dirname, "keys", "public_key.b64");
  if (fs.existsSync(publicKeyPath)) {
    const publicKeyB64 = fs.readFileSync(publicKeyPath, 'utf8').trim();
    console.log("📋 Public Key (for registration):", publicKeyB64);
  }
} catch (error) {
  console.error("❌ Failed to load private key:", error.message);
  process.exit(1);
}

/**
 * Create Digest + HTTP‑Signature headers for Beckn requests.
 *
 * @param {object} payload      Any JSON‑serializable payload.
 * @param {string} subscriberId Your registered BAP ID (used as keyId in the header).
 * @returns {{ digest: string, authorization: string }}
 */
function createBecknSignatureHeaders(payload, subscriberId) {
  try {
    // 1) Serialize the payload to JSON (consistent ordering)
    const jsonPayload = JSON.stringify(payload);
    console.log("🔍 Payload to sign:", jsonPayload);
    
    // 2) Compute SHA‑256 over the JSON body
    const bodyBuffer = Buffer.from(jsonPayload, "utf8");
    const hashBuf    = crypto.createHash("sha256").update(bodyBuffer).digest();
    const digest     = `SHA-256=${hashBuf.toString("base64")}`;
    console.log("🔍 Digest:", digest);

    // 3) Build the signing string (only headers you include here must be in the HTTP Signature)
    const signingString = `digest: ${digest}`;
    console.log("🔍 Signing string:", signingString);

    // 4) Sign with Ed25519
    const signatureBase64 = crypto
      .sign(null, Buffer.from(signingString, "utf8"), PRIVATE_KEY)
      .toString("base64");
    console.log("🔍 Signature (base64):", signatureBase64);

    // 5) Format the HTTP Signature header (correct Beckn format)
    const authorization = [
      `Signature keyId="${subscriberId}"`,
      `algorithm="ed25519"`,
      `headers="digest"`,
      `signature="${signatureBase64}"`
    ].join(",");

    console.log("🔍 Authorization header:", authorization);
    return { digest, authorization };
  } catch (error) {
    console.error("❌ Error creating signature:", error);
    throw error;
  }
}

// Simple health check
app.get("/", (req, res) => res.send("✅ Beckn BAP is live"));

// /search endpoint
app.post("/search", async (req, res) => {
  // Fallback GPS if none provided
  const gps = req.body?.message?.intent?.fulfillment?.start?.location?.gps
    || "12.9715987,77.5945627";

  // Build Beckn context - make these configurable via environment variables
  const bap_id = process.env.BAP_ID || "bap.beckn-production.up.railway.app";
  const bap_uri = process.env.BAP_URI || "https://beckn-production.up.railway.app";
  
  const context = {
    domain:       "uei:charging",
    action:       "search",
    location:     { country: { code: "IND" }, city: { code: "std:080" } },
    core_version: "1.1.0",
    bap_id:       bap_id,
    bap_uri:      bap_uri,
    transaction_id: uuid(),
    message_id:     uuid(),
    timestamp:      new Date().toISOString()
  };

  // Build the payload
  const becknPayload = {
    context,
    message: {
      intent: {
        fulfillment: {
          start: {
            location: {
              gps,
              radius: { type: "CONSTANT", value: "5", unit: "km" }
            }
          }
        }
      }
    }
  };

  try {
    console.log("🔁 Sending /search to Beckn Gateway…");
    console.log("📋 BAP ID:", bap_id);
    console.log("📋 Payload:", JSON.stringify(becknPayload, null, 2));

    // Create Digest + Signature headers
    const { digest, authorization } = createBecknSignatureHeaders(
      becknPayload,
      context.bap_id
    );

    console.log("🔐 Digest:", digest);
    console.log("🔐 Authorization:", authorization);

    // Forward to Beckn Gateway
    const response = await axios.post(
      "https://gateway.becknprotocol.io/search",
      becknPayload,
      {
        headers: {
          "Content-Type":  "application/json",
          "Accept":        "application/json",
          "Digest":        digest,
          "Authorization": authorization
        }
      }
    );

    console.log("✅ Search forwarded to Gateway");
    res.status(200).json({ context, response: response });
  } catch (err) {
    console.error("❌ Failed to forward search:", err.response?.data || err.message);
    res.status(500).json({ 
      error: "Failed to forward search to Beckn Gateway",
      details: err.response?.data || err.message 
    });
  }
});

// Webhook endpoints for all Beckn callbacks
const routes = [
  "on_search", "on_select", "on_init", "on_confirm",
  "on_status", "on_track",  "on_cancel", "on_support"
];

routes.forEach(route => {
  app.post(`/${route}`, (req, res) => {
    console.log(`[${route}]`, JSON.stringify(req.body, null, 2));
    res.status(200).send({ ack: { status: "ACK" } });
  });
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log(`🚀 BAP server listening on port ${PORT}`);
});
