# Picster Demo (GCP - Cloud Run, Cloud SQL, GCS, Pub/Sub)

Demo web upload ảnh (Giai đoạn 1). Thành phần:
- `svc-web`: web + API upload/list ảnh.
- `svc-worker`: consumer Pub/Sub tạo thumbnail bằng Sharp.
- `job-cleanup`: Cloud Run Job dọn ảnh mồ côi/failed.
- `sql/001_init.sql`: schema Postgres.

## Biến môi trường
Các service/job đều cần:
- `BUCKET` — tên GCS bucket (vd. `picster-demo-ase1`)
- `DATABASE_URL` — ví dụ (Cloud SQL Unix socket thông qua Cloud Run):


## Deploy nhanh
1. Tạo Artifact Registry repo: `app-repo` (region của bạn, ví dụ `asia-southeast1`).
2. Build & push image bằng Cloud Build (trigger file `cloudbuild.yaml`) hoặc tự build.
3. Deploy Cloud Run:
 - `svc-web` + Cloud SQL connection + env vars.
 - `svc-worker` + Cloud SQL connection + env vars.
 - Pub/Sub: topic `images.uploaded` + subscription push `images-worker` trỏ `https://<svc-worker>/events`.
4. Apply schema Postgres: chạy `sql/001_init.sql` vào instance Cloud SQL.
5. Mở URL `svc-web`, upload ảnh, mở Gallery xem kết quả.

## Ghi chú
- `svc-worker` dùng `sharp`. Image base `node:20-slim` đã cài tool build phòng khi thiếu binary.
- Sang Giai đoạn 2 (HA đa vùng) giữ nguyên code, chỉ mở rộng hạ tầng.
EOF

cat > "$BASE/.gitignore" <<'EOF'
node_modules/
.DS_Store
npm-debug.log*
.env
EOF


