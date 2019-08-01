. ~/.nvm/nvm.sh
nvm use 8.16.0 && \
sh build.sh && \
cd ../wireflow.co_3001 && \
sh install.sh && \
nvm use 8.16.0 && \
sh run.sh
