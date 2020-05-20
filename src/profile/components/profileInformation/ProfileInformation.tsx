import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, IconFill } from 'hds-react';

import DeleteProfile from '../deleteProfile/DeleteProfile';
import LabeledValue from '../../../common/labeledValue/LabeledValue';
import DownloadData from '../downloadData/DownloadData';
import styles from './ProfileInformation.module.css';
import Explanation from '../../../common/explanation/Explanation';
import getName from '../../helpers/getName';
import getAddress from '../../helpers/getAddress';
import { MyProfileQuery } from '../../../graphql/generatedTypes';

type Props = {
  loading: boolean;
  data: MyProfileQuery;
  isEditing: boolean;
  setEditing: () => void;
};

function ProfileInformation(props: Props) {
  const { t, i18n } = useTranslation();
  const { isEditing, setEditing, loading, data } = props;

  return (
    <React.Fragment>
      <section className={styles.personalInformation}>
        <div className={styles.personalInformationTitleRow}>
          <Explanation
            variant="flush"
            className={styles.pageTitleContainer}
            main={t('profileInformation.personalData')}
            small={t('profileInformation.visibility')}
          />
          {!isEditing && (
            <Button
              variant="supplementary"
              onClick={setEditing}
              iconRight={<IconFill />}
              className={styles.edit}
            >
              {t('profileForm.edit')}
            </Button>
          )}
        </div>
        <div className={styles.storedInformation}>
          {loading && t('loading')}
          {data && !isEditing && (
            <>
              <LabeledValue
                label={t('profileInformation.name')}
                value={getName(data)}
              />
              <LabeledValue
                label={t('profileInformation.address')}
                value={getAddress(data, i18n.languages[0])}
              />
              <LabeledValue
                label={t('profileForm.language')}
                value={t(`LANGUAGE_OPTIONS.${data.myProfile?.language}`)}
              />
              <LabeledValue
                label={t('profileInformation.phone')}
                value={data.myProfile?.primaryPhone?.phone}
              />
              <LabeledValue
                label={t('profileInformation.email')}
                value={data.myProfile?.primaryEmail?.email}
              />
            </>
          )}
        </div>
      </section>
      <DownloadData />
      <DeleteProfile />
    </React.Fragment>
  );
}

export default ProfileInformation;
