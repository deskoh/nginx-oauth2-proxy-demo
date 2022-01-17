# NGINX with OAuth2 Proxy and Keycloak demo

NGINX -> OAuth2 Proxy -> HTTPBin

## Quick Start

```sh
# Start (Keycloak will bootstrap with `dev` realm and users)
# NGINX and OAuth2 Proxy will exit as dependent containers are not ready (https://docs.docker.com/compose/startup-order/)
docker-compose up -d
# Wait until Keycloak completes initialization, and start the stopped containers
docker-compose up -d

# Cleanup
docker-compose rm
docker volume prune
```

Initiate browser login at http://nginx.127.0.0.1.nip.io:9000/get with user=`user`, password=`password`.

Authenticated requests will be proxied to NodeJS server with HTTP headers echoed to the browser:

```sh
'x-user': '4a76657b-35f0-43d0-9653-9b0f60ebd4b9'
'x-email': 'user@example.org'
```

[Sign-out URL](http://nginx.127.0.0.1.nip.io:9000/oauth2/sign_out?rd=http://keycloak.127.0.0.1.nip.io:8080/auth/realms/dev/protocol/openid-connect/logout?redirect_uri=http://nginx.127.0.0.1.nip.io:9000): Signing out will clear OAuth2 Proxy cookie followed by redirect to Keycloak logout endpoint to clear Keycloak session, before final redirect to http://nginx.127.0.0.1.nip.io:9000.

Access Keycloak at [http://keycloak.127.0.0.1.nip.io:8080](http://keycloak.127.0.0.1.nip.io:8080) with user=`admin`, password=`password` to check out the settings

## Refreshing Cookie

By setting a value for `refresh-cookie`, the proxy will refresh the Access Token after the specified duration. By setting a short duration (e.g. 5m, which is the default expiry for Access Token issued by Keycloak), this will allow sessions to be revoked quickly.

> For OAuth2 Proxy configuration, `refresh-cookie` does not work for `keycloak` provider but works for `oidc` provider.

## Hostname / Domain

The issuer of access token is the hostname / domain during browser login. Subsequent `POST` to token validation endpoint  ( OAuth2 Proxy `validate_url` value if configured) by OAuth2 Proxy will fail with `{"error":"invalid_token","error_description":"Token verification failed"}` if the hostname is different.

For OAuth2 Proxy container to reach Keycloak using the same hostname / FQDN, an alias to Keycloak container is configured in `docker-compose.yml`.

```yml
aliases:
  - keycloak.127.0.0.1.nip.io
```

## Keycloak Export

```sh
docker run --rm\
    --name keycloak_exporter\
    --network local\
    -v /tmp:/tmp/realm-config:Z\
    -e KEYCLOAK_USER=admin\
    -e KEYCLOAK_PASSWORD=password\
    -e DB_ADDR=mariadb\
    -e DB_USER=keycloak\
    -e DB_PASSWORD=password\
    -e DB_VENDOR=mariadb\
    jboss/keycloak:11.0.1\
    -Dkeycloak.migration.action=export\
    -Dkeycloak.migration.provider=dir\
    -Dkeycloak.migration.dir=/tmp/realm-config\
    -Dkeycloak.migration.usersExportStrategy=SAME_FILE
```

## Kubernetes Deployment

OAuth2 Proxy can run as a sidecar to protect resources.

A public FQDN for Identity Provider (IdP) is required to be configured (`OAUTH2_PROXY_OIDC_ISSUER_URL`). This URL is used by OAuth2 Proxy for service discovery and to redirect users to the IdP for authentication.

```sh
kubectl apply -f k8s/deployment.yaml

# Port forward to OAuth2-Proxy container in pod
kubectl port-forward server-667478cf46-w4fm7 8000:4180
# Visit http://localhost:8000/get
```
