import RootStore from "../store";

export const isJsonError = (e: any) => {
  return e.response && e.response.data && e.response.data.type ? true : false;
}

export const isValidationError = (e: any) => {
  return isJsonError(e) && (e.response.data as JsonError).type === 'ValidationError' ? true : false;
}

export const baseErrorHandler = (e: any, store: RootStore): JsonError | null => {
  // check if we have connection issues
  if(e.message === 'Network Error') {
    store.appNotificationStore.addFail('Could not connect to server');
  } else if(isJsonError(e)) {
    const jsonError = e.response.data as JsonError;
    
    // check for invalid auth token
    if(jsonError.type === 'InvalidAuthTokenError') {
      store.authStore.reset();
      store.appNotificationStore.addFail('Session terminated');

      // error already handled, so we're returning null
      return null;
    }

    return jsonError;
  } else {
    // unkonwn error
    store.appNotificationStore.addFail('Unknown error: ' + e.message);
  }

  return null;
}