import { validateAuthToken } from '../utils/authToken'
import { InvalidAuthTokenError } from '../utils/errors';
import { db } from '../utils/dbConnect';
import { asyncMiddleware } from '../utils/asyncMiddleware';

export const verifyJWT = asyncMiddleware(async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const { sessionUserId } = validateAuthToken(token);
    const user = await db.users.findOne(sessionUserId);

    if(!user) throw new Error();

    res.locals.user = user;
    next();
  } catch(e) {
    throw new InvalidAuthTokenError();
  }
});
