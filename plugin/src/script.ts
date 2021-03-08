import { checkSecretExists } from './secrets/check-secret-exists';

(async() => {
  const key = 'dataportal/prod/FRANCE_ACCOUNT_KEY';
  console.log('exist', key, await checkSecretExists('eu-west-1', key));
})();
