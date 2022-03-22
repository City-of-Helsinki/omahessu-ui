import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';

import styles from './ProfileDeleted.module.css';
import PageLayout from '../../../common/pageLayout/PageLayout';
import authService from '../../../auth/authService';
import commonContentStyles from '../../../common/cssHelpers/content.module.css';
import FocusableH1 from '../../../common/focusableH1/FocusableH1';

function ProfileDeleted(): React.ReactElement {
  const [timeUntilLogout, setTimeUntilLogout] = useState(10);
  const { t } = useTranslation();

  useEffect(() => {
    if (timeUntilLogout > 0) {
      const interval = setInterval(() => {
        setTimeUntilLogout(time => time - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      authService.logout();
      return undefined;
    }
  }, [timeUntilLogout]);

  const title = t('profileDeleted.title');
  return (
    <PageLayout title={title}>
      <div className={styles['wrapper']}>
        <div
          className={classNames([
            commonContentStyles['common-content-area'],
            commonContentStyles['common-bottom-padding'],
            styles['content'],
          ])}
        >
          <div className={styles['inner-content']}>
            <FocusableH1>{title}</FocusableH1>
            <p>{t('profileDeleted.message', { time: timeUntilLogout })}</p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default ProfileDeleted;
