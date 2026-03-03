#!/bin/bash
echo "===== configlab Status Check ====="
echo ""
echo "--- Node.js Application (PM2) ---"
pm2 status configlab-app
echo ""
echo "--- Nginx Status ---"
systemctl status nginx --no-pager | grep "Active:"
echo ""
echo "--- PostgreSQL Status ---"
systemctl status postgresql --no-pager | grep "Active:"
echo ""
echo "--- Disk Usage ---"
df -h / | grep -v Filesystem
echo ""
echo "--- Recent Errors ---"
tail -n 5 /var/log/nginx/configlab_error.log 2>/dev/null || echo "No errors"