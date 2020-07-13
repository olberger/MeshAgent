#!/bin/bash

#set -x

# Meant to be invoked with a non-root user to be created

USER=${USER:-root}
if [ "$USER" != "root" ]; then
    # echo "* enable custom user: $USER"
    useradd --home-dir $HOME --shell /bin/bash --uid $USERID --user-group --groups adm,sudo $USER
    if [ -z "$PASSWORD" ]; then
        echo "  set default password to \"meshbuilder\""
        PASSWORD=meshbuilder
    fi
    echo "$USER:$PASSWORD" | chpasswd
fi

chown -R $USER:$USER $HOME

# clearup
PASSWORD=

# Leave the floor to the real command
exec sudo -u $USER $*
