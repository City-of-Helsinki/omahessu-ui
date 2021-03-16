import React, { PropsWithChildren } from 'react';
import { NotificationType } from 'hds-react';
import { useTranslation } from 'react-i18next';

import Notification from '../copyOfHDSNotification/Notification';
import styles from './NotificationComponent.module.css';

type Props = PropsWithChildren<{
  show: boolean;
  labelText?: string;
  type?: NotificationType;
  onClose?: () => void;
}>;

function NotificationComponent(props: Props): React.ReactElement | null {
  const { t } = useTranslation();
  if (!props.show) {
    return null;
  }
  return (
    <div className={styles.notification}>
      <Notification
        dismissible
        type={props.type || 'error'}
        label={props.labelText || t('notification.defaultErrorTitle')}
        closeButtonLabelText={t('notification.closeButtonText') || ''}
        onClose={props.onClose}
      >
        <div className={styles.messageWrapper}>
          {props.children || t('notification.defaultErrorText')}
        </div>
      </Notification>
    </div>
  );
}

export default NotificationComponent;
