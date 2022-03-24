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

A public FQDN of a Keycloak instance accesible from pods and browser is required. The Keycloak instance in `docker-compose.yaml` can be re-used as follows. The Keycloak instance can be exposed using `ngrok`

> Update `OAUTH2_PROXY_OIDC_ISSUER_URL` to public FQDN of Keycloak in deployment files

```sh
# Run Keycloak and MariaDB service
docker-compose up -d keycloak mariadb

# Keycloak can be referenced using `hostAlias` in local development or exposed over internet using `ngrok`:
ngrok http 8080
```

Create the following common resources.

```sh
kubectl apply -f k8s/0-common.yaml
# Comment line in `oauth2-proxy-redis-config` if Redis storage is not to be used
kubectl apply -f k8s/1-redis.yaml
```

### Sidecar Deployment

Thw following deployment runs OAuth2-Proxy a sidecar to protect resources within same pod.

```sh
kubectl apply -f k8s/sidecar.yaml

# Access using Ingress: http://sidecar.127.0.0.1.nip.io/get?show_env=1
# Or: http://localhost:8000/get?show_env=1 via port-forwarding below
kubectl port-forward server-667478cf46-w4fm7 8000:4180
```

### Auth Reverse Proxy to Protect External Resource Outside Cluster

Thw following deploymeny runs OAuth2-Proxy a Authentication Reverse Proxy to resource outside the cluster.

```sh
# Update public IP of httpbin.org in following file if using headless service
# Visit http://proxy.127.0.0.1.nip.io/get?show_env=1
kubectl apply -f k8s/external-resource.yaml
```

### NGINX Auth Service to Protect Ingress Resource

Thw following deployment runs OAuth2-Proxy as an Authentication Service used by NGINX Ingress Controller.

```sh
# Visit http://httpbin.127.0.0.1.nip.io/get?show_env=1
kubectl apply -f k8s/ingress-auth.yaml
```

## Reference

[OAuth2 Proxy Configuration](https://oauth2-proxy.github.io/oauth2-proxy/docs/configuration/overview)

[NGINX Ingress Controller Annotations](https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/)

## Troubleshooting

```sh
Error redeeming code during OAuth2 callback: email in id_token () isn't verified

 Error creating session during OAuth2 callback: id_token did not contain an email and profileURL is not defined
```
