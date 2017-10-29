import { Config } from '../../lib/config';
import { loggingHandler } from '../../lib/logging';
import * as AWS from 'aws-sdk';
import * as _ from 'lodash';
const s3 = new AWS.S3();

const TURNS_TO_SAVE = 40;

export const handler = loggingHandler(async (event, context) => {
  const gameId = event.Records[0].Sns.Message;
  const resp = await s3.listObjectsV2({
    Bucket: Config.resourcePrefix() + 'saves',
    Prefix: gameId
  }).promise();

  if (!resp || !resp.Contents) {
    throw new Error(`No data returned for listObjectsV2, prefix: ${gameId}`);
  }

  if (resp.Contents.length > TURNS_TO_SAVE) {
    await s3.deleteObjects({
      Bucket: Config.resourcePrefix() + 'saves',
      Delete: {
        Objects: _.chain(resp.Contents)
          .orderBy(['Key'], ['asc'])
          .take(resp.Contents.length - TURNS_TO_SAVE)
          .map(obj => {
            return {
              Key: obj.Key
            }
          })
          .value()
      }
    }).promise();
  }
});
