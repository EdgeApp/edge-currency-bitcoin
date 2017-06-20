mkdir -p ../../db
if ! [ -f ../../spv.ldb.zip ]; then
  curl -o ../../spv.ldb.zip https://developer.airbitz.co/download/spvdemo.ldb.zip  
  unzip ../../spv.ldb.zip -d ../../db
fi