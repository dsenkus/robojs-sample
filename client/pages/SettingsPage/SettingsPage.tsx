import React, { FunctionComponent, useContext } from 'react';
import PageTitle from '../../components/PageTitle/PageTitle';
import { observer } from 'mobx-react-lite';
import { StoreContext } from '../../providers';
import UpdateProfileForm from '../../components/UpdateProfileForm/UpdateProfileForm';
import ChangePasswordForm from '../../components/ChangePasswordForm/ChangePasswordForm';
import CancelSubscriptionButton from '../../components/CancelSubscriptionButton/CancelSubscriptionButton';
import DeleteAccountDialog from '../../components/DeleteAccountDialog/DeleteAccountDialog';


const SettingsPage: FunctionComponent = observer(() => {
  const { authStore } = useContext(StoreContext);
  const user = authStore.user as User;
  
  return (
    <div className="SettingsPage">
      <PageTitle title="Settings"/>
      <div className="row fg1">
        <div className="col-xs-12 col-sm-6 flex">
          <div className="item-box pa3 mb3 fg1">
            <h2 className="mt0 mb2">Change your personal data</h2>
            <UpdateProfileForm />
          </div>
        </div>

        <div className="col-xs-12 col-sm-6">
          <div className="item-box pa3 mb3">
            <h2 className="mt0 mb2">Change password</h2>
            <ChangePasswordForm/>
          </div>
        </div>
      </div>

      {user.role === 'member' &&
      <div className="item-box pa3 mb3">
        <h2 className="mt0 mb2">Cancel Subscription</h2>
        <p>Once you cancel your subscription, all your tasks will be stoped and will need to be manually restarted.</p>
        <CancelSubscriptionButton/>
      </div>}

      
      <div className="item-box pa3 mb3">
        <h2 className="mt0 mb2">Delete account</h2>
        <p>Once you delete your account, there is no going back. Please be certain.</p>
        <DeleteAccountDialog/>
      </div>
    </div>
  )
});

export default SettingsPage;