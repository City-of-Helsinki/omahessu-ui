import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './ProfileDeleted.module.css';
import responsive from '../../../common/cssHelpers/responsive.module.css';
import PageLayout from '../../../common/pageLayout/PageLayout';
import authService from '../../../auth/authService';

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
      <div className={styles.wrapper}>
        <div className={responsive['max-width-centered']}>
          <div className={styles.content}>
            <h2>{title}</h2>
            <p>{t('profileDeleted.message', { time: timeUntilLogout })}</p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default ProfileDeleted;
