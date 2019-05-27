import React, { FunctionComponent, useContext } from 'react';
import PageTitle from '../../components/PageTitle/PageTitle';
import { distanceInWords } from 'date-fns';
import LinkButton from '../../components/LinkButton/LinkButton';
import ResultCode from '../../components/ResultCode/ResultCode';
import { Link } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { StoreContext } from '../../providers';
import TaskNotificationsMarkReadBtn from '../../components/TaskNotificationMarkReadBtn/TaskNotificationMarkReadBtn';

const DashboardPage: FunctionComponent = observer(() => {  
  const { taskStore, taskNotificationStore } = useContext(StoreContext);
  const tasks = taskStore.tasksSortedByLatestResultWithCollection;
  const notifications = taskNotificationStore.getAllUnreadWithTask;

  return (
    <div className="DashboardPage">
      <PageTitle title="Dashboard"/>

      <div className="row">
        <div className="col-xs-12 col-md-6">
          <h2 className="mt0">Latest Results</h2>

          {tasks.length === 0 &&
            <div className="tc i b pv4 moon-gray">No Results</div>}

          {tasks.map(task => {
            if (!task.result || !task.collection) { return null; }
            return (
              <div key={task.id} className="item-box pa3 mb3">
                <h3 className="ma0 dark-gray mb2">
                  {task.name} in <Link className="fw3 underline dark-gray" to={`/collection/${task.collection_id}`}>
                    {task.collection.name}
                  </Link>
                </h3>
                <div className="gray f7 mb2">
                  <strong>{distanceInWords(task.result.created_at, new Date())} ago</strong>
                </div>
                <ResultCode result={task.result} />
              </div>
            );
          })}
        </div>
        <div className="col-xs-12 col-md-6">
          <div className="flex items-top">
            <h2 className="fg1 mt0">Latest Notifications</h2>
            <div>
              <LinkButton
                to="/notifications"
                disabled={notifications.length === 0}
                text="Show All"/>
            </div>
          </div>

          {notifications.length === 0 &&
            <div className="tc i b pv4 moon-gray">No Active Notifications</div>}

          {notifications.map(notification => (
            <div key={notification.id} className="item-box pa3 mb3">
              <div className="flex items-start">
                <div className="fg1">
                  <h3 className="ma0 dark-gray mb2">
                    {notification.task.name}
                  </h3>
                  <div className="gray f7 mb2">
                    <strong>{distanceInWords(notification.created_at, new Date())} ago</strong>
                  </div>
                </div>
                <TaskNotificationsMarkReadBtn id={notification.id}/>
              </div>
              <code className="code code--notification">{notification.notification}</code>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
});

export default DashboardPage;