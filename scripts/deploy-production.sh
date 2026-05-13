#!/usr/bin/env bash
set -euo pipefail
APP_DIR=${APP_DIR:-/data/daily-notes-app}
SERVICE=${SERVICE:-daily-notes-app.service}
BASE_URL=${BASE_URL:-https://m.xwr.me}
cd "$APP_DIR"

echo "== 1/6 npm test =="
npm test

echo "== 2/6 npm run build =="
npm run build

echo "== 3/6 production env check =="
if systemctl show "$SERVICE" -p Environment --value >/tmp/daily-notes-service-env.$$; then
  SERVICE_ENV=$(cat /tmp/daily-notes-service-env.$$)
  rm -f /tmp/daily-notes-service-env.$$
  DATABASE_URL=$(printf '%s' "$SERVICE_ENV" | sed -n 's/.*DATABASE_URL=\([^ ]*\).*/\1/p') \
  SESSION_SECRET=$(printf '%s' "$SERVICE_ENV" | sed -n 's/.*SESSION_SECRET=\([^ ]*\).*/\1/p') \
  AUTH_ALLOW_DEV_USER_HEADER=false \
  npm run check:prod
else
  npm run check:prod
fi

echo "== 4/6 restart service =="
sudo systemctl restart "$SERVICE"
sleep 3
systemctl is-active --quiet "$SERVICE"

echo "== 5/6 smoke test =="
root_status=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/")
login_status=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/login")
manage_status=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/manage")
api_body=$(curl -s "$BASE_URL/api/tasks")
printf 'root=%s login=%s manage=%s api=%s\n' "$root_status" "$login_status" "$manage_status" "$api_body"
[[ "$root_status" =~ ^(200|307)$ ]]
[[ "$login_status" == "200" ]]
[[ "$manage_status" =~ ^(200|307)$ ]]
printf '%s' "$api_body" | grep -q 'auth.unauthorized'

echo "== 6/6 recent logs =="
journalctl -u "$SERVICE" --since '2 minutes ago' --no-pager | tail -n 60

echo "deploy ok"
