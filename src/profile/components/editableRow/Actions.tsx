import {
  Button,
  IconPenLine,
  IconMinusCircle,
  IconStarFill,
  IconStar,
} from 'hds-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';

import {
  Action,
  ActionListenerReturnType,
  EditData,
} from '../../helpers/mutationEditor';
import commonFormStyles from '../../../common/cssHelpers/form.module.css';

type Props = {
  handler: ActionHandler;
  actions: Pick<EditData, 'primary'> & {
    setPrimary: boolean;
    removable: boolean;
  };
  ariaLabels: ActionAriaLabels;
  buttonClassNames?: string;
  editButtonId?: string;
  testId: string;
  disable?: boolean;
};

export type ActionAriaLabels = {
  setPrimary?: string;
  edit?: string;
  remove?: string;
  primary?: string;
};

export type ActionHandler = (action: Action) => ActionListenerReturnType;

function Actions(props: Props): React.ReactElement {
  const {
    actions,
    handler,
    buttonClassNames,
    ariaLabels,
    editButtonId,
    disable,
    testId,
  } = props;
  const { t } = useTranslation();
  const { primary, removable, setPrimary } = actions;
  const buttonStyle = [commonFormStyles.supplementaryButton];
  const editButtonIdAttr = editButtonId ? { id: editButtonId } : undefined;
  if (buttonClassNames) {
    buttonStyle.push(buttonClassNames);
  }
  return (
    <div className={commonFormStyles.actions}>
      {setPrimary && primary && (
        <div className={commonFormStyles.primaryContainer}>
          <IconStarFill aria-hidden="true" />
          <span aria-hidden="true">{t('profileForm.primary')}</span>
          <span className={commonFormStyles.visuallyHidden}>
            {ariaLabels.primary}
          </span>
        </div>
      )}
      {setPrimary && !primary && (
        <Button
          variant="supplementary"
          iconLeft={<IconStar />}
          onClick={async () => {
            await handler('set-primary');
          }}
          className={classNames(buttonStyle)}
          aria-label={ariaLabels.setPrimary}
          disabled={disable}
          data-testid={`${testId}-set-primary-button`}
        >
          {t('profileForm.setPrimary')}
        </Button>
      )}
      <Button
        variant="supplementary"
        iconLeft={<IconPenLine />}
        onClick={async () => {
          await handler('edit');
        }}
        className={classNames(buttonStyle)}
        aria-label={ariaLabels.edit}
        disabled={disable}
        {...editButtonIdAttr}
      >
        {t('profileForm.edit')}
      </Button>
      {removable && (
        <Button
          variant="supplementary"
          iconLeft={<IconMinusCircle />}
          onClick={async () => {
            await handler('remove');
          }}
          className={classNames(buttonStyle)}
          aria-label={ariaLabels.remove}
          disabled={disable}
          data-testid={`${testId}-remove-button`}
        >
          {t('profileForm.remove')}
        </Button>
      )}
    </div>
  );
}

export default Actions;