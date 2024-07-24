docker image build -t testomc .
docker image prune -f
docker builder prune -f
docker run --name testomcDeploy -p 8765:8765 --rm testomc

