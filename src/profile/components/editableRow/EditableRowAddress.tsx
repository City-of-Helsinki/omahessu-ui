import { TextInput } from 'hds-react';
import React from 'react';
import { Field, Formik, FormikProps, Form } from 'formik';
import { useTranslation } from 'react-i18next';
import countries from 'i18n-iso-countries';
import classNames from 'classnames';

import { MyProfileQuery_myProfile_addresses_edges_node as Address } from '../../../graphql/generatedTypes';
import commonFormStyles from '../../../common/cssHelpers/form.module.css';
import {
  ActionListener,
  EditData,
  EditableAddress,
} from '../../helpers/mutationEditor';
import { getFieldError, getIsInvalid } from '../../helpers/formik';
import { addressSchema } from '../../../common/schemas/schemas';
import EditButtons from './EditButtons';
import Actions, { ActionAriaLabels } from './Actions';
import FormikDropdown, {
  HdsOptionType,
} from '../../../common/formikDropdown/FormikDropdown';
import getLanguageCode from '../../../common/helpers/getLanguageCode';
import LabeledValue from '../../../common/labeledValue/LabeledValue';
import getCountry from '../../helpers/getCountry';
import AccessibleFormikErrors from '../accessibleFormikErrors/AccessibleFormikErrors';
import createActionAriaLabels from '../../helpers/createActionAriaLabels';
import FocusKeeper from '../../../common/focusKeeper/FocusKeeper';
import { getFormFields } from '../../helpers/formProperties';
import SaveIndicator from '../saveIndicator/SaveIndicator';
import { useCommonEditHandling } from './useCommonEditHandling';

type FormikValues = EditableAddress;

type Props = { data: EditData; onAction: ActionListener; testId: string };

function EditableRowAddress(props: Props): React.ReactElement {
  const { data, onAction, testId } = props;
  const { profileData } = data;
  const value = data.value as EditableAddress;
  const { address, city, postalCode, countryCode } = profileData as Address;
  const { t, i18n } = useTranslation();
  const lang = i18n.languages[0];
  const applicationLanguage = getLanguageCode(i18n.languages[0]);
  const countryList = countries.getNames(applicationLanguage);
  const countryOptions = Object.keys(countryList).map(key => ({
    value: key,
    label: countryList[key],
  }));
  const dataType = 'addresses';
  const formFields = getFormFields(dataType);

  const {
    autoFocusTargetId,
    isNewItem,
    isEditing,
    currentSaveAction,
    actionHandler,
  } = useCommonEditHandling({ data, onAction, testId });

  const hasFieldError = (
    formikProps: FormikProps<FormikValues>,
    type: keyof FormikValues
  ): boolean => getIsInvalid<FormikValues>(formikProps, type, !isNewItem);

  const getFieldErrorMessage = (
    formikProps: FormikProps<FormikValues>,
    type: keyof FormikValues
  ) => getFieldError<FormikValues>(t, formikProps, type, !isNewItem);

  const ariaActionLabels: ActionAriaLabels = createActionAriaLabels(data, t);

  const { primary } = data;

  if (isEditing) {
    return (
      <Formik
        initialValues={{
          address,
          city,
          postalCode,
          countryCode,
          primary: !!primary,
        }}
        onSubmit={async (values, actions) => {
          data.value = values;
          await actionHandler('save');
        }}
        validationSchema={addressSchema}
      >
        {(formikProps: FormikProps<FormikValues>) => (
          <Form className={commonFormStyles.multiItemForm}>
            <h4 className={commonFormStyles.sectionTitle}>
              {primary
                ? t('profileInformation.primaryAddress')
                : t('profileInformation.address')}
            </h4>
            <FocusKeeper targetId={`${testId}-address`}>
              <div className={commonFormStyles.multiItemWrapper}>
                <Field
                  name="address"
                  id={`${testId}-address`}
                  maxLength={formFields.address.max as number}
                  as={TextInput}
                  invalid={hasFieldError(formikProps, 'address')}
                  helperText={getFieldErrorMessage(formikProps, 'address')}
                  labelText={t(formFields.address.translationKey)}
                  autoFocus
                  aria-labelledby={`${dataType}-address-helper`}
                />
                <Field
                  name="postalCode"
                  id={`${testId}-postalCode`}
                  maxLength={formFields.postalCode.max as number}
                  as={TextInput}
                  invalid={hasFieldError(formikProps, 'postalCode')}
                  helperText={getFieldErrorMessage(formikProps, 'postalCode')}
                  labelText={t(formFields.postalCode.translationKey)}
                  aria-labelledby={`${dataType}-postalCode-helper`}
                />
                <Field
                  name="city"
                  id={`${testId}-city`}
                  maxLength={formFields.city.max as number}
                  as={TextInput}
                  invalid={hasFieldError(formikProps, 'city')}
                  helperText={getFieldErrorMessage(formikProps, 'city')}
                  labelText={t(formFields.city.translationKey)}
                  aria-labelledby={`${dataType}-city-helper`}
                />
                <FormikDropdown
                  className={commonFormStyles.formField}
                  name="countryCode"
                  id={`${testId}-countryCode`}
                  options={countryOptions}
                  label={t(formFields.country.translationKey)}
                  default={countryCode}
                  onChange={option =>
                    formikProps.setFieldValue(
                      'countryCode',
                      (option as HdsOptionType).value
                    )
                  }
                />
              </div>
              <AccessibleFormikErrors
                formikProps={formikProps}
                dataType={dataType}
              />
              <EditButtons
                handler={actionHandler}
                disabled={!!currentSaveAction}
                testId={testId}
                alignLeft
              />
            </FocusKeeper>
            <SaveIndicator currentAction={currentSaveAction} />
          </Form>
        )}
      </Formik>
    );
  }
  return (
    <div
      className={classNames([
        commonFormStyles.contentWrapper,
        commonFormStyles.multiItemContentWrapper,
      ])}
    >
      <h4 className={commonFormStyles.sectionTitle}>
        {primary
          ? t('profileInformation.primaryAddress')
          : t('profileInformation.address')}
      </h4>
      <div className={commonFormStyles.multiItemWrapper}>
        <LabeledValue
          label={t(formFields.address.translationKey)}
          value={value.address}
          testId={`${testId}-address`}
        />
        <LabeledValue
          label={t(formFields.postalCode.translationKey)}
          value={value.postalCode}
          testId={`${testId}-postalCode`}
        />
        <LabeledValue
          label={t(formFields.city.translationKey)}
          value={value.city}
          testId={`${testId}-city`}
        />
        <LabeledValue
          label={t(formFields.country.translationKey)}
          value={getCountry(value.countryCode, lang)}
          testId={`${testId}-countryCode`}
        />
      </div>
      <div className={commonFormStyles.actionsWrapper}>
        <Actions
          handler={actionHandler}
          actions={{
            removable: !primary,
            primary,
            setPrimary: true,
          }}
          buttonClassNames={commonFormStyles.actionsWrapperButton}
          ariaLabels={ariaActionLabels}
          editButtonId={autoFocusTargetId}
          disable={!!currentSaveAction}
          testId={testId}
        />
        <SaveIndicator currentAction={currentSaveAction} />
      </div>
    </div>
  );
}

export default EditableRowAddress;
