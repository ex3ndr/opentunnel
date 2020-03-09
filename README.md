# Opentunnel - encrypted tunnels to localhost
[![Version npm](https://img.shields.io/npm/v/opentunnel.svg?logo=npm)](https://www.npmjs.com/package/opentunnel)

opentunnel is a reverse proxy that creates an encrypted tunnel from a random public endpoint to a locally running web service.
Opentunnel support any TCP connections and all modern browsers and devices (that support TLS v3).

## Status of the Opentunnel
Opentunnel is in it's early experimental, but stable state. Opentunnel is tuned for low volume traffic and low latencies (any end-user app/device).

## Getting Started
Opentunnel is a nodejs commandline utility that have client and server in a single binary. When starting a tunnel it registers it self on registration server to get a domain name, starts a tunnel, then issue a certificate via let's encrypt and then enable traffic flow to your server completely end-to-end encrypted.

To instal it to your system execute:
```bash
yarn global add opentunnel
```

Now you can start a tunnel for your local server that listens on **8080** port:
```bash
opentunnel client -p 8080
```

Opentunnel creates a config file with certificates in .opentunnel directory in current working one, preserve it if you want to keep your domain name.

# Your own deployment
Backend is completely stateless. There are three servers - registration server (issuen authentication tokens), frontend server (accepts incoming connections) and backend server (accepting tunnel connections). Authentication tokens are like JWT, but using fast and proven crypto via NaCL/TweetNaCL.

## Requirements
### Domain Name
Domain name that is used for issuing tl
### Two public IPs
### NATS bus
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

## Registrator
Default registration server that issues random domains. 
This operation requires **REG_KEY** environment key with a secret part of authentication key.

```bash
opentunnel registrator <domain> -p <listening_port>
```
* <host> is a base domain that is used to issue tokens for random subdomains.
* <listening_port> is a port to listen too. Default is 9001.

## Licence
MIT (c) Steve Korshakov
