.PHONY: test test-watch lint typecheck build generate

test:
	npm test

test-watch:
	npm run test:watch

lint:
	npm run lint

typecheck:
	npm run typecheck

build:
	npm run build

generate:
	npm run generate
