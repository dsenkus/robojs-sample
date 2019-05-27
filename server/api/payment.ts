import { Request, Response, Router } from 'express';
import { asyncMiddleware } from '../utils/asyncMiddleware';
import { db } from '../utils/dbConnect';
import { verifyJWT } from '../middlewares/verifyJWT';
import { createCustomer, createSubscription, createPaymentMethod, cancelSubscription, braintreeConnect } from '../utils/braintree';
import { getFirstName, getLastName } from '../utils/name';
import { ApplicationError } from '../utils/errors';
import * as braintree from 'braintree';
import { sendPremiumSubscribeEmail } from '../emails/premiumSubscribeEmail';
import { sendPremiumCancelEmail } from '../emails/premiumCancelEmail';

const router = Router();

// router.all('*', verifyJWT);

// -----------------------------------------------------------------------------
// POST /api/payments :: Subscribe to Stripe recurring payment
// -----------------------------------------------------------------------------

router.post('/', verifyJWT, asyncMiddleware(async (req: Request, res: Response) => {
  let { user } = res.locals;
  const { nonce } = req.body;

  let braintree_customer_id;
  let braintree_payment_method_token

  // create braintree customer profile if necessary
  if(!user.braintree_customer_id) {
    const { customer } = await createCustomer(
      getFirstName(user.name), 
      getLastName(user.name), 
      user.email,
      nonce
    );
    braintree_customer_id = customer.id;
    braintree_payment_method_token = customer.paymentMethods[0].token;
  } else {
    braintree_customer_id = user.braintree_customer_id;
    // create braintree payment method
    const paymentMethod = await createPaymentMethod(braintree_customer_id, nonce);
    braintree_payment_method_token = paymentMethod.creditCard.token;
  }

  // check if we have all required payment data
  if(!braintree_customer_id || !braintree_payment_method_token) {
    throw new ApplicationError('Payment gateway error');
  }

  try {
    const { subscription } = await createSubscription(braintree_payment_method_token, process.env.BRAINTREE_PLAN_ID);

    user = await db.users.update(user.id, {
      braintree_customer_id,
      braintree_payment_method_token,
      braintree_subscription_id: subscription.id,
      role: 'member',
    });

    sendPremiumSubscribeEmail(user);

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (e) {
    throw new ApplicationError('Payment gateway error');
  }
}));

router.delete('/', verifyJWT, asyncMiddleware(async (req: Request, res: Response) => {
  let { user } = res.locals;

  if(user.braintree_subscription_id) {
    await cancelSubscription(user.braintree_subscription_id);
    user = await db.users.update(user.id, {
      braintree_payment_method_token: null,
      braintree_subscription_id: null,
      role: 'free',
    });

    // stop all user tasks
    await db.tasks.update({ user_id: user.id }, { active: false });

    sendPremiumCancelEmail(user);
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
}));

const BRAINTREE_SUBSCRIPTION_FAIL_STATUSES = [
  braintree.WebhookNotification.Kind.SubscriptionCanceled,
  braintree.WebhookNotification.Kind.SubscriptionExpired,
];

router.post('/webhooks', asyncMiddleware(async (req: Request, res: Response) => {
  const { bt_signature, bt_payload } = req.body;

  const gateway = braintreeConnect();

  const notification = await gateway.webhookNotification.parse(bt_signature, bt_payload);

  // subscription canceled/expired
  if(BRAINTREE_SUBSCRIPTION_FAIL_STATUSES.indexOf(notification.kind) !== -1) {
    const subscription_id = notification.subject.subscription.id;
    const owner = await db.users.findOne({
      braintree_subscription_id: subscription_id
    });

    if(owner) {
      // disable member subscription
      // TODO send email to admin@robojs.com with failed subscription data
      await db.users.update(owner.id, {
        role: 'free'
      });

      sendPremiumCancelEmail(owner);
    }
  }

  res.status(200).send();
}));

export default router;