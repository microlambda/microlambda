import { handle, logger, DynamoDBRecordsUtils } from '@dataportal/shared';
import { ICompany } from '@dataportal/types';
import { DynamoDBRecord } from 'aws-lambda';
import { updateFavoriteOrganization } from '../../utils/update-favorite-organization';

export const execute = async (event: DynamoDBRecord): Promise<void> => {
  const { oldImage, newImage } = DynamoDBRecordsUtils.verifyRecord<ICompany>(event, 'MODIFY', 'companies');

  logger.info('Updated Company:');
  logger.info(oldImage);
  logger.info(newImage);

  logger.info('[COMPANY_ADDED] Updating company users if relatedPortal defined');
  // Company has been updated.
  // If related portal has changed, update favorite organization from user that has this company as AD company.
  if (oldImage.relatedPortal !== newImage.relatedPortal) {
    await updateFavoriteOrganization(newImage.relatedPortal, newImage.companyName);
  }
};

export const handler = handle(execute);
