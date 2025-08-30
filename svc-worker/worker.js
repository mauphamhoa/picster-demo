const express = require("express");
const { Storage } = require("@google-cloud/storage");
const sharp = require("sharp");
const { Pool } = require("pg");

const PORT = process.env.PORT || 8080;
const BUCKET = process.env.BUCKET;
const DATABASE_URL = process.env.DATABASE_URL;
if (!BUCKET) throw new Error("Missing env BUCKET");
if (!DATABASE_URL) throw new Error("Missing env DATABASE_URL");

const app = express();
app.use(express.json());
const storage = new Storage();
const pool = new Pool({ connectionString: DATABASE_URL });

app.get("/healthz", (_, res) => res.send("ok"));

// Pub/Sub push endpoint
app.post("/events", async (req, res) => {
  const msg = req.body && req.body.message;
  if (!msg) return res.status(204).end();
  let payload = {};
  try {
    const decoded = Buffer.from(msg.data, "base64").toString("utf8");
    payload = JSON.parse(decoded);
  } catch (e) {
    console.error("Bad message", e);
    return res.status(400).end();
  }
  const { image_id, gcs_uri } = payload;
  if (!image_id || !gcs_uri) return res.status(204).end();

  try {
    // If already READY, skip (idempotent)
    const cur = await pool.query("select status from images where id=$1", [image_id]);
    if (!cur.rowCount) return res.status(204).end();
    if (cur.rows[0].status === "READY") return res.status(204).end();

    const origKey = gcs_uri.replace(`gs://${BUCKET}/`, "");
    const [buf] = await storage.bucket(BUCKET).file(origKey).download();
    const thumb = await sharp(buf).resize({ width: 256 }).jpeg({ quality: 80 }).toBuffer();
    const thumbKey = `thumbnails/${image_id}.jpg`;
    await storage.bucket(BUCKET).file(thumbKey).save(thumb, {
      contentType: "image/jpeg",
      resumable: false
    });

    await pool.query(
      "update images set status='READY', thumb_gcs_uri=$2, ready_at=now() where id=$1",
      [image_id, `gs://${BUCKET}/${thumbKey}`]
    );
    return res.status(204).end();
  } catch (e) {
    console.error(e);
    // Return 500 to trigger Pub/Sub retry
    return res.status(500).end();
  }
});

app.listen(PORT, () => console.log(`svc-worker listening on ${PORT}`));
