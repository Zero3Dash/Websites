# configlab v2 — Deployment & Operations Guide

**configlab** is a self-hosted template studio inspired by 4peg.com. v2 adds user authentication (local / LDAP / SAML), a device & credential vault, and live SSH execution streamed to the browser.

---

## Architecture

```
Browser
  │
  ▼
Nginx (443 TLS)          ← reverse proxy, handles WS upgrade
  │
  ▼
Node.js / Express (3000) ← server.js: API + static files + WS SSH
  │           │
  │           └── WebSocket /ws/ssh/:logId  ← real-time SSH output
  ▼
PostgreSQL               ← templates, users, devices, credentials, logs
```

### Pages

| URL | Description |
|-----|-------------|
| `/` | Template studio + SSH execution panel |
| `/login.html` | Login (local / LDAP / SAML) |
| `/devices.html` | Device + credential vault manager |
| `/admin.html` | User admin + auth provider config |

### API routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login/local` | public | Local login |
| POST | `/auth/login/ldap` | public | LDAP login |
| GET | `/auth/saml/login` | public | SAML redirect |
| POST | `/auth/saml/callback` | public | SAML ACS |
| GET | `/auth/me` | user | Current user info |
| POST | `/auth/logout` | user | Destroy session |
| GET | `/api/templates` | user | List templates |
| POST | `/api/templates` | user | Create template |
| DELETE | `/api/templates/:id` | user | Delete template |
| GET | `/api/devices` | user | List devices |
| POST | `/api/devices` | user | Add device |
| PATCH | `/api/devices/:id` | user | Edit device |
| DELETE | `/api/devices/:id` | **admin** | Delete device |
| GET | `/api/devices/groups` | user | List groups |
| POST | `/api/devices/groups` | user | Add group |
| DELETE | `/api/devices/groups/:id` | **admin** | Delete group |
| GET | `/api/devices/credentials` | user | List credentials (no secrets) |
| POST | `/api/devices/credentials` | user | Add credential |
| DELETE | `/api/devices/credentials/:id` | **admin** | Delete credential |
| POST | `/api/ssh/execute` | user | Start SSH job → `{ logId }` |
| GET | `/api/users` | **admin** | List users |
| POST | `/api/users` | **admin** | Create local user |
| PATCH | `/api/users/:id` | **admin** | Edit user |
| DELETE | `/api/users/:id` | **admin** | Delete user |
| GET | `/api/users/auth-config/:provider` | **admin** | Get LDAP/SAML config |
| PUT | `/api/users/auth-config/:provider` | **admin** | Update LDAP/SAML config |

---

## Quick install (Ubuntu 24.04)

For a fresh server, the included `setup.sh` handles everything end-to-end:

```bash
# Clone or copy the configlab directory to your server, then:
sudo bash setup.sh
```

It will install Node 20, PostgreSQL 17, Nginx, PM2, create the database, generate secrets, configure a self-signed SSL cert, and start the application. At the end it prints the generated database password and the URL to access the app.

---

## Manual install

### Prerequisites

- Ubuntu 24.04 (or similar), min 1 GB RAM
- A domain name pointing to your server (for Let's Encrypt) — or use IP/self-signed
- SSH access with sudo

### 1 — System packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git ufw build-essential

# Firewall
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2 — Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v20.x
```

### 3 — PostgreSQL 17

```bash
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
sudo sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
    https://apt.postgresql.org/pub/repos/apt noble-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list'
sudo apt update && sudo apt install -y postgresql-17
sudo systemctl enable --now postgresql
```

#### Create database

```bash
sudo -i -u postgres psql <<'SQL'
CREATE DATABASE configlab_db;
CREATE USER configlab_user WITH PASSWORD 'YourStrongPasswordHere';
GRANT ALL PRIVILEGES ON DATABASE configlab_db TO configlab_user;
\c configlab_db
GRANT ALL ON SCHEMA public TO configlab_user;
\q
SQL
```

#### Apply schemas

```bash
# v1 base tables (templates)
psql -h localhost -U configlab_user -d configlab_db -f schema.sql -W

# v2 tables (users, devices, credentials, groups, logs, auth_config)
psql -h localhost -U configlab_user -d configlab_db -f schema_v2.sql -W
```

### 4 — Application

```bash
sudo mkdir -p /var/www/configlab
sudo chown $USER:$USER /var/www/configlab
# copy files here, then:
cd /var/www/configlab
npm install --omit=dev
```

### 5 — Environment variables

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
nano .env
```

Generate the two required secrets:

```bash
# SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# VAULT_SECRET (MUST be exactly 64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> ⚠️ **Back up `VAULT_SECRET` securely.** If it is lost, all stored credentials become permanently unrecoverable.

Full `.env` reference:

```ini
PORT=3000
NODE_ENV=production

DB_HOST=localhost
DB_PORT=5432
DB_NAME=configlab_db
DB_USER=configlab_user
DB_PASSWORD=YourStrongPasswordHere

SESSION_SECRET=<64-char hex>
VAULT_SECRET=<64-char hex>

APP_URL=https://configlab.yourdomain.com
```

### 6 — PM2

```bash
sudo npm install -g pm2

sudo mkdir -p /var/log/configlab
sudo chown $USER:$USER /var/log/configlab

pm2 start ecosystem.config.js
pm2 save
pm2 startup   # run the printed command as root
```

### 7 — Nginx + SSL

**Option A — Let's Encrypt (production, requires public domain):**

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d configlab.yourdomain.com
```

Then create `/etc/nginx/sites-available/configlab` using the `configlab-letsencrypt` file in this repo and reload nginx.

**Option B — Self-signed (internal / testing):**

```bash
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/ssl/private/configlab.key \
    -out    /etc/ssl/certs/configlab.crt \
    -subj   "/CN=configlab.yourdomain.com"
sudo chmod 600 /etc/ssl/private/configlab.key
```

Then use `configlab-selfsigned` as your Nginx site config.

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/configlab /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

---

## Upgrading from v1

If you already have a running v1 (templates-only) instance:

```bash
# 1. Install new npm packages
npm install bcrypt passport passport-local passport-ldapauth \
    @node-saml/passport-saml express-session connect-pg-simple \
    node-ssh ws

# 2. Apply only the v2 schema (does not modify the templates table)
psql -h localhost -U configlab_user -d configlab_db -f schema_v2.sql -W

# 3. Add new env vars to .env
#    SESSION_SECRET and VAULT_SECRET (see above)

# 4. Deploy new server.js + all route/auth/middleware/crypto files

# 5. Restart
pm2 restart configlab-app
```

**Default admin credentials after migration:** `admin` / `ChangeMe2026!`  
Change these immediately at Admin → Users.

---

## Authentication setup

### Local accounts

Managed entirely through **Admin → Users**. Passwords are bcrypt-hashed (cost 12). Only `local` provider accounts can have their password changed through the UI. LDAP and SAML users are provisioned automatically on first login.

### LDAP / Active Directory

1. Log in as admin → **Admin → Auth Providers → LDAP/AD**
2. Enter your LDAP settings:

| Field | Example |
|-------|---------|
| LDAP URL | `ldap://dc.corp.example.com:389` or `ldaps://dc.corp.example.com:636` |
| Bind DN | `cn=svc-configlab,ou=ServiceAccounts,dc=corp,dc=example,dc=com` |
| Bind Password | (service account password) |
| Search Base | `ou=Users,dc=corp,dc=example,dc=com` |
| Search Filter | `(sAMAccountName={{username}})` |
| Admin Group DN | `CN=configlab-admins,ou=Groups,dc=corp,dc=example,dc=com` |

3. Enable the toggle → **Save**
4. Restart: `pm2 restart configlab-app`
5. The **LDAP/AD** tab now appears on the login page

**For LDAPS with self-signed DC cert:** disable *Reject unauthorized TLS certificates*.

**Group-based admin:** users whose `memberOf` contains the Admin Group DN will receive the `admin` role on each login.

### SAML 2.0 (SSO)

1. Register your Service Provider with your IdP:
   - **Entity ID / Issuer:** `configlab` (or any string — must match what you enter)
   - **ACS URL (Callback):** `https://configlab.yourdomain.com/auth/saml/callback`
   - **Name ID format:** Email address (recommended)

2. Log in as admin → **Admin → Auth Providers → SAML 2.0**
3. Fill in the IdP details and attribute mapping
4. Paste the IdP signing certificate (PEM body, without the `-----BEGIN CERTIFICATE-----` wrapper)
5. Enable the toggle → **Save** → `pm2 restart configlab-app`
6. The **Sign in with SSO** button appears on the login page

**Attribute mapping examples (Azure AD / Entra ID):**

| Field | Value |
|-------|-------|
| Email | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` |
| Username | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name` |
| Role/Group | `http://schemas.microsoft.com/ws/2008/06/identity/claims/groups` |
| Admin group value | Object ID of the admin group |

---

## Device & credential vault

### Credentials

All passwords and private keys are encrypted at rest using **AES-256-GCM** with a key derived from `VAULT_SECRET`. The API never returns plaintext secrets after they are stored — only metadata (name, username, method, creation date).

Supported auth methods:
- **Password** — standard SSH password authentication
- **SSH Private Key** — RSA / Ed25519 PEM private key
- **SSH Private Key + Passphrase** — encrypted private key

### Devices

Devices are assigned a type (Linux, Cisco IOS, Cisco NX-OS, JunOS, Windows) for display purposes. All SSH connections use port 22 by default; this can be overridden per device.

Devices can be grouped and colour-coded for organisation. The group is shown in the SSH device picker on the template page.

### SSH execution

1. On the **Templates** page, select or create a template and fill in all variables
2. Click **⚡ Generate Filled Template**
3. In the right-hand SSH panel, select a target device
4. Optionally select a different credential to override the device default
5. Click **▶ Run on device**
6. stdout streams in real-time (blue), stderr in amber, final exit status shown in green/red

Each execution creates a row in `execution_logs` with the full command, output, exit code, and timestamps. Logs can be retrieved per device:

```
GET /api/devices/:id/logs
```

---

## Database backup

A backup cron job is installed by `setup.sh`. To set it up manually:

```bash
sudo mkdir -p /var/backups/postgresql
sudo chown postgres:postgres /var/backups/postgresql

sudo cp backup-configlab-db.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/backup-configlab-db.sh

# Daily at 02:00
sudo crontab -u postgres -e
# Add: 0 2 * * * /usr/local/bin/backup-configlab-db.sh
```

Restore from backup:

```bash
gunzip -c /var/backups/postgresql/configlab_db_YYYYMMDD_HHMMSS.sql.gz \
    | psql -h localhost -U configlab_user -d configlab_db -W
```

---

## Operations

### Status check

```bash
bash check-status.sh
```

### PM2 commands

```bash
pm2 status                    # process table
pm2 logs configlab-app        # live log tail
pm2 logs configlab-app --err  # errors only
pm2 restart configlab-app     # restart after changes
pm2 monit                     # live CPU / memory dashboard
```

### Log locations

| Log | Path |
|-----|------|
| App stdout | `/var/log/configlab/out.log` |
| App stderr | `/var/log/configlab/err.log` |
| App combined | `/var/log/configlab/combined.log` |
| Nginx access | `/var/log/nginx/configlab_access.log` |
| Nginx errors | `/var/log/nginx/configlab_error.log` |
| PostgreSQL | `/var/log/postgresql/postgresql-17-main.log` |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| 502 Bad Gateway | Node app not running | `pm2 status` then `pm2 start ecosystem.config.js` |
| Can't log in (local) | Wrong default password or broken hash | Re-run `schema_v2.sql` or reset via psql `UPDATE users SET password_hash=...` |
| LDAP login fails | Wrong bind DN / filter / URL | Check `/var/log/configlab/err.log` — ldapauth logs the exact LDAP error |
| SAML error | Cert mismatch or wrong ACS URL | Confirm callback URL in IdP matches `APP_URL/auth/saml/callback` |
| SSH execution fails | No credential on device | Assign a default credential in Devices page |
| SSH "Credential not found" | `VAULT_SECRET` changed | Restore old `VAULT_SECRET` from backup — all encrypted data is unreadable without it |
| WebSocket error | Nginx missing upgrade headers | Confirm `proxy_set_header Upgrade` and `Connection 'upgrade'` are in nginx config |
| `VAULT_SECRET must be 64-char` | Missing or wrong `.env` | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| Templates 401 after upgrade | Session store table missing | The `connect-pg-simple` creates `user_sessions` automatically on first run |

---

## Security notes

- All routes except `/auth/*` and `/login.html` require authentication
- Credential secrets (passwords, SSH keys) are AES-256-GCM encrypted; the API never returns them after storage
- Session cookies are `httpOnly`, `secure` (production), and expire after 8 hours
- Only `admin` role users can delete devices, credentials, groups, and users
- PostgreSQL only listens on `localhost`; no remote DB access
- Install `fail2ban` to protect against SSH brute-force on the host itself

```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```

---

## File structure

```
/var/www/configlab/
├── server.js               ← Express app entry point
├── db.js                   ← PostgreSQL connection pool
├── package.json
├── ecosystem.config.js     ← PM2 config
├── .env                    ← secrets (chmod 600)
├── schema.sql              ← v1: templates table
├── schema_v2.sql           ← v2: users, devices, credentials, etc.
├── setup.sh                ← one-shot install script
├── check-status.sh         ← health check script
├── backup-configlab-db.sh  ← DB backup script
├── auth/
│   └── index.js            ← Passport: local / LDAP / SAML strategies
├── crypto/
│   └── vault.js            ← AES-256-GCM encrypt / decrypt
├── middleware/
│   └── auth.js             ← requireAuth / requireAdmin
├── routes/
│   ├── auth.js             ← /auth/* (login, logout, providers)
│   ├── users.js            ← /api/users/* + auth-config
│   ├── devices.js          ← /api/devices/* (groups, creds, devices)
│   ├── ssh.js              ← /api/ssh/execute + WS handler
│   └── templates.js        ← /api/templates/*
├── public/
│   ├── index.html          ← Template studio + SSH panel
│   ├── login.html          ← Login page
│   ├── admin.html          ← User & auth provider admin
│   └── devices.html        ← Device & credential vault UI
└── configlab-letsencrypt   ← Nginx config (Let's Encrypt)
    configlab-selfsigned    ← Nginx config (self-signed)
```
