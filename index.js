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
const PRIVATE_KEY = crypto.createPrivateKey({
  key:    fs.readFileSync(path.join(__dirname, "keys", "private_key.pem")),
  format: "pem",
  type:   "pkcs8"
});

/**
 * Create Digest + HTTP‑Signature headers for Beckn requests.
 *
 * @param {object} payload      Any JSON‑serializable payload.
 * @param {string} subscriberId Your registered BAP ID (used as keyId in the header).
 * @returns {{ digest: string, authorization: string }}
 */
function createBecknSignatureHeaders(payload, subscriberId) {
  // 1) Compute SHA‑256 over the JSON body
  const bodyBuffer = Buffer.from(JSON.stringify(payload), "utf8");
  const hashBuf    = crypto.createHash("sha256").update(bodyBuffer).digest();
  const digest     = `SHA-256=${hashBuf.toString("base64")}`;

  // 2) Build the signing string (only headers you include here must be in the HTTP Signature)
  const signingString = `digest: ${digest}`;

  // 3) Sign with Ed25519
  const signatureBase64 = crypto
    .sign(null, Buffer.from(signingString, "utf8"), PRIVATE_KEY)
    .toString("base64");

  // 4) Format the HTTP Signature header
  const authorization = [
    `Signature`,
    `keyId="${subscriberId}"`,
    `algorithm="ed25519"`,
    `headers="digest"`,
    `signature="${signatureBase64}"`
  ].join(", ");

  return { digest, authorization };
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
    res.status(200).json({ context, response: response.data });
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
