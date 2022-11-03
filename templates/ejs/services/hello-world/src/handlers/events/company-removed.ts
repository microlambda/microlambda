import { handle, logger, DynamoDBRecordsUtils } from '@dataportal/shared';
import { ICompany } from '@dataportal/types';
import { DynamoDBRecord } from 'aws-lambda';
import { updateFavoriteOrganization } from '../../utils/update-favorite-organization';

export const execute = async (event: DynamoDBRecord): Promise<void> => {
  const { oldImage } = DynamoDBRecordsUtils.verifyRecord<ICompany>(event, 'REMOVE', 'companies');

  logger.info('Removed Company:');
  logger.info(oldImage);

  logger.info('[COMPANY_REMOVED] Updating category');
  // Company has been removed.
  // Remove favorite organization from user that has this company as AD company.
  if (oldImage && oldImage.companyName) {
    await updateFavoriteOrganization(null, oldImage.companyName);
  }
};

export const handler = handle(execute);
