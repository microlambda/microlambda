/* eslint-disable no-console */
export const remove = (): void => {
  console.warn('This will remove the following services. Are you sure to proceed ?');
  // remove basePath if any
  // sls remove
  // remove route53 records
  // leave certificate: it could be used by something else
};
