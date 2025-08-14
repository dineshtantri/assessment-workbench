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

## Docker Pre-built Images vs Local Development

### Problem: Component Changes Not Appearing Despite Volume Mounts

**Date:** August 9, 2025  
**Issue:** Added new AssessmentPhases component to left navigation, but component wasn't appearing even with Docker volume mounts configured.

### Root Cause
LibreChat's `docker-compose.yml` was using pre-built GitHub image (`ghcr.io/danny-avila/librechat-dev:latest`) instead of building from local source code. Even with volume mounts, the container was running the pre-built application bundle, not the local development files.

### Investigation Process
1. **Initial debugging attempts (didn't work):**
   - Added volume mount: `./client/src:/app/client/src`
   - Created test component with red borders and alert popups
   - Cleared Docker cache: `docker system prune -f`
   - Rebuilt with `--no-cache` flag
   - Added console.log statements for debugging

2. **Key discovery:** Container was using pre-built image, not local source
   ```yaml
   # Problem configuration in docker-compose.yml
   api:
     image: ghcr.io/danny-avila/librechat-dev:latest  # Pre-built image
     volumes:
       - ./client/src:/app/client/src  # Volume mount ineffective
   ```

### Solution
Switch from Docker development to local development environment:

```bash
# Step 1: Start only database services in Docker
docker compose up -d mongodb meilisearch vectordb rag_api

# Step 2: Install dependencies locally
npm install

# Step 3: Build LibreChat packages (critical step)
npm run build:data-provider
npm run build:data-schemas  
npm run build:api
npm run build:client-package

# Step 4: Start development servers locally
npm run backend:dev    # Starts on default port
npm run frontend:dev   # Starts on port 3091 (auto-incremented from 3090)
```

### Key Files Modified
- **Component:** `client/src/components/Nav/AssessmentPhases.tsx` - New assessment phases component
- **Navigation:** `client/src/components/Nav/Nav.tsx` - Imported and rendered AssessmentPhases
- **Configuration:** Used existing LibreChat theming and component system

### Debugging Techniques Used
1. **Visual debugging:** Added red borders and background colors to test components
2. **JavaScript alerts:** Used `window.alert()` to confirm component rendering
3. **Console logging:** Added debug statements to track component lifecycle
4. **Docker inspection:** Checked container creation times and image sources
5. **Volume verification:** Tested if mounted files were accessible in container

### Lessons Learned
1. **Pre-built images ignore local changes** - even with volume mounts for built applications
2. **LibreChat monorepo requires package builds** before running development servers
3. **Local development is more reliable** for active development than Docker containers
4. **Port conflicts are handled automatically** by Vite (3090 → 3091)
5. **Component integration** works seamlessly with LibreChat's existing architecture

### Key Commands for LibreChat Development
```bash
# Check what's using a port
netstat -ano | findstr :3090

# Build all required packages in correct order
npm run build:data-provider && npm run build:data-schemas && npm run build:api && npm run build:client-package

# Start database services only
docker compose up -d mongodb meilisearch vectordb rag_api

# Start development servers
npm run backend:dev &
npm run frontend:dev
```

### Docker vs Local Development Decision Matrix
| Scenario | Recommendation | Reason |
|----------|---------------|--------|
| Active component development | Local | Real-time code changes |
| Testing existing features | Docker | Matches production environment |
| Database/backend services | Docker | Complex setup, standardized |
| Frontend development | Local | Hot reload, debugging tools |

---

*This document tracks important debugging sessions and solutions for future reference.*