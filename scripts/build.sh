git clone https://github.com/holepunchto/pear-runtime-bootstrap
git clone https://github.com/holepunchto/electron-runtime
git clone https://github.com/holepunchto/libappling
git clone https://github.com/holepunchto/wakeup

cd wakeup/
bare-dev vendor sync
bare-dev configure
bare-dev build

cd ../pear-runtime-bootstrap
bare-dev vendor sync
bare-dev configure
bare-dev build

cd ../libappling
npm i
bare-dev vendor sync
bare-dev configure
bare-dev build

cd ../electron-runtime
npm i
npm run dist

cd ..

mkdir -p platform-build/bin/pear-runtime-app
mkdir -p platform-build/lib

cp -a electron-runtime/dist/linux-unpacked/* platform-build/bin/pear-runtime-app
cp wakeup/build/bin/pear platform-build/bin
cp pear-runtime-bootstrap/build/pear-runtime platform-build/bin
cp libappling/build/launch.so platform-build/lib

rm -rf electron-runtime 
rm -rf libappling
rm -rf wakeup
rm -rf pear-runtime-bootstrap