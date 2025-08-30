const express = require("express");
const fileUpload = require("express-fileupload");
const { Storage } = require("@google-cloud/storage");
const { PubSub } = require("@google-cloud/pubsub");
const { Pool } = require("pg");
const { v4: uuid } = require("uuid");

const PORT = process.env.PORT || 8080;
const BUCKET = process.env.BUCKET;
const DATABASE_URL = process.env.DATABASE_URL;
if (!BUCKET) throw new Error("Missing env BUCKET");
if (!DATABASE_URL) throw new Error("Missing env DATABASE_URL");

const app = express();
app.use(express.static("public"));
app.use(fileUpload());

const storage = new Storage();
const pubsub = new PubSub();
const pool = new Pool({ connectionString: DATABASE_URL });

app.get("/healthz", (_, res) => res.send("ok"));

app.post("/upload", async (req, res) => {
  try {
    const file = req.files?.file;
    if (!file) return res.status(400).send("file required");
    const id = uuid();
    const originalKey = `originals/${id}`;
    await storage.bucket(BUCKET).file(originalKey).save(file.data, {
      contentType: file.mimetype,
      resumable: false
    });

    await pool.query(
      `insert into images(id, user_id, gcs_uri, status, content_type, size_bytes)
       values ($1, $2, $3, 'PENDING', $4, $5)`,
      [id, null, `gs://${BUCKET}/${originalKey}`, file.mimetype, file.size]
    );

    await pubsub.topic("images.uploaded").publishMessage({
      json: {
        image_id: id,
        gcs_uri: `gs://${BUCKET}/${originalKey}`,
        content_type: file.mimetype,
        size_bytes: file.size,
        trace_id: `web-${Date.now()}`
      }
    });

    res.json({ image_id: id });
  } catch (e) {
    console.error(e);
    res.status(500).send("upload_failed");
  }
});

app.get("/images", async (_req, res) => {
  try {
    const r = await pool.query(
      `select id, gcs_uri, thumb_gcs_uri, status, created_at
       from images order by created_at desc limit 50`
    );
    const bucket = storage.bucket(BUCKET);
    const out = await Promise.all(
      r.rows.map(async row => {
        const origKey = row.gcs_uri.replace(`gs://${BUCKET}/`, "");
        const [origUrl] = await bucket.file(origKey).getSignedUrl({
          version: "v4",
          action: "read",
          expires: Date.now() + 15 * 60 * 1000
        });
        let thumbUrl = null;
        if (row.thumb_gcs_uri) {
          const thumbKey = row.thumb_gcs_uri.replace(`gs://${BUCKET}/`, "");
          [thumbUrl] = await bucket.file(thumbKey).getSignedUrl({
            version: "v4",
            action: "read",
            expires: Date.now() + 15 * 60 * 1000
          });
        }
        return {
          id: row.id,
          status: row.status,
          created_at: row.created_at,
          original_url: origUrl,
          thumb_url: thumbUrl
        };
      })
    );
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).send("list_failed");
  }
});

app.listen(PORT, () => console.log(`svc-web listening on ${PORT}`));
