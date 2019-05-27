import React, { useContext, useEffect, useState } from 'react';
import classNames from 'classnames';
import Sidebar from '../Sidebar/Sidebar';
import './AppAuthenticated.css';
import Header from '../Header/Header';
import Footer from '../Footer/Footer';
import PageNotifications from '../PageNotifications/PageNotifications';
import { observer } from 'mobx-react-lite';
import { StoreContext } from '../../providers';
import Loading from '../Loading/Loading';
import CollectionPage from '../../pages/CollectionPage/CollectionPage';
import { Switch, Route } from 'react-router';
import DashboardPage from '../../pages/DashboardPage/DashboardPage';
import NotificationsPage from '../../pages/NotificationsPage/NotificationsPage';
import SettingsPage from '../../pages/SettingsPage/SettingsPage';
import CreateSubscriptionPage from '../../pages/CreateSubscriptionPage/CreateSubscriptionPage';
import ContactDialog from '../ContactDialog/ContactDialog';
import useWebsocketHandler from '../../utils/useWebsocketHandler';

const AppAuthenticated = observer(() => {
  const [loading, setLoading] = useState(true);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const { configStore, fetchAllData, authStore } = useContext(StoreContext);
  const { isMobile, showSidebar } = configStore;

  const user = authStore.user as User;

  useEffect(() => { loadData() }, []);
  useWebsocketHandler();

  const loadData = async() => {
    await fetchAllData();
    setLoading(false);
  }

  if(loading) {
    return (
      <Loading/>
    );
  }

  return (
    <div className={classNames('AppAuthenticated', {'AppAuthenticated--withSidebar': isMobile && showSidebar})}>
      <div className="AppAuthenticated-Header">
        <Header/>
      </div>

      {(!isMobile || showSidebar) &&
        <div className="AppAuthenticated-Sidebar">
          <Sidebar />
        </div>}

      <div className="AppAuthenticated-Content">
        <div className="AppAuthenticated-Wrapper">
          <PageNotifications />
          <Switch>
            <Route path="/collection/:id" component={CollectionPage} />
            <Route path="/notifications" component={NotificationsPage} />
            <Route path="/settings" component={SettingsPage} />
            {user.role === 'free' &&
              <Route path="/subscription" 
              render={(props) => (
                <CreateSubscriptionPage handleContatsOpen={() => setShowContactDialog(true)} {...props}/>
              )} />}
            <Route path="/" component={DashboardPage} />
          </Switch>
          <ContactDialog open={showContactDialog} handleClose={() => setShowContactDialog(false)}/>
        </div>
      </div>

      <div className="AppAuthenticated-Footer">
        <Footer handleOpenContacts={() => setShowContactDialog(true)} />
      </div>
    </div>
  );
});

export default AppAuthenticated;