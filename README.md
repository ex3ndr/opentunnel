# Opentunnel - encrypted tunnels to localhost
opentunnel is a reverse proxy that creates an encrypted tunnel from a random public endpoint to a locally running web service.

## Status of the Opentunnel
Opentunnel is in it's early experimental, but stable state. Opentunnel is tuned for low volume traffic and low latencies (any end-user app/device).

## Install
```bash
yarn global add opentunnel
```

## Start Tunnel
```bash
opentunnel client -p 8080
```

# Backend
Backend is completely stateless. There are three servers - registration server (issuen authentication tokens), frontend server (accepts incoming connections) and backend server (accepting tunnel connections). Authentication tokens are like JWT, but using fast and proven crypto via NaCL/TweetNaCL.

## NATS bus
Opentunnel uses NATS for messaging between servers that scales well and is able to route traffic via shortest network path. Before deployment of Opentunnel you have to deploy NATS cluster.

## Frontend
Frontend servers are the one that accept connections from public network.

```bash
opentunnel frontend -p <listening_port> -ph <listening_http_port> -s <nats_servers>
```
* <listening_port> is a tls port, usually 443. Default is 9000.
* <listening_http_port> is a http port, usually 80. Default is 9005.
* <nats_servers> is a NATS server endpoints to connect to. Default is localhost.

## Backend
Backend servers are the one that accept incoming connections from servers.
```bash
opentunnel backend <key> -p <listening_port> -s <nats_servers>
```

* <key> is a public part of the authentication key.
* <listening_port> is a port to listen too. Default is 9001.
* <nats_servers> is a NATS server endpoints to connect to. Default is localhost.

## Licence
MIT (c) Steve Korshakov
