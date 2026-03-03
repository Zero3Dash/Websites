#!/bin/bash
BACKUP_DIR="/var/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="configlab_db"
DB_USER="configlab_user"

# Perform the dump
sudo -u postgres pg_dump $DB_NAME > $BACKUP_DIR/${DB_NAME}_$DATE.sql

# Compress
gzip $BACKUP_DIR/${DB_NAME}_$DATE.sql

# Keep only the last 7 days of backups
find $BACKUP_DIR -name "${DB_NAME}_*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${DB_NAME}_$DATE.sql.gz"