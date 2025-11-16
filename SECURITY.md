# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

## Reporting a Vulnerability

We take the security of CollaborNest seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please DO NOT

- **Open a public GitHub issue** for security vulnerabilities
- **Disclose the vulnerability publicly** before we've had a chance to address it
- **Exploit the vulnerability** beyond what is necessary to demonstrate it

### Please DO

1. **Email us privately** at: **<awesome.cit.dev@gmail.com>**
2. **Include detailed information**:
   - Description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact
   - Suggested fix (if you have one)
3. **Allow reasonable time** for us to respond (we aim for 48 hours)

### What to Expect

1. **Acknowledgment**: We will acknowledge your email within 48 hours
2. **Assessment**: We will investigate and assess the severity
3. **Updates**: We will keep you informed of our progress
4. **Resolution**: We will work on a fix and coordinate disclosure timing
5. **Credit**: With your permission, we will credit you in our security advisories

### Security Update Process

1. **Vulnerability confirmed** → Private fix development
2. **Patch ready** → Coordinate disclosure date with reporter
3. **Release security update** → Publish fixed version
4. **Public disclosure** → Publish security advisory with credits

## Security Best Practices for Users

When deploying CollaborNest, follow these security guidelines:

### Environment Variables

Never commit these to version control:

```bash
# CRITICAL - Never expose publicly
JWT_SECRET=<strong-random-secret>
DATABASE_PASSWORD=<secure-password>

# Use strong, randomly generated values
# Example: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Database Security

- Use strong, unique passwords for database accounts
- Restrict database access to application server IPs only
- Enable SSL/TLS for database connections in production
- Regular backups with encryption at rest

### Application Security

- **Always use HTTPS** in production (no plain HTTP)
- **Enable CORS** restrictions (whitelist allowed origins)
- **Rate limiting** enabled by default (configurable)
- **Helmet.js** security headers enabled
- **Input validation** with class-validator on all DTOs

### Infrastructure Security

- Keep Node.js and dependencies up to date
- Use container security scanning (e.g., Snyk, Trivy)
- Implement network isolation (VPC, security groups)
- Monitor logs for suspicious activity
- Enable database audit logs (10-year retention for healthcare)

### Healthcare-Specific Security (HIPAA/GDPR)

- **PHI Protection**: Encrypt all patient health information
- **Access Control**: Role-based access with audit trail
- **Data Retention**: 10-year minimum for medical records
- **Breach Notification**: Report breaches within 72 hours (GDPR)
- **Business Associate Agreement**: Required for HIPAA compliance

## Known Security Features

### Built-in Protections

- ✅ **JWT Authentication**: Secure token-based auth
- ✅ **Rate Limiting**: 100 req/min per IP (configurable)
- ✅ **Helmet.js**: Security headers (CSP, HSTS, etc.)
- ✅ **Input Validation**: class-validator on all endpoints
- ✅ **SQL Injection Prevention**: TypeORM parameterized queries
- ✅ **XSS Protection**: Sanitized inputs and outputs
- ✅ **CSRF Protection**: Double-submit cookie pattern
- ✅ **Audit Logging**: Complete event trail (NDJSON format)

### Regular Security Maintenance

We perform regular:

- Dependency vulnerability scans (`npm audit`)
- Static code analysis (ESLint security plugin, SonarJS)
- Automated security testing in CI/CD
- Third-party security audits (annually)

## Security Hall of Fame

We appreciate security researchers who responsibly disclose vulnerabilities:

_No vulnerabilities reported yet. Be the first!_

---

## Contact

**Security Team**: <awesome.cit.dev@gmail.com>

**PGP Key**: _Available upon request_

**Response Time**: Within 48 hours

**Disclosure Policy**: Coordinated disclosure (30-90 days after fix)

---

**Last Updated**: November 16, 2025
