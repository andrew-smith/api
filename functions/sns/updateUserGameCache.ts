import { gameRepository } from '../../lib/dynamoose/gameRepository';
import { userRepository } from '../../lib/dynamoose/userRepository';
import { sendSnsMessage } from '../../lib/sns';
import { loggingHandler } from '../../lib/logging';
import { Config } from '../../lib/config';
import { User, Game } from '../../lib/models';
import * as _ from 'lodash';
import * as AWS from 'aws-sdk';
const s3 = new AWS.S3();

export const handler = loggingHandler(async (event, context) => {
  const gameId = event.Records[0].Sns.Message;
  const game = await gameRepository.get(gameId);

  if (!game || !game.inProgress) {
    return;
  }

  const users = await userRepository.getUsersForGame(game);

  if (!users || !users.length) {
    return;
  }

  await updateUsers(users);

  // Send an sns message that the cache has been updated
  await sendSnsMessage(Config.resourcePrefix() + 'user-game-cache-updated', 'user-game-cache-updated', game.gameId);
});

async function updateUsers(users: User[]) {
  const gameIds = _.compact(_.uniq(_.concat(_.flatMap(users, 'activeGameIds') as string[])));
  const games = await gameRepository.batchGet(gameIds);
  await Promise.all(_.map(users, user => {
    return updateUser(user, games);
  }));
}

async function updateUser(user: User, games: Game[]) {
  const result = _.filter(games, game => {
    return _.includes(user.activeGameIds, game.gameId);
  });

  await s3.putObject({
    Bucket: Config.resourcePrefix() + 'saves',
    Key: userRepository.createS3GameCacheKey(user.steamId),
    ACL: 'public-read',
    CacheControl: 'no-cache',
    Body: JSON.stringify(result)
  }).promise();
}