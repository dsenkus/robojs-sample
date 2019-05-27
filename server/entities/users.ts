import * as yup from 'yup';
import * as bcrypt from 'bcrypt';
import { db } from '../utils/dbConnect';

export const canEnableTask = async (user, taskId) => {
  const activeTaskCount = await db.tasks.count({
    'id !=': taskId ,
    active: true,
    user_id: user.id,
  });

  // 3 active tasks for free account and 30 for premium
  return user.role !== 'member' ? activeTaskCount < 3 : activeTaskCount < 30;
};

// -----------------------------------------------------------------------------
// Validation Schemas
// -----------------------------------------------------------------------------

const userPasswordValidator = yup.string().required().min(5).max(256);
const userEmailValidator = yup.string().required().email().max(256).test({
  name: 'taken',
  message: 'email already taken',
  test: async (value: any) => {
    // check if email already taken
    const userExists = await db.users.count({ email: value });
    return userExists < 1;
  }
});
const userOldPasswordValidator = (user) => {
  return yup.string().required().test({
    name: 'match',
    message: 'password is incorrect',
    test: async (value: any) => {
      return await bcrypt.compare(value, user.password)
    }
  });
}

export const userCreateSchema = yup.object().shape({
  name: yup.string().required().min(5).max(256),
  email: userEmailValidator,
  password: userPasswordValidator,
});

export const userUpdateSchema = yup.object().shape({
  name: yup.string().required().min(5).max(256),
});

export const userPasswordChangeSchema = yup.object({
  password: userPasswordValidator
});

export const userPasswordChangeSchemaFull = (user) => yup.object({
  password: userPasswordValidator,
  old_password: userOldPasswordValidator(user),
  confirm_password: yup.string().oneOf([yup.ref('password'), ''], 'passwords do not match')
    .required('confirm password is required')
});

export const userDeleteAccountSchema = (user) => yup.object({
  password: userOldPasswordValidator(user),
});

export const userEmailSchema = yup.object({
  email: yup.string().required().email().test({
    name: 'exist',
    message: 'user with this email does not exist',
    test: async (value: any) => {
      // check if email exists in system
      const userExists = await db.users.count({ email: value });
      return userExists > 0;
    }
  }),
})
