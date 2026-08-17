# MedSearch: Complete AWS EC2 Deployment Guide

This document provides a **complete, step-by-step, beginner-friendly guide** to deploying MedSearch on an AWS EC2 instance. It covers everything from launching the server to setting up automatic HTTPS.

---

## 🏗️ Architecture Overview

Before we start, it's important to understand *what* we are deploying. We are using a streamlined, highly efficient production architecture.

**The Stack (3 Docker Containers):**
1. **Express Server (App):** A single Node.js container that serves *both* the backend API and the static React frontend files.
2. **PostgreSQL:** The primary database for users, bookmarks, and search history.
3. **Redis:** An in-memory cache used for rate limiting and caching LitSense/NCBI API responses.

**The Proxy:**
*   **Caddy:** Runs directly on the EC2 host. It listens on ports 80 (HTTP) and 443 (HTTPS), automatically secures your site with Let's Encrypt SSL certificates, and forwards traffic to the Express container.

---

## Phase 1: Launching the EC2 Server

1. Log into your **AWS Management Console**.
2. Search for and select **EC2**.
3. Click the orange **Launch instance** button.
4. **Name:** Enter `MedSearch-Production`.
5. **Application and OS Images (AMI):** Select **Ubuntu** and ensure **Ubuntu Server 24.04 LTS (HVM)** is chosen.
6. **Instance Type:** Select **`t3.small`** (2 vCPU, 2GB RAM). *Note: `t2.micro` (free tier) is often too small to reliably build Node.js applications and might crash during the build process.*
7. **Key pair (login):**
    *   Click **Create new key pair**.
    *   Name it `medsearch-key`.
    *   Key pair type: **RSA**.
    *   Private key file format: **.pem**.
    *   Click **Create key pair**. Your browser will download a file named `medsearch-key.pem`. **Keep this safe!**
8. **Network settings:**
    *   Check **Allow SSH traffic from** -> Select **Anywhere** (or your specific IP).
    *   Check **Allow HTTP traffic from the internet**.
    *   Check **Allow HTTPS traffic from the internet**.
9. **Configure storage:** Increase the Root volume to at least **20 GiB (gp3)**.
10. Click **Launch instance**.

Once launched, go to your Instances list, click on the new instance, and copy its **Public IPv4 address**.

---

## Phase 2: Connecting via SSH (Windows / PowerShell)

Because you downloaded a `.pem` file, Windows requires strict permissions on this file before it will let you connect.

1. Move the downloaded `medsearch-key.pem` file to a permanent location, e.g., `C:\Users\YourName\.ssh\medsearch-key.pem`.
2. Open **PowerShell** as an administrator (or standard user, but be in your home directory).
3. Run the following commands to secure the file (replace the path with your actual path):

```powershell
# 1. Define the path to your key
$key = "C:\Users\YourName\Downloads\medsearch-key.pem"

# 2. Remove inherited permissions (so other users can't read it)
icacls $key /inheritance:r

# 3. Grant ONLY your current Windows user Read access
icacls $key /grant "${env:USERNAME}:R"
```

4. Now, connect to the server using SSH (replace `YOUR_EC2_IP` with the Public IPv4 address from AWS):

```powershell
ssh -i "C:\Users\YourName\Downloads\medsearch-key.pem" ubuntu@YOUR_EC2_IP
```

*Type `yes` if it asks to accept the fingerprint.*

---

## Phase 3: Automated Deployment

You are now logged into the Ubuntu server. We will use the automated deployment script included in the repository.

1. **Clone your repository** into the `/opt` directory:

```bash
sudo git clone https://github.com/vinoth322006/Medsearch.git /opt/medsearch
```

2. **Navigate to the folder and make the script executable:**

```bash
cd /opt/medsearch
sudo chmod +x deploy-ec2.sh
```

3. **Run the deployment script:**

```bash
sudo ./deploy-ec2.sh
```

### What does `deploy-ec2.sh` do?
*   Updates the Ubuntu server.
*   Installs Docker and Docker Compose.
*   Installs Caddy (for future HTTPS).
*   Generates highly secure, random passwords and secret keys (JWT secrets, Postgres password) and saves them in `.env` and `server/.env.prod`.
*   Builds the Docker images for the application.
*   Starts the database, cache, and app containers.
*   Runs the database migrations to set up the Postgres tables.
*   Seeds the database with an initial Admin user.

Wait for the script to finish. It will print a success message with your IP address.

---

## Phase 4: Accessing the App

Open your web browser and go to:
`http://YOUR_EC2_IP`

You should see the MedSearch application running perfectly!

### Logging in as Admin
The deployment script automatically created an admin account.
*   **Email:** `admin@medsearch.local`
*   **Password:** `AdminPass!2024`

> **IMPORTANT:** Log in immediately, go to the Profile page, and **change the admin password**.

---

## Phase 5: Setting up a Custom Domain & Free HTTPS

Right now, you are accessing the site via an IP address over insecure HTTP. To get a padlock (HTTPS), you need a domain name.

1. **Point your domain to your EC2 instance:**
    *   Log into your domain registrar (GoDaddy, Namecheap, Route53, etc.).
    *   Create an **A Record**.
    *   Set the Host/Name to `@` (or `www`, or `medsearch`).
    *   Set the Value/IP to your **EC2 Public IPv4 address**.
    *   Wait a few minutes for DNS to propagate.

2. **Update the MedSearch configuration:**
    In your SSH terminal on the EC2 server:

```bash
cd /opt/medsearch
```

Edit the environment variables to tell the app its new URL:
```bash
sudo nano server/.env.prod
# Change CORS_ORIGIN to: CORS_ORIGIN=https://yourdomain.com
# Save and exit (Ctrl+O, Enter, Ctrl+X)

sudo nano .env
# Change CORS_ORIGIN to: CORS_ORIGIN=https://yourdomain.com
# Save and exit
```

3. **Configure Caddy for Automatic HTTPS:**

```bash
sudo nano Caddyfile
```
Change `medsearch.yourdomain.com` at the top of the file to your actual domain name. Save and exit.

Copy the Caddyfile to the system configuration and restart Caddy:

```bash
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo systemctl restart caddy
```

4. **Restart the Docker containers:**

```bash
sudo docker compose -f docker-compose.prod.yml down
sudo docker compose -f docker-compose.prod.yml up -d
```

Your site is now securely available at `https://yourdomain.com`! Caddy will automatically renew your SSL certificate forever.

---

## 🛠️ Cheat Sheet: Useful Commands

Run these commands from inside the `/opt/medsearch` directory on your EC2 instance.

**Viewing Logs:**
*   View all logs: `sudo docker compose -f docker-compose.prod.yml logs -f`
*   View only the app logs: `sudo docker compose -f docker-compose.prod.yml logs -f server`

**Restarting / Updating:**
*   If you pushed new code to GitHub and want to update the server:
```bash
sudo git pull origin main
sudo docker compose -f docker-compose.prod.yml up -d --build
```
*   Restart everything without rebuilding: `sudo docker compose -f docker-compose.prod.yml restart`
*   Stop everything: `sudo docker compose -f docker-compose.prod.yml down`

**Database Access:**
*   Run a database migration manually: `sudo docker compose -f docker-compose.prod.yml exec server npx prisma migrate deploy`
*   Access the Postgres database via CLI: `sudo docker compose -f docker-compose.prod.yml exec postgres psql -U medisearch -d medisearch`
