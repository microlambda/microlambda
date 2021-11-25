echo "Recreating ${DATAPORTAL_BASE_PATH}/node_modules/@microlambda"

rm -rf "${DATAPORTAL_BASE_PATH}/node_modules/@microlambda"
mkdir "${DATAPORTAL_BASE_PATH}/node_modules/@microlambda"


echo "Copying compiled files to ${DATAPORTAL_BASE_PATH}/node_modules/@microlambda"

cp -R ./cli "${DATAPORTAL_BASE_PATH}/node_modules/@microlambda"
cp -R ./client "${DATAPORTAL_BASE_PATH}/node_modules/@microlambda"
cp -R ./core "${DATAPORTAL_BASE_PATH}/node_modules/@microlambda"
cp -R ./generators "${DATAPORTAL_BASE_PATH}/node_modules/@microlambda"
cp -R ./plugin "${DATAPORTAL_BASE_PATH}/node_modules/@microlambda"
cp -R ./handling "${DATAPORTAL_BASE_PATH}/node_modules/@microlambda"
cp -R ./server "${DATAPORTAL_BASE_PATH}/node_modules/@microlambda"
cp -R ./types "${DATAPORTAL_BASE_PATH}/node_modules/@microlambda"
cp -R ./testing "${DATAPORTAL_BASE_PATH}/node_modules/@microlambda"
