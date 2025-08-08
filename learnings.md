# Project Learnings & Troubleshooting Guide

## Docker Container Caching Issues

### Problem: Source Code Changes Not Reflecting in Application

**Date:** August 8, 2025  
**Issue:** Changed footer text from "Every AI for Everyone" to "Assessment Workbench - Build Your Skills" but changes weren't visible in the running application.

### Root Cause
LibreChat was running in Docker containers that were built before the code changes. Docker containers cache the built application state, so source code changes don't automatically reflect until containers are rebuilt.

### Investigation Process
1. **First attempts (didn't work):**
   - Updated `.env` file with `CUSTOM_FOOTER` variable
   - Updated translation files (`client/src/locales/*/translation.json`)
   - Cleared browser cache
   - Restarted development servers

2. **Key discovery:** Docker containers were running from an hour-old build
   ```bash
   docker ps -a
   # Showed: LibreChat container created "About an hour ago"
   ```

### Solution
```bash
# Stop all containers
docker compose down

# Rebuild and restart with updated code
docker compose up -d --build
```

### Key Files Modified
- **Environment:** `.env` - Set `CUSTOM_FOOTER="Assessment Workbench - Build Your Skills"`
- **Translations:** All 26 language files in `client/src/locales/*/translation.json`
  - Updated `com_ui_latest_footer` key in every language file
- **Footer Component:** `client/src/components/Chat/Footer.tsx` (uses the translation key)

### Lessons Learned
1. **Always check Docker containers** when source changes don't appear
2. **LibreChat footer text** comes from translation files, not hardcoded strings
3. **Multi-language support** means updating ALL translation files, not just English
4. **Container rebuilds** are required after source code changes in Docker environments
5. **Browser cache** should be cleared after container rebuilds

### Quick Debugging Commands
```bash
# Check running containers
docker ps -a

# Check docker-compose services  
docker compose ps

# Stop and rebuild containers
docker compose down && docker compose up -d --build

# Search for text in translation files
grep -r "footer_text" client/src/locales/
```

### Future Reference
- When text changes don't appear: Check Docker containers first
- When changing UI text: Look for translation files (`client/src/locales/`)
- When working with LibreChat: Remember it's internationalized (i18n)
- Always use `--build` flag when restarting containers after code changes

---

## LibreChat Configuration Hierarchy

### Footer Text Priority (from highest to lowest):
1. `CUSTOM_FOOTER` environment variable in `.env`
2. `customFooter` in `librechat.yaml` config
3. Translation files: `com_ui_latest_footer` key
4. Default hardcoded fallback

### Translation System
- Location: `client/src/locales/[language]/translation.json`
- Key format: `com_ui_[component]_[element]`
- Footer key: `com_ui_latest_footer`
- Languages supported: 26+ (including English, Spanish, French, German, Chinese, etc.)

---

*This document tracks important debugging sessions and solutions for future reference.*