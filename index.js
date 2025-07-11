const express = require("express");
const morgan = require("morgan");
const axios = require("axios");
const { v4: uuid } = require("uuid");

const app = express();
app.use(express.json());
app.use(morgan("dev"));

const PORT = process.env.PORT || 5002;

app.get("/", (req, res) => res.send("✅ Beckn BAP is live"));

// ✅ This is the REAL /search route
app.post("/search", async (req, res) => {
  const gps = req.body?.message?.intent?.fulfillment?.start?.location?.gps || "12.9715987,77.5945627";

  const context = {
    domain: "uei:charging",
    action: "search",
    country: "IND",
    city: "std:080",
    core_version: "1.1.0",
    bap_id: "bap.beckn-production.up.railway.app",
    bap_uri: "https://beckn-production.up.railway.app",
    transaction_id: uuid(),
    message_id: uuid(),
    timestamp: new Date().toISOString()
  };

  const becknPayload = {
    context,
    message: {
      intent: {
        fulfillment: {
          start: {
            location: { gps }
          }
        }
      }
    }
  };

  try {
    console.log("🔁 Sending /search to Beckn Gateway...");

    res = await axios.post("https://gateway.becknprotocol.io/search", becknPayload, {
      headers: { "Content-Type": "application/json" }
    });
    res = res.data;

    console.log("✅ Search forwarded to Gateway");
    res.status(200).json({
      context,
      response: res
    });
  } catch (err) {
    console.error("❌ Failed to forward search:", err.message);
    res.status(500).json({ error: "Failed to forward search to Beckn Gateway" });
  }
});

// ✅ Keep your on_* routes
const routes = [
  "on_search", "on_select", "on_init", "on_confirm",
  "on_status", "on_track", "on_cancel", "on_support"
];

routes.forEach(route => {
  app.post(`/${route}`, (req, res) => {
    console.log(`[${route}]`, JSON.stringify(req.body, null, 2));
    res.status(200).send({ ack: { status: "ACK" } });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 BAP network listening on port ${PORT}`);
});