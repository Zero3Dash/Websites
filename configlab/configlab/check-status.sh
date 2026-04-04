#!/bin/bash
# configlab — service status check
echo "════════════════════════════════════════"
echo "  configlab Status Check"
echo "  $(date)"
echo "════════════════════════════════════════"

echo ""
echo "── Node.js App (PM2) ──"
pm2 show configlab-app 2>/dev/null | grep -E "status|cpu|memory|uptime|restarts" || echo "  App not running"

echo ""
echo "── Nginx ──"
systemctl status nginx --no-pager -l | grep -E "Active:|Main PID:"
nginx -t 2>&1 | tail -2

echo ""
echo "── PostgreSQL ──"
systemctl status postgresql --no-pager | grep "Active:"
sudo -u postgres psql -d configlab_db -c "
  SELECT
    (SELECT COUNT(*) FROM templates)    AS templates,
    (SELECT COUNT(*) FROM users)        AS users,
    (SELECT COUNT(*) FROM devices)      AS devices,
    (SELECT COUNT(*) FROM credentials)  AS credentials,
    (SELECT COUNT(*) FROM execution_logs WHERE status='running') AS running_jobs;
" 2>/dev/null || echo "  (could not query DB)"

echo ""
echo "── Disk Usage ──"
df -h / | awk 'NR==2{printf "  Root: %s used of %s (%s)\n",$3,$2,$5}'
df -h /var/backups 2>/dev/null | awk 'NR==2{printf "  Backups: %s used\n",$3}' || true

echo ""
echo "── Recent App Errors ──"
tail -n 8 /var/log/configlab/err.log 2>/dev/null || echo "  No error log found"

echo ""
echo "── Recent Nginx Errors ──"
tail -n 5 /var/log/nginx/configlab_error.log 2>/dev/null || echo "  No error log found"

echo ""
echo "── SSL Certificate ──"
if [[ -f /etc/ssl/certs/configlab.crt ]]; then
    openssl x509 -in /etc/ssl/certs/configlab.crt -noout \
        -subject -enddate 2>/dev/null | sed 's/^/  /'
elif [[ -f /etc/letsencrypt/live/*/fullchain.pem ]]; then
    openssl x509 -in /etc/letsencrypt/live/*/fullchain.pem -noout \
        -subject -enddate 2>/dev/null | sed 's/^/  /'
fi
echo "════════════════════════════════════════"
