import {
  Button,
  IconPenLine,
  IconMinusCircle,
  IconStarFill,
  IconStar,
  TextInput,
} from 'hds-react';
import React, { useState } from 'react';
import { Field, Formik, FormikProps, Form } from 'formik';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';

import to from '../../../common/awaitTo';
import styles from './editableRow.module.css';
import { ActionListener, EditData } from '../../helpers/mutationEditor';
import { getFieldError, getIsInvalid } from '../../helpers/formik';
import { phoneSchema, emailSchema } from '../../../common/schemas/schemas';
import commonFormStyles from '../../../common/cssHelpers/form.module.css';

type FormikValue = { value: EditData['value'] };

type Props = { data: EditData; onAction: ActionListener };
function EditableRow(props: Props): React.ReactElement {
  const { data, onAction } = props;
  const { t } = useTranslation();
  const { value, editable, removable, status, dataType, primary } = data;
  const schema = dataType === 'phones' ? phoneSchema : emailSchema;
  const [isEditing, setEditing] = useState(status === 'new');
  const isNew = !data.profileData.id;

  const hasFieldError = (formikProps: FormikProps<FormikValue>): boolean =>
    getIsInvalid<FormikValue>(formikProps, 'value', !isNew);

  const getFieldErrorMessage = (formikProps: FormikProps<FormikValue>) =>
    getFieldError<FormikValue>(t, formikProps, 'value', {}, !isNew);

  if (isEditing) {
    return (
      <div className={styles.container}>
        <Formik
          initialValues={{
            value,
          }}
          onSubmit={async (values, actions) => {
            actions.setSubmitting(true);
            data.value = values.value;
            const [err] = await to(onAction('save', data));
            if (err) {
              actions.setSubmitting(false);
            } else if (!isNew) {
              actions.setSubmitting(false);
              setEditing(false);
            }
          }}
          validationSchema={schema}
        >
          {(formikProps: FormikProps<FormikValue>) => (
            <Form>
              <div className={styles.editableRow}>
                <Field
                  name="value"
                  id="value"
                  maxLength="255"
                  as={TextInput}
                  invalid={hasFieldError(formikProps)}
                  helperText={getFieldErrorMessage(formikProps)}
                  autoFocus
                />
                <div
                  className={classNames([
                    commonFormStyles.editActions,
                    styles.editActions,
                  ])}
                >
                  <Button
                    type="submit"
                    disabled={editable && Boolean(formikProps.isSubmitting)}
                    className={commonFormStyles.responsiveButton}
                  >
                    {t('profileForm.submit')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      await onAction('cancel', data);
                      setEditing(false);
                    }}
                    className={commonFormStyles.responsiveButton}
                  >
                    {t('profileForm.cancel')}
                  </Button>
                </div>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    );
  }
  return (
    <div className={styles.container}>
      <span className={styles.value}>{value || '–'}</span>
      <div className={styles.actions}>
        {primary && (
          <div className={styles.primaryContainer}>
            <IconStarFill />
            <span>{t('profileForm.primary')}</span>
          </div>
        )}
        {!primary && (
          <Button
            variant="supplementary"
            iconLeft={<IconStar />}
            onClick={async () => {
              await onAction('set-primary', data);
            }}
            className={commonFormStyles.supplementaryButton}
          >
            {t('profileForm.setPrimary')}
          </Button>
        )}
        {editable && (
          <Button
            variant="supplementary"
            iconLeft={<IconPenLine />}
            onClick={async () => {
              await onAction('edit', data);
              if (data.profileData.id) {
                setEditing(true);
              }
            }}
            className={commonFormStyles.supplementaryButton}
          >
            {t('profileForm.edit')}
          </Button>
        )}
        {editable && (
          <Button
            variant="supplementary"
            iconLeft={<IconMinusCircle />}
            disabled={primary || !removable}
            onClick={async () => {
              await onAction('remove', data);
            }}
            className={commonFormStyles.supplementaryButton}
          >
            {t('profileForm.remove')}
          </Button>
        )}
      </div>
    </div>
  );
}

export default EditableRow;
