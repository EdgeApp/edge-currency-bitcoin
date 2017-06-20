if ! [ -f ../../spv.ldb.zip ]; then
  curl -o ../../spv.ldb.zip https://developer.airbitz.co/download/spvdemo.ldb.zip
  mkdir -p ../../db
  unzip ../../spv.ldb.zip -d ../../db/spvdemo
fi