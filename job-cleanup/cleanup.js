const { Pool } = require("pg");
const { Storage } = require("@google-cloud/storage");

const BUCKET = process.env.BUCKET;
const DATABASE_URL = process.env.DATABASE_URL;
if (!BUCKET) throw new Error("Missing env BUCKET");
if (!DATABASE_URL) throw new Error("Missing env DATABASE_URL");

(async () => {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const storage = new Storage();
  const bucket = storage.bucket(BUCKET);
  try {
    const r = await pool.query(`
      select id, gcs_uri, thumb_gcs_uri, status, created_at
      from images
      where status='FAILED' or (status='PENDING' and created_at < now() - interval '24 hours')
    `);
    for (const row of r.rows) {
      const del = async (uri) => {
        if (!uri) return;
        const key = uri.replace(\`gs://${BUCKET}/\`, "");
        await bucket.file(key).delete({ ignoreNotFound: true }).catch(()=>{});
      };
      await del(row.gcs_uri);
      await del(row.thumb_gcs_uri);
      await pool.query("delete from images where id=$1", [row.id]);
      console.log("Cleaned", row.id);
    }
    await pool.end();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
