# Chirp Backend

## Run

Requires Java 17+ and Maven 3.9+.

```bash
mvn spring-boot:run
```

The API starts at `http://localhost:8080`. The frontend static server remains at `http://localhost:4173`.

## Endpoints

- `POST /api/auth/register` `{ "name", "email", "password" }`
- `POST /api/auth/login` `{ "email", "password" }`
- `POST /api/auth/forgot-password` `{ "email" }`

The default H2 database is stored in `data/chirp.*` under the backend directory.
