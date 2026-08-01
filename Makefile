# Development commands — run `make help` for an overview.
.DEFAULT_GOAL := dev
.PHONY: help dev frontend build preview lint setup deploy clean

help: ## List available commands
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  make %-10s %s\n", $$1, $$2}'

node_modules: package.json
	npm install
	@touch node_modules

dev: node_modules ## Run everything: frontend + admin API (/api) via Vercel (default)
	@test -d .vercel || { echo "✗ Not linked to Vercel yet — run 'make setup' first."; exit 1; }
	@grep -q '^ADMIN_PASSWORD=' .env.local 2>/dev/null || echo "⚠ hint: set ADMIN_PASSWORD in .env.local to log in to /trips/admin locally"
	@echo "➜ Everything (frontend + API) will be at http://localhost:3000 — NOT :5173"
	npx vercel dev

frontend: node_modules ## Frontend only (no admin API) — fastest for UI work
	npm run dev

build: node_modules ## Production build (type-check + bundle)
	npm run build

preview: build ## Serve the production build locally
	npm run preview

lint: node_modules ## Run eslint
	npm run lint

setup: node_modules ## One-time: log in to Vercel and link this folder to the project
	@npx vercel whoami >/dev/null 2>&1 && echo "✓ already logged in" || npx vercel login
	npx vercel link

deploy: ## Deploy to production on Vercel
	npx vercel --prod

clean: ## Remove build output
	rm -rf dist
