docker create \
  --name=letsencrypt \
  --cap-add=NET_ADMIN \
  -e PUID=1000 \
  -e PGID=1000 \
  -e TZ=Europe/London \
  -e URL=test.orcarium.com \
  -e VALIDATION=http \
  -e EMAIL=support@orcarium.com \
  -p 443:443 \
  -p 80:80 \
  linuxserver/letsencrypt

docker start letsencrypt
