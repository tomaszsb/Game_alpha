# Deployment TODO

Tasks to complete when choosing and deploying to production server.

## Infrastructure Setup (Environment-Specific)

### 1. Reverse Proxy Configuration
**When:** Choosing hosting platform
**Platforms:**
- **Vercel/Netlify:** Automatic - no action needed
- **VPS (DigitalOcean, Linode):** Configure nginx or Apache
- **AWS/GCP:** Set up load balancer
- **Heroku:** Automatic - no action needed

**Tasks:**
- [ ] Choose hosting platform
- [ ] Configure reverse proxy if using VPS
- [ ] Set up domain routing

### 2. HTTPS/SSL Configuration
**When:** Before going live
**Platforms:**
- **Vercel/Netlify:** Automatic & free
- **VPS:** Use Let's Encrypt (certbot)
- **AWS:** Use ACM (AWS Certificate Manager)
- **Heroku:** Automatic

**Tasks:**
- [ ] Enable HTTPS on chosen platform
- [ ] Verify SSL certificate is valid
- [ ] Redirect HTTP to HTTPS
- [ ] Update app to use HTTPS URLs

### 3. CORS Configuration
**When:** Deploying backend
**Tasks:**
- [ ] Update CORS allowed origins from `*` to specific domains
- [ ] Configure CORS for production domain
- [ ] Test CORS from production frontend

**Example (server.js):**
```javascript
// Development
app.use(cors());

// Production
app.use(cors({
  origin: ['https://yourdomain.com', 'https://www.yourdomain.com'],
  credentials: true
}));
```

### 4. Rate Limiting
**When:** Before going live
**Tasks:**
- [ ] Install rate limiting middleware (e.g., express-rate-limit)
- [ ] Configure limits per endpoint
- [ ] Add rate limit headers
- [ ] Test rate limiting

**Example:**
```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 5. Environment Variables
**When:** Deploying
**Tasks:**
- [ ] Set `VITE_SERVER_URL` in hosting platform UI
- [ ] Set `NODE_ENV=production` for backend
- [ ] Configure any API keys or secrets
- [ ] Verify env vars are loaded correctly

### 6. Database/State Persistence
**When:** Moving beyond local storage
**Tasks:**
- [ ] Choose database (PostgreSQL, MongoDB, Redis, etc.)
- [ ] Set up database on hosting platform
- [ ] Migrate state storage from in-memory to database
- [ ] Add database connection pooling
- [ ] Set up automated backups

### 7. Monitoring & Logging
**When:** After deployment
**Tasks:**
- [ ] Set up error tracking (Sentry, Rollbar, etc.)
- [ ] Configure logging service
- [ ] Set up uptime monitoring
- [ ] Configure alerts for errors/downtime
- [ ] Add performance monitoring

### 8. Performance Optimization
**When:** After deployment
**Tasks:**
- [ ] Enable gzip compression
- [ ] Set up CDN for static assets
- [ ] Optimize bundle size
- [ ] Add caching headers
- [ ] Implement lazy loading for routes

---

## Platform-Specific Guides

### Vercel (Recommended for Quick Deploy)
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in project directory
3. Set environment variables in Vercel dashboard
4. Automatic HTTPS, CDN, and deployments

### Netlify
1. Install Netlify CLI: `npm i -g netlify-cli`
2. Run `netlify deploy`
3. Set environment variables in Netlify dashboard
4. Automatic HTTPS and CDN

### DigitalOcean/VPS
1. Set up Ubuntu server
2. Install Node.js, nginx, certbot
3. Configure nginx as reverse proxy
4. Set up PM2 for process management
5. Configure Let's Encrypt SSL
6. Set up automated deployments

### AWS
1. Use Elastic Beanstalk or EC2
2. Set up Application Load Balancer
3. Configure ACM for SSL
4. Use RDS for database
5. Set up CloudWatch for monitoring

---

## Completed Development Improvements ✅
- [x] Environment variable support for server URL
- [x] Connection status indicator in UI
- [x] Retry logic with exponential backoff
- [x] Graceful degradation to local state
