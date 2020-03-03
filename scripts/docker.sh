set -e
CURRENT_VERSION=v$(node -p "require('semver').patch(require('./package.json').version)")
tsc
docker build -t ex3ndr/opentunnel:$CURRENT_VERSION . 
docker push ex3ndr/opentunnel:$CURRENT_VERSION
echo "Published $CURRENT_VERSION"