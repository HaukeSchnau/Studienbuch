# Studienbuch Monorepo

## Development Setup (with `direnv`)
```bash
direnv allow
just dev # Builds/loads OCI images and starts local services
```

## Available Scripts
```bash
just dev # OCI-first local development flow
bin/up # Starts local services with OCI image preload
bin/up-reset # Resets volumes, rebuilds OCI images, and starts services
console # Allows to execute predefined commands
visualize-deps # Visualizes the dependencies between the JS packages
```
