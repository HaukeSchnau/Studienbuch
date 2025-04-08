# Studienbuch Monorepo

## Development Setup

Copy the `.env.example` file to `.env` and fill in the necessary values. Please note that some scripts assume a database name of `studienbuch-dev`. Then, run the following command to set up the development environment:

```bash
./scripts/dev/setup
```

If you prefer to automatically spin up the necessary services using Docker, you can set the `DATABASE_URL` environment variable to `postgres://stu:stu@localhost:5432/stu` and run the following command:

```bash
./scripts/dev/setup --docker
```

## Deployment

e
To deploy the application, run the following commands on the server:

```bash
git clone git@github.com/HaukeSchnau/studienbuch.git src

./src/scripts/deploy prod src builds
```
