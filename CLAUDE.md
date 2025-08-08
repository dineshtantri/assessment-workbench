# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

LibreChat is a comprehensive open-source AI chat platform that brings together multiple AI models in a ChatGPT-like interface. This is a full-stack application with React frontend, Node.js/Express backend, and MongoDB database, designed to support multiple AI providers and extensive customization.

## Key Architecture Components

### Monorepo Structure
- **Root**: Workspace configuration, Docker setup, deployment configs
- **`api/`**: Node.js/Express backend server with all business logic
- **`client/`**: React frontend application using Vite
- **`packages/`**: Shared TypeScript packages for code reuse
  - `@librechat/api`: Backend utilities and shared functions  
  - `@librechat/client`: Frontend UI components and theme system
  - `@librechat/data-provider`: API client and data management
  - `@librechat/data-schemas`: Database models and validation schemas

### Backend Architecture (`api/`)
- **Entry Point**: `api/server/index.js` - Express server setup with middleware
- **AI Clients**: `api/app/clients/` - LLM provider integrations (OpenAI, Anthropic, Google, etc.)
- **Routes**: `api/server/routes/` - RESTful API endpoints
- **Models**: `api/models/` - MongoDB schema definitions via Mongoose
- **Services**: `api/server/services/` - Business logic layer
- **Agents**: `api/app/clients/agents/` - AI agent implementations with tool support
- **MCP Support**: Model Context Protocol server integration for extensibility

### Frontend Architecture (`client/`)
- **Entry Point**: `client/src/App.jsx` - React app with providers (Recoil, React Query, Theme)
- **Components**: Organized by feature areas (Chat, Nav, Messages, etc.)
- **State Management**: Recoil for global state, React Query for server state
- **Routing**: React Router for SPA navigation
- **Theming**: Comprehensive theme system with Tailwind CSS + Radix UI
- **Localization**: i18next with 20+ language translations

## Common Development Commands

### Building and Development
```bash
# Install dependencies (from root)
npm install

# Start development environment
npm run backend:dev    # Start API server in development mode
npm run frontend:dev   # Start Vite dev server for client

# Build production assets
npm run frontend       # Build client with all packages
npm run backend        # Start production backend server
```

### Testing
```bash
# Run tests
npm run test:api      # Backend Jest tests
npm run test:client   # Frontend Jest tests

# End-to-end testing
npm run e2e           # Playwright tests (local config)
npm run e2e:headed    # Run with browser UI
npm run e2e:a11y      # Accessibility tests
```

### Linting and Formatting  
```bash
npm run lint          # ESLint check across codebase
npm run lint:fix      # Auto-fix linting issues
npm run format        # Prettier formatting
```

### Database and Configuration
```bash
# User management
npm run create-user   # Create new user account
npm run list-users    # List all users
npm run ban-user      # Ban specific user
npm run delete-user   # Delete user account

# Balance management (if enabled)
npm run add-balance   # Add credits to user
npm run list-balances # Show user balances
```

### Docker Development
```bash
# Docker compose (development)
docker-compose up -d  # Start all services (MongoDB, API, Meilisearch, RAG API)

# Production deployment
npm run start:deployed  # Deploy using deploy-compose.yml
npm run stop:deployed   # Stop deployed services
```

## Key Configuration Files

- **`librechat.example.yaml`**: Main application configuration template
  - AI endpoint configurations (custom providers, models)  
  - UI interface settings and feature toggles
  - File upload limits and authentication settings
  - Registration, balance, and rate limiting configs

- **`.env`**: Environment variables (create from examples in docs)
  - Database connection strings
  - API keys for AI providers
  - Authentication settings (OAuth, LDAP)
  - Feature flags and security settings

- **`docker-compose.yml`**: Development container orchestration
  - MongoDB, Meilisearch (search), PostgreSQL + pgvector (RAG)
  - LibreChat API container and RAG API container

## Database Models and Data Flow

### Core Entities
- **Users**: Authentication, preferences, balance tracking
- **Conversations**: Chat sessions with metadata and branching support
- **Messages**: Individual chat messages with multi-modal content
- **Presets**: Saved AI model configurations and parameters
- **Files**: Uploaded documents with processing status
- **Agents**: Custom AI assistants with tools and capabilities
- **Assistants**: OpenAI-compatible assistant configurations

### Data Relationships
- Users → Conversations (1:many)
- Conversations → Messages (1:many) with branching/forking support
- Users → Presets/Agents (1:many)
- Messages support multi-modal content (text, images, files)

## AI Provider Integration

The system supports multiple AI providers through:
- **Standard Endpoints**: OpenAI, Anthropic, Google, Azure OpenAI, AWS Bedrock
- **Custom Endpoints**: Any OpenAI-compatible API via configuration
- **Agent Framework**: Tools, function calling, code execution, file search
- **MCP Servers**: Extensible tool system via Model Context Protocol

## Development Workflow

1. **Setup**: Install dependencies with `npm install`
2. **Configuration**: Copy and customize `librechat.example.yaml`
3. **Environment**: Create `.env` with required API keys and settings
4. **Database**: Start MongoDB (via Docker or local install)
5. **Development**: Run `npm run backend:dev` and `npm run frontend:dev`
6. **Testing**: Run tests before committing changes
7. **Linting**: Use `npm run lint:fix` to maintain code standards

## Key Features to Understand

- **Multi-modal Support**: Text, images, files, code execution
- **Conversation Management**: Branching, forking, search, export
- **Agent System**: Custom AI assistants with extensible tools
- **Theming**: Comprehensive customization with CSS variables
- **Internationalization**: Full i18n support with 20+ languages
- **Authentication**: Local accounts, OAuth providers, LDAP, SAML
- **Rate Limiting**: Configurable limits for API usage and uploads
- **File Processing**: Document upload, processing, and retrieval

This architecture enables LibreChat to serve as both a ChatGPT alternative and an extensible platform for AI applications.