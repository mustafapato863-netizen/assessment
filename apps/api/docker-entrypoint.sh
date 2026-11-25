#!/bin/sh
# Sync the database schema before the API starts.
# `prisma db push` only adds what is missing. It never passes --accept-data-loss,
# so a destructive change is refused. A refusal is logged and the API still starts.
# Set SKIP_DB_SYNC=true to turn this off.
if [ "$SKIP_DB_SYNC" != "true" ]; then
  echo "[entrypoint] syncing database schema (prisma db push)"
  (cd /app/packages/database && node scripts/prisma-command.mjs db push --skip-generate 2>&1 | sed "s#postgresql://[^ ]*#<db-url>#g") \
    || echo "[entrypoint] WARNING: schema sync failed or was refused; starting API anyway"
fi
exec node apps/api/dist/main.js
