import React from 'react';
import { useMutation } from '@apollo/react-hooks';
import { loader } from 'graphql.macro';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';
import styles from './EditProfile.module.css';
import responsive from '../../../common/cssHelpers/responsive.module.css';
import EditProfileForm, { FormValues } from '../editProfileForm/EditProfileForm';
import { MyProfileQuery } from '../../graphql/__generated__/MyProfileQuery';
import {
  UpdateProfile as UpdateProfileData,
  UpdateProfileVariables
} from '../../graphql/__generated__/UpdateProfile';
import {
  AddressType,
  EmailType,
  PhoneType
} from '../../../graphql/__generated__/globalTypes';
import Explanation from '../../../common/explanation/Explanation';

const UPDATE_PROFILE = loader('../../graphql/UpdateProfile.graphql');

type Props = {
  profileData: MyProfileQuery;
}

function EditProfile (props: Props) {
  const { profileData } = props;
  const { t } = useTranslation();
  const [updateProfile, { loading }] = useMutation<
    UpdateProfileData,
    UpdateProfileVariables
    >(UPDATE_PROFILE);

  const handleOnValues = (formValues: FormValues) => {
    const variables: UpdateProfileVariables = {
      profile: {
        firstName: formValues.firstName,
        lastName: formValues.lastName,
        updateEmails: [
          {
            email: formValues.email,
            primary: true,
            emailType: EmailType.OTHER
          }
        ],
        updatePhones: [
          formValues.phone
          ? {
              phone: formValues.phone,
              primary: true,
              phoneType: PhoneType.OTHER
            }
          : null
        ],
      }
    };
    updateProfile({ variables }).then(result => {
      if (result.data) {
        console.log("Updated", result.data);
      }
    })
  };

  return (
    <section className={styles.editProfile}>
      <div className={styles.editProfileTitleRow}>
        <div className={classNames(styles.font, responsive.maxWidthCentered)}>
          <Explanation
            main={t('profileInformation.personalData')}
            small={t('profileInformation.visibility')}
          />
        </div>
        <EditProfileForm
          profile={{
            firstName: profileData?.myProfile?.firstName || "",
            lastName: profileData?.myProfile?.lastName || "",
            email: profileData?.myProfile?.primaryEmail?.email || "",
            phone: profileData?.myProfile?.primaryPhone?.phone || "",
            address: profileData?.myProfile?.primaryAddress?.address || "",
            city: profileData?.myProfile?.primaryAddress?.city || "",
            postalCode: profileData?.myProfile?.primaryAddress?.postalCode || "",
          }}
          onValues={handleOnValues}
        />
      </div>
    </section>
  )
}

export default EditProfile;
