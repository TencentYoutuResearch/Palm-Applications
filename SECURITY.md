# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Palm Racer, please report it responsibly.

**Please do NOT open a public GitHub issue for security vulnerabilities.**

### How to Report

Send an email to the project maintainers with:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact assessment
4. Suggested fix (if any)

### What to Expect

- **Acknowledgment** within 48 hours
- **Initial assessment** within 1 week
- **Fix timeline** communicated after assessment
- **Credit** in the security advisory (if desired)

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |

## Security Best Practices

When deploying Palm Racer:

- **Never commit secrets** — Use environment variables for `PALM_SECRET_ID`, `PALM_SECRET_KEY`, database credentials
- **Use HTTPS** — All production deployments should use TLS
- **Restrict CORS** — Configure `Access-Control-Allow-Origin` to specific domains in production
- **Enable rate limiting** — Configure QPS limits in `palm-racer.yaml`
- **Keep dependencies updated** — Regularly update Go modules and npm packages
