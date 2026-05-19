# Deployment Guide

This guide covers deploying DataQuilt to various platforms. DataQuilt can be deployed to any platform that supports Node.js applications.

## Prerequisites

Before deploying, ensure you have:

1. **PostgreSQL Database**
   - Supabase (recommended) or self-hosted PostgreSQL
   - Connection string ready

2. **Supabase Project**
   - Project URL
   - Anon key and Service Role key
   - JWT secret
   - Storage bucket created (`oracle-files`)

3. **Environment Variables**
   - All required variables configured (see `.env.example`)
   - Encryption key generated

4. **LLM Provider API Keys** (optional)
   - At least one provider key for testing
   - Users can add their own keys via the UI

## Environment Variables

Copy `.env.example` to `.env` and configure:

### Required Variables

```bash
DATABASE_URL=postgresql://user:password@host:5432/database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=base64_encoded_32_byte_key
```

### Generating Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Optional Variables

```bash
OPENAI_API_KEY=sk-your_key_here
GEMINI_API_KEY=your_gemini_key_here
PERPLEXITY_API_KEY=your_perplexity_key_here
DQ_PROMPT_DEDUPE=on
DQ_DEDUPE_SECRET=optional_secret
NODE_ENV=production
```

## Database Setup

### 1. Run Migrations

```bash
npm run db:push
```

This will create all necessary tables:
- `users`
- `files`
- `enrichment_jobs`
- `job_logs`
- `prompt_templates`
- `system_templates`

### 2. Configure Row-Level Security (RLS)

If using Supabase, ensure RLS policies are configured:

- Users can only access their own data
- Files are user-scoped
- Jobs are user-scoped
- Templates are user-scoped

### 3. Create Storage Bucket

Create a storage bucket named `oracle-files` in Supabase:

```sql
-- Bucket should be created via Supabase Dashboard
-- Or use Supabase CLI:
supabase storage create oracle-files --public false
```

## Deployment Platforms

### Option 1: Railway

1. **Connect Repository**
   - Link your GitHub repository
   - Railway will detect Node.js

2. **Configure Environment Variables**
   - Add all required variables in Railway dashboard
   - Set `NODE_ENV=production`

3. **Configure Build & Start**
   - Build command: `npm run build`
   - Start command: `npm run start`
   - Worker command: `node dist/worker/index.js` (separate service)

4. **Database**
   - Use Railway PostgreSQL or external Supabase

### Option 2: Render

1. **Create Web Service**
   - Connect repository
   - Build command: `npm run build`
   - Start command: `npm run start`

2. **Create Background Worker**
   - New background worker service
   - Start command: `node dist/worker/index.js`

3. **Environment Variables**
   - Add all required variables
   - Set for both services

### Option 3: Vercel (Frontend) + Railway/Render (Backend)

**Frontend (Vercel):**
- Build command: `npm run build`
- Output directory: `dist/public`
- Environment variables: Only client-side vars

**Backend (Railway/Render):**
- Deploy API server separately
- Deploy worker separately
- Configure CORS for Vercel domain

### Option 4: Self-Hosted (Docker)

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 5000

CMD ["npm", "run", "start"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    depends_on:
      - db

  worker:
    build: .
    command: node dist/worker/index.js
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    depends_on:
      - db

  db:
    image: postgres:16
    environment:
      POSTGRES_DB: dataquilt
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: your_password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Run:
```bash
docker-compose up -d
```

## Post-Deployment Checklist

- [ ] Database migrations completed
- [ ] Storage bucket created and configured
- [ ] Environment variables set correctly
- [ ] API server running and accessible
- [ ] Worker process running
- [ ] Health endpoint responding: `/api/health`
- [ ] Authentication working (Google OAuth)
- [ ] File uploads working
- [ ] Job processing working
- [ ] Real-time updates working

## Health Checks

### API Health Endpoint

```bash
curl https://your-domain.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-XX...",
  "environment": "production"
}
```

### Worker Health

Check worker logs for heartbeat messages:
```
[Worker] Heartbeat - checking for jobs...
```

## Monitoring

### Logs

- API server logs: Application logs
- Worker logs: Background job processing
- Database logs: Query performance

### Metrics to Monitor

- Job processing time
- API response times
- Database connection pool usage
- Storage usage
- LLM API call success rates

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify `DATABASE_URL` is correct
   - Check SSL/TLS settings
   - Verify database is accessible

2. **Storage Upload Failures**
   - Verify Supabase credentials
   - Check bucket exists and permissions
   - Verify storage policies

3. **Worker Not Processing Jobs**
   - Check worker is running
   - Verify database connection
   - Check job logs for errors

4. **Authentication Issues**
   - Verify Supabase OAuth configuration
   - Check redirect URLs
   - Verify JWT secret matches

### Debug Mode

Set `NODE_ENV=development` for verbose logging (not recommended in production).

## Scaling

### Horizontal Scaling

- Run multiple API server instances behind load balancer
- Run multiple worker instances (job leasing prevents conflicts)
- Use connection pooling for database

### Vertical Scaling

- Increase Node.js memory limit if needed
- Optimize database queries
- Use CDN for static assets

## Security Considerations

- Use HTTPS in production
- Keep dependencies updated
- Rotate secrets regularly
- Monitor for security advisories
- Use environment variables for all secrets
- Enable database SSL/TLS
- Configure CORS properly
- Set up rate limiting

## Backup Strategy

- Regular database backups
- Storage bucket backups
- Environment variable backups (secure location)
- Migration scripts version controlled

---

For platform-specific help, refer to:
- [Railway Docs](https://docs.railway.app/)
- [Render Docs](https://render.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Supabase Docs](https://supabase.com/docs)

