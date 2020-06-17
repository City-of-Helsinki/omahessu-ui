import React from 'react';
import { useTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import { useMatomo } from '@datapunt/matomo-tracker-react';

import { RootState } from '../../../redux/rootReducer';
import { AuthState, resetApiError } from '../../redux';
import HelsinkiLogo from '../../../common/helsinkiLogo/HelsinkiLogo';
import styles from './Login.module.css';
import authenticate from '../../authenticate';
import PageLayout from '../../../common/pageLayout/PageLayout';
import Button from '../../../common/button/Button';
import NotificationComponent from '../../../common/notification/NotificationComponent';

type Props = {
  auth: AuthState;
  resetApiError: () => void;
};

function Home(props: Props) {
  const { t } = useTranslation();
  const { trackEvent } = useMatomo();

  return (
    <PageLayout hideFooterLogo={true} title={'login.login'}>
      <div className={styles.wrapper}>
        <div className={styles.content}>
          <HelsinkiLogo className={styles.logo} />
          <h1>{t('login.title')}</h1>
          <h2>{t('login.description')}</h2>
          <Button
            variant="outlined"
            className={styles.button}
            onClick={() => {
              trackEvent({ category: 'action', action: 'Log in' });
              authenticate();
            }}
          >
            {t('login.login')}
          </Button>
        </div>
      </div>
      <NotificationComponent
        show={props?.auth?.error !== null}
        onClose={() => props.resetApiError()}
      />
    </PageLayout>
  );
}

interface StateProps {
  auth: AuthState;
}

const mapStateToProps = (state: RootState): StateProps => {
  return {
    auth: state.auth,
  };
};

export default connect(mapStateToProps, { resetApiError })(Home);
