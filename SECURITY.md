# Security Policy

## Supported Versions

We actively support the latest version of DataQuilt. Security updates are prioritized for the current release.

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public issue. Instead, please report it via one of the following methods:

### Preferred Method

Email security concerns to: **dq@dessentialist.com** (or use GitHub Security Advisories if available)

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Time

We aim to respond to security reports within 48 hours and provide an initial assessment within 7 days.

## Security Best Practices

### For Users

1. **API Key Security**
   - Never share your API keys
   - Rotate keys regularly
   - Use separate keys for development and production
   - Monitor API key usage

2. **Environment Variables**
   - Never commit `.env` files
   - Use strong, unique values for `ENCRYPTION_KEY`
   - Keep Supabase credentials secure
   - Rotate secrets periodically

3. **Database Security**
   - Use strong database passwords
   - Enable SSL/TLS connections
   - Restrict database access to necessary IPs
   - Regular backups

4. **Deployment Security**
   - Use HTTPS in production
   - Enable CORS restrictions
   - Keep dependencies updated
   - Monitor for security advisories

### For Developers

1. **Never Commit Secrets**
   - Use `.env` files (gitignored)
   - Use environment variables in CI/CD
   - Review code before committing
   - Use secret scanning tools

2. **Dependency Management**
   - Regularly update dependencies
   - Review security advisories
   - Use `npm audit` to check vulnerabilities
   - Pin dependency versions in production

3. **Input Validation**
   - Validate all user inputs
   - Sanitize file uploads
   - Use parameterized queries
   - Implement rate limiting

4. **Authentication & Authorization**
   - Use secure session management
   - Implement proper access controls
   - Validate JWT tokens server-side
   - Use HTTPS for all auth endpoints

## Security Features

### Encryption

- **API Keys**: Encrypted at rest using AES-256-GCM
- **Database**: Supports SSL/TLS connections
- **Sessions**: JWT tokens with secure signing

### Authentication

- Google OAuth 2.0 with PKCE flow
- Supabase JWT validation
- Secure session management
- Row-level security for data isolation

### Data Protection

- User data isolation via RLS policies
- Encrypted API key storage
- Secure file upload handling
- Input validation and sanitization

## Known Security Considerations

1. **API Keys**: Users must manage their own LLM provider API keys. DataQuilt encrypts keys but users are responsible for key security.

2. **File Uploads**: CSV files are validated but users should be cautious with sensitive data.

3. **Environment Variables**: All secrets must be configured via environment variables, never hardcoded.

4. **Database Access**: Ensure proper RLS policies are configured in Supabase.

## Security Updates

Security updates will be:
- Released as patch versions
- Documented in release notes
- Prioritized for immediate deployment

## Acknowledgments

We thank security researchers and contributors who help keep DataQuilt secure. Responsible disclosure is appreciated and will be acknowledged.

---

**Last Updated**: 2025-01-XX

