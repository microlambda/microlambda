type SecretsConfiguration = {
  [serviceName: string]: Array<string>;
};

const secrets: SecretsConfiguration = {
  'datalake': [
    'AZURE_CLIENT_SECRET',
    // Tenants storage accounts keys for 'global' buckets
    'PRHQ_GLOBAL_ACCOUNT_KEY',
    'LATAM_GLOBAL_ACCOUNT_KEY',
    'ASIA_GLOBAL_ACCOUNT_KEY',
    'FRANCE_GLOBAL_ACCOUNT_KEY',
    'AMERICAS_GLOBAL_ACCOUNT_KEY',
    'MED_GLOBAL_ACCOUNT_KEY',
    'EMEA_GLOBAL_ACCOUNT_KEY',
    'NWE_GLOBAL_ACCOUNT_KEY',
    'MMPJ_GLOBAL_ACCOUNT_KEY',
    'PRW_GLOBAL_ACCOUNT_KEY',
    'BRANDCOS_GLOBAL_ACCOUNT_KEY',
    // Tenants storage accounts keys for 'landing' buckets
    'PRHQ_LANDING_ACCOUNT_KEY',
    'LATAM_LANDING_ACCOUNT_KEY',
    'ASIA_LANDING_ACCOUNT_KEY',
    'FRANCE_LANDING_ACCOUNT_KEY',
    'AMERICAS_LANDING_ACCOUNT_KEY',
    'MED_LANDING_ACCOUNT_KEY',
    'EMEA_LANDING_ACCOUNT_KEY',
    'NWE_LANDING_ACCOUNT_KEY',
    'MMPJ_LANDING_ACCOUNT_KEY',
    'PRW_LANDING_ACCOUNT_KEY',
    'BRANDCOS_LANDING_ACCOUNT_KEY',
    // Tenants storage accounts for specific usages
    'PRW_DEV_ACCOUNT_KEY',
    'PRW_UAT_ACCOUNT_KEY',
  ],
  'dashboards': [
    'AAS_CUBE_API_START_CUBE_TOKEN',
    'AAS_CUBE_API_GET_CUBE_TOKEN',
    'POWERBI_APP_SECRET',
    'powerbi_backup_password',
    'powerbi_password',
  ],
  'leons': ['AZURE_CLIENT_SECRET'],
  'sources': ['AZURE_CLIENT_SECRET'],
  'users': ['AZURE_CLIENT_SECRET'],
  'sync-ad': ['AZURE_CLIENT_SECRET'],
  'statistics': ['SNOWFLAKE_PASSWORD'],
  'db-snowflake': ['SNOWFLAKE_PASSWORD'],
  'papyrus': ['PAPYRUS_API_KEY', 'MDH_API_KEY'],
  'guardian': ['GUARDIAN_KEY'],
};

export default secrets;
