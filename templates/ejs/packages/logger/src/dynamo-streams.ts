import { DynamoDBRecord } from 'aws-lambda';
import { Converter } from 'aws-sdk/clients/dynamodb';
import { logger } from './logger';
import { v4 as uuid } from 'uuid';
import { docClient } from './document-client';
import { inspect } from 'util';

export type StreamEventType = 'INSERT' | 'MODIFY' | 'REMOVE';

export interface IStreamImages<T> {
  oldImage: T;
  newImage: T;
}

export type RecordCondition = (event: DynamoDBRecord) => boolean;

export class DynamoDBRecordsUtils {
  static verifyRecord<T>(
    event: DynamoDBRecord,
    type: StreamEventType,
    condition: string | RecordCondition,
    conditionFieldToCheck = 'sk',
  ): IStreamImages<T> {
    if (event.eventName !== type) {
      throw new Error(`Event type mismatch: expected ${type}, received ${event.eventName}`);
    }
    if (typeof condition === 'string') {
      const conditionField =
        event.dynamodb[event.eventName === 'REMOVE' ? 'OldImage' : 'NewImage'][conditionFieldToCheck].S;
      if (conditionField !== condition) {
        throw new Error(`Entity type mismatch: expected sk=${condition}, received ${conditionField}`);
      }
    } else if (!condition(event)) {
      throw new Error(`Condition failed`);
    }
    return {
      oldImage: Converter.unmarshall(event.dynamodb.OldImage) as T,
      newImage: Converter.unmarshall(event.dynamodb.NewImage) as T,
    };
  }

  static async createErrorRecord(event: DynamoDBRecord, err: unknown): Promise<void> {
    const record = {
      pk: uuid(),
      concerned_pk: event.dynamodb.Keys.pk.S,
      concerned_sk: event.dynamodb.Keys.sk.S,
      event_type_action: event.eventName,
      error: inspect(err),
      date: new Date().toISOString(),
      event: JSON.stringify(event),
    };
    try {
      await docClient
        .put({
          TableName: `dataportal_sync_errors_${process.env.env}`,
          Item: record,
        })
        .promise();
    } catch (e) {
      logger.error('FATAL ERROR: COULD NOT REGISTER SYNC ERROR', e);
    }
  }
}

export const handle = (next: (event: DynamoDBRecord) => Promise<void>): ((event: DynamoDBRecord) => Promise<void>) => {
  return async (event: DynamoDBRecord): Promise<void> => {
    try {
      await next(event);
    } catch (err) {
      logger.error('Error happened during stream execution');
      logger.debug(err);
      logger.error(event);
      // Send
      await DynamoDBRecordsUtils.createErrorRecord(event, err);
    }
  };
};
