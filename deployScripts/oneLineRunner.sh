cd new-links-app && \
git pull && \
cd MoonlyApp && \
nvm use 8.5.0 && \
sh build.sh && \
cd ../wireflow.co_3001 && \
nvm use 4.6.1 && \
sh install.sh && \
nvm use 8.5.0 && \
sh run.sh
