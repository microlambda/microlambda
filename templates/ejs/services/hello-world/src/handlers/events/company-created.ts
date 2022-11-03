import { handle, logger, DynamoDBRecordsUtils } from '@dataportal/shared';
import { ICompany } from '@dataportal/types';
import { DynamoDBRecord } from 'aws-lambda';
import { updateFavoriteOrganization } from '../../utils/update-favorite-organization';

const execute = async (event: DynamoDBRecord): Promise<void> => {
  const { newImage } = DynamoDBRecordsUtils.verifyRecord<ICompany>(event, 'INSERT', 'companies');

  logger.info('Created Company:');
  logger.info(newImage);

  logger.info('[COMPANY_ADDED] Updating company users if relatedPortal defined');
  // New company has been added. Check the related portal (should be null but who know)
  // Add update users favorite organization
  await updateFavoriteOrganization(newImage.relatedPortal, newImage.companyName);
};

export const handler = handle(execute);
