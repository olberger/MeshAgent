
# docker run -v `pwd`:/src meshagentbuilder make linux ARCHID=6
#  docker run -it -v `pwd`:/src -e USER=root -e USERID=0 meshagentbuilder make linux ARCHID=6

# debug with :
#  docker run -it -v `pwd`:/src meshagentbuilder /bin/bash

FROM debian:stable

MAINTAINER Olivier Berger <olivier.berger@telecom-sudparis.eu>

ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    sudo \
    git ca-certificates \
    make gcc libc6-dev \
    libx11-dev libxtst-dev libxext-dev libjpeg62-turbo-dev

# Defaults to be overruled by launch script (docker run ... -e USERID=1001 ...)
ENV USER=meshbuilder
ENV USERID=1000

WORKDIR /src

ADD dockerscripts/startup.sh /startup.sh
ENTRYPOINT ["/startup.sh"]
