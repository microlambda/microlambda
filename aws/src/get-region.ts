export const getRegion = (): string => {
  if (process.env.AWS_REGION) {
    return process.env.AWS_REGION;
  }
  // TODO: Populate from config default region
  return 'eu-west-1';
}
