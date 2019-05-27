const AWS = require('aws-sdk');
const SparkPost = require('sparkpost');
const fs = require('fs');

// setup database
const pgp = require('pg-promise')();

// setup AWS Lambda
AWS.config.region = 'us-east-2';
const lambda = new AWS.Lambda();

// setup Sparkpost
const sparkpostClient = new SparkPost(process.env.SPARKPOST_API_KEY);

// max string length for return values
const MAX_RETURN_LENGTH = 2048;

exports.handler = async (event, context, callback) => {
  const db = pgp(process.env.DATABASE_URI);
  
  let lambdaResults = [];

  try {
    // get all active tasks that are scheduled to run now
    const tasks = await db.any(
      'SELECT * FROM tasks WHERE next_run <= $1 AND active = true ORDER BY next_run ASC', 
      [new Date()]
    );
    
    // execute each task
    const promises = tasks.map(async(task) => {
      try {
        let prevResult = null;

        // get previous result (will throw exception if not found)
        try {
          prevResult = await db.one(
            "SELECT result FROM results WHERE task_id = $1 AND is_error = false ORDER BY created_at DESC LIMIT 1", 
            task.id
          );
        } catch (e) { /* ignore */ }

        // prepare lambda task
        var params = {
          FunctionName: 'executeTask', // the lambda function we are going to invoke
          InvocationType: 'RequestResponse',
          LogType: 'Tail',
          Payload: JSON.stringify({
            code: task.code,
            prevResult: prevResult ? JSON.parse(prevResult.result) : null
          })
        };
        
        // invoke lambda task
        const lambdaResult = await lambda.invoke(params).promise();

        // calculate next_run time
        const now = new Date();
        const next_run = now.getTime() + ( task.interval * 1000 * 60 );

        // parse tasks results
        const { result, notification } = JSON.parse(lambdaResult.Payload);

        // check for result type
        if(result === undefined) {
          throw new Error("result cannot be undefined");
        }

        // check for notification variable type
        if(notification !== null && typeof notification !== 'string') {
          throw new Error("notification must be a string or null");
        }

        // check for result size
        if(JSON.stringify(result).length > MAX_RETURN_LENGTH) {
          throw new Error('result value too large');
        }

        // check for notification size
        if(JSON.stringify(notification).length > MAX_RETURN_LENGTH) {
          throw new Error('notification value too large');
        }

        if(result !== null) {
          // store result
          const insertResult = await db.one(
            "INSERT INTO results(result, task_id, user_id) VALUES($1, $2, $3) RETURNING id", 
            [JSON.stringify(result), task.id, task.user_id]
          );

          if(notification) {
            // store notification
            await db.none(
              "INSERT INTO notifications(notification, task_id, user_id, result_id) VALUES($1, $2, $3, $4)", 
              [notification, task.id, task.user_id, insertResult.id]
            );

            const user = await db.one('SELECT * FROM users WHERE id = $1', [task.user_id]);

            // send notification email
            sparkpostClient.transmissions.send({
              content: {
                from: 'no-reply@robojs.com',
                subject: `${task.name} notification`,
                html: buildEmail(
                  task.name, 
                  `<pre>${notification}</pre>`,
                  notification
                  ),
              },
              recipients: [
                {address: user.email}
              ],
              options: {
                inline_css: true
              },
            });
          }
        }

        // update next_run time
        await db.none("UPDATE tasks SET next_run = $1 WHERE id = $2", [new Date(next_run), task.id]);

        return lambdaResult;
      } catch(e) {
        // disable task
        await db.none("UPDATE tasks SET active = false WHERE id = $1", [task.id]);

        // store error
        await db.none(
          "INSERT INTO results(result, is_error, task_id, user_id) VALUES($1, $2, $3, $4)", 
          [`Error: ${e.message}`, 'true', task.id, task.user_id]
        );

        const user = await db.one('SELECT * FROM users WHERE id = $1', [task.user_id]);

        // send error notification email
        sparkpostClient.transmissions.send({
          content: {
            from: 'no-reply@robojs.com',
            subject: `Error in task ${task.name}`,
            html: buildEmail(
              task.name, 
              `<p>Your task encoutered an error and was disabled.</p><pre class="error">${e.message}</pre>`,
              e.message
              ),
          },
          recipients: [
            {address: user.email}
          ],
          options: {
            inline_css: true
          },
        });

        // throw e;
      }
    })
    
    // wait for all tasks to complete
    lambdaResults = await Promise.all(promises);
    
    // close db connection
    db.$pool.end();

    return lambdaResults;
  } catch(err) {
    context.fail(err.message);
  }
}

const buildEmail = (title, content, preheader) => {
  const template = fs.readFileSync(__dirname + '/email_template.html', 'utf8');
  return template
    .replace('!!!PLACEHOLDER_TITLE!!!', title)
    .replace('!!!PLACEHOLDER_CONTENT!!!', content)
    .replace('!!!PLACEHOLDER_PREHEADER!!!', preheader)
    .replace('!!!PLACEHOLDER_YEAR!!!', (new Date()).getFullYear())
}