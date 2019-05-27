import { Request, Response, Router } from 'express';
import { asyncMiddleware } from '../utils/asyncMiddleware';
import { db } from '../utils/dbConnect';
import { verifyJWT } from '../middlewares/verifyJWT';
import { taskCreateSchema, taskUpdateSchema } from '../entities/tasks';
import { UnprocessableEntityError, NotFoundError, TasksLimitExceededError } from '../utils/errors';
import { canEnableTask } from '../entities/users';

const router = Router();

router.all('*', verifyJWT);

const codeTemplate = `/* Each task is expected to return object of fallowing structure: 
 * { result, notification }
 * 
 * "result" supports any value that can be encoded to JSON format. When 
 * "result" is null, it will not be written to database and will be ignored.
 * Any other value (including 0 and false) will be written to database and 
 * available to you in subsequent runs via "prevResult" variable.
 * 
 * "notification" can be either null or string. When "notification" is null, it
 * will be ignored and will not be written to database, no email will be sent 
 * for such values. When "notification" is string, it will be written to 
 * database and email will be sent to you containing new notification value.
 * 
 * Following variables are available to be used in this task:
 * - prevResult, contains value of latest result in database
 * - fetch (https://www.npmjs.com/package/node-fetch), 
 * - cheerio (https://cheerio.js.org/) */

let notification = null
let result = null

module.exports = (async () => {
  return { result, notification }
})()
`;

// -----------------------------------------------------------------------------
// GET /api/tasks:: Get User Tasks
// -----------------------------------------------------------------------------

router.get('/', asyncMiddleware(async (req: Request, res: Response) => {
  const { user } = res.locals;

  // get collections
  let tasks = await db.tasks.find({ user_id: user.id });

  tasks = tasks.map(async (task) => {
    const result = await db.results.findOne({ task_id: task.id }, {
      order: [{
        field: 'created_at',
        direction: 'desc'
      }]
    });
    return {
      ...task,
      result
    };
  });

  tasks = await Promise.all(tasks);

  res.json(tasks);
}));


// -----------------------------------------------------------------------------
// POST /api/tasks:: Create Task
// -----------------------------------------------------------------------------

router.post('/', asyncMiddleware(async (req: Request, res: Response) => {
  const { user } = res.locals;
  await taskCreateSchema(user).validate(req.body, { abortEarly: false });

  // create task
  const { name, description, interval, collection_id } = req.body;

  const task = await db.tasks.insert({
    active: false,
    code: codeTemplate,
    name,
    description,
    interval,
    next_run: new Date(),
    collection_id,
    user_id: user.id,
  });

  if (!task) throw new UnprocessableEntityError();

  res.status(201).json(task);
}));

// -----------------------------------------------------------------------------
// PUT /api/tasks/:id :: Update User Task
// -----------------------------------------------------------------------------

router.put('/:id', asyncMiddleware(async (req: Request, res: Response) => {
  const { user } = res.locals;
  const { id } = req.params;
  const data = req.body;

  // if enabling task, check for tasks limits
  if(data['active'] === true && !await canEnableTask(user, id)) {
    throw new TasksLimitExceededError();
  }

  await taskUpdateSchema(user).validate(data, { abortEarly: false });

  // run task if requested (or task enabled)
  if(data.active === true) {
    // set to past date
    data['next_run'] = new Date(0);
  }

  const task = await db.tasks.update({
    id,
    user_id: user.id
  }, data);

  if (!task) throw new UnprocessableEntityError();

  res.json(task[0]);
}));

// -----------------------------------------------------------------------------
// DELETE /api/tasks/:id :: Delete User Task
// -----------------------------------------------------------------------------

router.delete('/:id', asyncMiddleware(async (req: Request, res: Response) => {
  const { user } = res.locals;
  const { id } = req.params;

  await db.tasks.destroy({
    id,
    user_id: user.id,
  })

  res.json({});
}));

// -----------------------------------------------------------------------------
// GET /api/tasks/:id:: Get Task
// -----------------------------------------------------------------------------

router.get('/:id', asyncMiddleware(async (req: Request, res: Response) => {
  const { user } = res.locals;
  const { id } = req.params;

  const task = await db.tasks.findOne({
    id: id,
    user_id: user.id,
  });

  if(!task) {
    throw new NotFoundError();
  }

  const result = await db.results.findOne({ task_id: id }, {
    order: [{
      field: 'created_at',
      direction: 'desc'
    }]
  });

  res.json({
    ...task,
    result
  });
}));

// -----------------------------------------------------------------------------
// GET /api/tasks/:id/results :: Get Task Results
// -----------------------------------------------------------------------------

router.get('/:id/results', asyncMiddleware(async (req: Request, res: Response) => {
  const { user } = res.locals;
  const { id } = req.params;

  let results = await db.results.find({
    task_id: id,
    user_id: user.id,
  }, {
    order: [{
      field: 'created_at',
      direction: 'desc'
    }]
  })

  results = results.map(async (result) => {
    const notification = await db.notifications.findOne({ result_id: result.id });
    return {
      ...result,
      notification
    }
  })

  results = await Promise.all(results);

  res.json(results);
}));

// -----------------------------------------------------------------------------
// GET /api/tasks/:id/notifications :: Get Task Notifications
// -----------------------------------------------------------------------------

router.get('/:id/notifications', asyncMiddleware(async (req: Request, res: Response) => {
  const { user } = res.locals;
  const { id } = req.params;

  const notifications = await db.notifications.find({
    task_id: id,
    user_id: user.id,
  }, {
    order: [{
      field: 'created_at',
      direction: 'desc'
    }]
  })

  res.json(notifications);
}));

export default router;