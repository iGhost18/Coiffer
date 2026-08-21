# GhostCutApp Production Release Checklist

## Required before deployment
- [ ] Run `npm ci` in `api`, `socket`, and `frontend`.
- [ ] Run `npm audit` in each Node project and review/fix high/critical findings.
- [ ] Run the frontend production build successfully.
- [ ] Start the backend against a real staging MongoDB database.
- [ ] Run all API authentication/authorization tests.
- [ ] Run concurrent booking tests.
- [ ] Verify Cloudinary upload limits and allowed MIME types.
- [ ] Verify production HTTPS and CORS origin.
- [ ] Configure real production environment variables outside source control.
- [ ] Rotate every secret that appeared in the original project archive.
- [ ] Configure backups and MongoDB monitoring.
- [ ] Configure shared rate limiting and Socket.io Redis adapter before using multiple API/socket instances.
- [ ] Run an end-to-end browser regression test on staging.

## Production architecture requirements
- Frontend served over HTTPS.
- API served over HTTPS.
- WebSocket traffic uses WSS through the production reverse proxy.
- MongoDB is not publicly exposed.
- Secrets are supplied by the hosting provider's secret/environment system.
- Application logs do not contain passwords, JWTs, Cloudinary secrets, or database credentials.
- Reverse proxy/load balancer enforces request size and TLS limits.
