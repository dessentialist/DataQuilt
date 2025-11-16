#!/bin/bash
# One-time setup script for public repository
# Creates squashed initial commit and pushes to public repo

set -e

PUBLIC_REPO_URL="https://github.com/dessentialist/DataQuilt.git"
PUBLIC_REPO_NAME="public"

echo "🔍 Checking git status..."
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Working directory is not clean. Please commit or stash changes."
  exit 1
fi

echo "🧹 Removing sensitive files..."
rm -f .replit
rm -rf changelog/
rm -f ERROR_*.md IMPLEMENTATION_PLAN.md
rm -f test.csv "perplexity test.csv" tmp_upload.csv
# CRITICAL: Remove all .env files to prevent secret exposure
rm -f .env .env.* .env.local .env.*.local

echo "📦 Creating squashed commit..."
git checkout --orphan public-main
# Use git add with explicit exclusions to ensure .env files are never included
git add -A
# Double-check: explicitly remove any .env files that might have been added
git rm --cached .env .env.* .env.local .env.*.local 2>/dev/null || true
# Also remove other sensitive files
git rm --cached -r changelog/ 2>/dev/null || true
git rm --cached .replit ERROR_*.md IMPLEMENTATION_PLAN.md 2>/dev/null || true
git rm --cached test.csv "perplexity test.csv" tmp_upload.csv 2>/dev/null || true
git rm --cached *.crt prod-ca-*.crt 2>/dev/null || true

# CRITICAL: Verify no .env files before committing
if git ls-files | grep -q "\.env"; then
  echo "❌ ERROR: .env files still detected! Aborting."
  git ls-files | grep "\.env"
  git checkout main
  exit 1
fi

git commit -m "Initial public release of DataQuilt

DataQuilt is a lightweight, efficient platform for enriching CSV data using multiple LLM providers.

Features:
- Multi-provider LLM support (OpenAI, Gemini, Perplexity, DeepSeek)
- Real-time job processing with progress monitoring
- Secure API key management with encryption
- Template management system
- Variable substitution in prompts

See README.md for setup instructions."

echo "🚀 Pushing to public repository..."
if git remote | grep -q "^${PUBLIC_REPO_NAME}$"; then
  git remote set-url ${PUBLIC_REPO_NAME} ${PUBLIC_REPO_URL}
else
  git remote add ${PUBLIC_REPO_NAME} ${PUBLIC_REPO_URL}
fi

git push ${PUBLIC_REPO_NAME} public-main:main --force

echo "✅ Public repository setup complete!"
echo "⚠️  Remember to:"
echo "   1. Switch back to main branch: git checkout main"
