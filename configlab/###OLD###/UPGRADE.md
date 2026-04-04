# configlab v2 — Upgrade & Setup Guide

## New dependencies

```bash
npm install bcrypt passport passport-local passport-ldapauth \
  @node-saml/passport-saml express-session connect-pg-simple \
  node-ssh ws
```

---

## New environment variables (add to `.env`)

```bash
# Session secret — generate with:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=your_64_char_hex_here

# Vault encryption key for stored credentials — MUST be 64 hex chars (32 bytes):
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
VAULT_SECRET=your_64_char_hex_here
```

> ⚠️  **Keep VAULT_SECRET safe and backed up.** Losing it means losing access to all stored credentials.

---

## Database migration

Run `schema_v2.sql` against your existing database:

```bash
psql -h localhost -U configlab_user -d configlab_db -f schema_v2.sql -W
```

This creates new tables (`users`, `device_groups`, `credentials`, `devices`, `execution_logs`, `auth_config`) and does **not** touch the existing `templates` table.

---

## Default admin account

The migration seeds a default admin account:
- **Username:** `admin`
- **Password:** `ChangeMe2026!`

**Change this immediately after first login** via Admin → Users → Edit, or via the API:

```bash
curl -s -X PATCH https://configlab.yourdomain.com/api/users/1 \
  -H 'Content-Type: application/json' \
  -d '{"password":"YourNewStrongPassword"}' \
  --cookie "connect.sid=YOUR_SESSION_COOKIE"
```

Or simply log in, go to **Admin → Users**, click **Edit** on the admin user, and set a new password.

---

## LDAP/LDAPS setup

1. Log in as admin → go to **Admin → Auth Providers → LDAP/AD**
2. Fill in your Active Directory / OpenLDAP details
3. Enable the toggle
4. Restart PM2: `pm2 restart configlab-app`
5. The LDAP tab will now appear on the login page

**For LDAPS** (port 636), use `ldaps://` as the URL prefix. If using a self-signed cert on your DC, set *Reject unauthorized TLS* to **off**.

---

## SAML setup

1. Log in as admin → **Admin → Auth Providers → SAML 2.0**
2. Register your SP with your IdP using:
   - **Entity ID (Issuer):** configlab (or whatever you set)
   - **ACS URL (Callback):** `https://configlab.yourdomain.com/auth/saml/callback`
3. Paste your IdP's signing certificate (without `-----BEGIN CERTIFICATE-----` headers)
4. Set the attribute mapping to match what your IdP sends
5. Enable the toggle → restart PM2
6. The **Sign in with SSO** button appears on the login page

---

## Device & SSH execution

### Adding devices

1. Go to **Devices → Credentials** — add a credential (password or SSH key)
2. Go to **Devices → Groups** (optional) — create groups for organisation
3. Go to **Devices** — add a device, assign a group and default credential

### Running templates on devices

1. Open the **Templates** page
2. Select or create a template, fill in variables
3. On the right panel: select a target device (and optionally override credential)
4. Click **▶ Run on device**
5. Output streams live in the terminal panel below

Execution logs are stored in the `execution_logs` table and can be viewed per-device:

```bash
GET /api/devices/:id/logs
```

---

## Nginx note

No Nginx changes required. The WebSocket upgrade path (`/ws/ssh/*`) is handled automatically if you have:

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
```

These are already in both the `configlab-letsencrypt` and `configlab-selfsigned` config files from v1.

---

## File structure (v2)

```
/var/www/configlab/
├── server.js              ← updated entry point
├── db.js                  ← unchanged
├── package.json           ← updated dependencies
├── ecosystem.config.js    ← unchanged
├── .env                   ← add SESSION_SECRET and VAULT_SECRET
├── schema_v2.sql          ← run this to migrate
├── auth/
│   └── index.js           ← Passport strategies (local / LDAP / SAML)
├── crypto/
│   └── vault.js           ← AES-256-GCM credential encryption
├── middleware/
│   └── auth.js            ← requireAuth / requireAdmin
├── routes/
│   ├── auth.js            ← /auth/* endpoints
│   ├── users.js           ← /api/users/* (admin)
│   ├── devices.js         ← /api/devices/* (groups, credentials, devices)
│   ├── ssh.js             ← /api/ssh/execute + WebSocket handler
│   └── templates.js       ← /api/templates/* (extracted from original server.js)
└── public/
    ├── index.html         ← updated: nav, SSH panel
    ├── login.html         ← new: local / LDAP / SAML login
    ├── admin.html         ← new: user management + auth config
    └── devices.html       ← new: devices, groups, credential vault
```
