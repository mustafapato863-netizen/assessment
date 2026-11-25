#!/bin/sh
# Apply pending Prisma migrations before the API starts (`prisma migrate deploy`).
# Needs the migration history to exist in the database (baselined once).
# A failure is logged and the API still starts, so a bad migration never takes login down.
# Set SKIP_DB_SYNC=true to turn this off.
if [ "$SKIP_DB_SYNC" != "true" ]; then
  echo "[entrypoint] applying database migrations (prisma migrate deploy)"
  (cd /app/packages/database && node scripts/prisma-command.mjs migrate deploy 2>&1 | sed "s#postgresql://[^ ]*#<db-url>#g") \
    || echo "[entrypoint] WARNING: migrate deploy failed; starting API anyway"
fi
exec node apps/api/dist/main.js
