import React, { useRef, useContext, useEffect } from 'react';
import { StoreContext } from '../providers';

interface ConnectOpts {
  isReconnect: boolean
}

const useWebsocketHandler = () => {
  const rootStore = useContext(StoreContext);
  const { authStore, taskNotificationStore, taskStore, collectionStore } = rootStore;
  const ws = useRef<WebSocket | null>(null);
  const reconnectInterval = useRef<NodeJS.Timer | null>(null); 

  const token = authStore.token;
  const url = process.env.REACT_APP_WS_URL;

  useEffect(() => {
    connect({ isReconnect: false });

    // disconnect when closing tab
    window.addEventListener('beforeunload', () => {
      disconnect();
    });

    // disconnect on unmount
    return disconnect;
  }, []);
  
  /**
   * check for unitentionally closed webscocket connection and reconnect
   */
  const resetInterval = () => {
    if(reconnectInterval.current) {
      clearInterval(reconnectInterval.current);
    }

    reconnectInterval.current = setInterval(() => {
      if(ws.current && ws.current.readyState === WebSocket.CLOSED) {
        connect({ isReconnect: true }); 
      }
  
    }, 5000);
  }
  
  const connect = ({ isReconnect }: ConnectOpts) => {
    console.log('Websocket: connect()');
    if(!token || !url) { return; }
    ws.current = new WebSocket(url);
    if (!ws.current) { return; }
  
    // authenticate when connected
    ws.current.onopen = function() {
      console.log('Websocket: connected');

      if(isReconnect) {
        console.log('reloading data...');
        rootStore.fetchAllData();
      }

      const authenticationMsg = JSON.stringify({
        type: 'authenticate',
        payload: { token }
      });

      this.send(authenticationMsg);
    }
  
    // handle websocket messages
    ws.current.onmessage = function(ev: MessageEvent) {
      const data: WebSocketResult = JSON.parse(ev.data);
      console.log(`Websocket: received ${data.type}=>${data.action}`);
  
      switch (data.type) {
        case 'collection':
          if(data.action === 'insert') {
            collectionStore.addToStore(data.payload);
          } else if (data.action ==='update') {
            collectionStore.updateInStore(data.payload);
          } else if (data.action ==='delete') {
            collectionStore.removeFromStore(data.payload.id);
          }
          break;
  
        case 'task':
          if(data.action === 'insert') {
            taskStore.addToStore(data.payload);
          } else if (data.action ==='update') {
            taskStore.updateInStore(data.payload);
          } else if (data.action ==='delete') {
            taskStore.removeFromStore(data.payload.id);
          }
          break;
  
        case 'result':
          if(data.action === 'insert') {
            taskStore.updateTaskResultInStore(data.payload);
          } else if (data.action ==='update') {
            // ignore, since results should never be edited
          } else if (data.action ==='delete') {
            taskStore.removeTaskResultFromStore(data.payload.id);
          }
          break;
  
        case 'notification':
          if(data.action === 'insert') {
            taskNotificationStore.addToStore(data.payload);
          } else if(data.action === 'update') {
            const notification = data.payload as TaskNotification;
            if(notification.is_read) {
              taskNotificationStore.removeFromStore(notification.id);
            }
          } else if(data.action === 'delete') {
            taskNotificationStore.removeFromStore(data.payload.id);
          }
          break;

        case 'user':
          if(data.action === 'update') {
            const user = data.payload as User;
            authStore.setUser(user);
          } else if(data.action === 'delete') {
            authStore.reset();
          }
          break;
      }
    }
  
    // recreate socket if closed unintentionally
    ws.current.onclose = function(ev: CloseEvent) {
      console.log('Websocket: closed');
      connect({ isReconnect: true });
    }
  
    resetInterval();
  }
  
  /**
   * disconnect webscoket from server
   */
  const disconnect = () => {
    console.log('Websocket: disconnect()')

    // remove reconnect checker
    if(reconnectInterval.current) {
      clearInterval(reconnectInterval.current);
    }
  
    if (ws.current) {
      // disable reconnect listener
      ws.current.onclose = null;
  
      const closeMsg = JSON.stringify({
        type: 'close',
        payload: { token }
      });

      ws.current.send(closeMsg)
    }
  }
}

export default useWebsocketHandler;