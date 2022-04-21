import React from 'react';
import { act } from '@testing-library/react';
import fetchMock from 'jest-fetch-mock';
import countries from 'i18n-iso-countries';

import {
  cloneProfileAndProvideManipulationFunctions,
  getMyProfile,
  getProfileDataWithoutSomeNodes,
} from '../../../../common/test/myProfileMocking';
import {
  renderComponentWithMocksAndContexts,
  TestTools,
  cleanComponentMocks,
  WaitForElementAndValueProps,
  ElementSelector,
  submitButtonSelector,
  waitForElementAttributeValue,
  waitForElementFocus,
} from '../../../../common/test/testingLibraryTools';
import { AddressNode, ProfileData } from '../../../../graphql/typings';
import AddressEditor from '../AddressEditor';
import {
  MockedResponse,
  ResponseProvider,
} from '../../../../common/test/MockApolloClientProvider';
import { AddressValue, EditDataType } from '../../../helpers/editData';
import i18n from '../../../../common/test/testi18nInit';
import RenderChildrenWhenDataIsComplete from '../../../../common/test/RenderChildrenWhenDataIsComplete';
import getAddressesFromNode from '../../../helpers/getAddressesFromNode';

describe('<AddressEditor /> ', () => {
  type AddressValueKey = keyof AddressValue;
  type DataSource = Partial<AddressValue | AddressNode>;
  const responses: MockedResponse[] = [];
  const initialProfile = getMyProfile().myProfile as ProfileData;
  const renderTestSuite = () => {
    const responseProvider: ResponseProvider = () =>
      responses.shift() as MockedResponse;
    return renderComponentWithMocksAndContexts(
      responseProvider,
      <RenderChildrenWhenDataIsComplete>
        <AddressEditor />
      </RenderChildrenWhenDataIsComplete>
    );
  };
  const dataType: EditDataType = 'addresses';

  const selectors: Record<string, ElementSelector> = {
    editButton: { id: `${dataType}-edit-button` },
    addButton: { id: `${dataType}-add-button` },
    removeButton: { id: `${dataType}-remove-button` },
    confirmRemovalButton: {
      testId: 'confirmation-modal-confirm-button',
    },
    noDataText: {
      testId: `${dataType}-no-data`,
    },
    cancelButton: {
      testId: `${dataType}-cancel-button`,
    },
  };

  const validAddressValues: AddressValue = {
    address: 'test-address',
    city: 'test-city',
    postalCode: '99999',
    countryCode: 'DE',
  };

  const invalidAddressValues: AddressValue = {
    address: '',
    city: '',
    postalCode: '',
    countryCode: '',
  };

  const newAddressValues: AddressValue = {
    address: 'test-address-2',
    city: 'my-city',
    postalCode: '00001',
    countryCode: 'SV',
  };

  const fields = Object.keys(validAddressValues) as AddressValueKey[];
  const t = i18n.getFixedT('fi');
  const countryList = countries.getNames(i18n.language);

  const getProfileWithoutAddresses = () =>
    getProfileDataWithoutSomeNodes({
      noNodes: true,
      dataType,
    });

  const getProfileWithAddress = (address: AddressValue) =>
    cloneProfileAndProvideManipulationFunctions(getProfileWithoutAddresses())
      .add(dataType, { ...address, id: '666', primary: true })
      .getProfile();

  beforeEach(() => {
    responses.length = 0;
  });
  afterEach(() => {
    cleanComponentMocks();
  });

  const getFieldValueSelector = (
    field: AddressValueKey,
    targetIsInput = false
  ): ElementSelector => {
    if (field === 'countryCode' && targetIsInput) {
      return {
        id: `${dataType}-${field}-input`,
      };
    }
    return targetIsInput
      ? {
          id: `${dataType}-${field}`,
        }
      : { testId: `${dataType}-${field}-value` };
  };

  const convertFieldValue = (
    source: DataSource,
    field: AddressValueKey
  ): string => {
    const value = source[field];
    if (field !== 'countryCode') {
      return value || '';
    }
    if (!value) {
      return '';
    }
    return countryList[value] || '';
  };

  const verifyValuesFromElements = async (
    testTools: TestTools,
    source: DataSource,
    targetIsInput = false
  ) => {
    const { getTextOrInputValue } = testTools;
    for (const field of fields) {
      const expectedValue = convertFieldValue(source, field);
      await expect(
        getTextOrInputValue(getFieldValueSelector(field, targetIsInput))
      ).resolves.toBe(expectedValue);
    }
  };

  const setValuesToInputs = async (
    testTools: TestTools,
    source: DataSource
  ) => {
    const { setInputValue, comboBoxSelector, getTextOrInputValue } = testTools;
    for (const field of fields) {
      const newValue = convertFieldValue(source, field);
      if (field === 'countryCode') {
        // comboBoxSelector will throw an error if attempting to set a value which is already set
        const currentValue = await getTextOrInputValue(
          getFieldValueSelector(field, true)
        );
        if (currentValue !== newValue) {
          await comboBoxSelector(`${dataType}-${field}`, newValue);
        }
      } else {
        await setInputValue({
          selector: getFieldValueSelector(field, true),
          newValue,
        });
      }
    }
  };

  const initTests = async (
    profileData: ProfileData = initialProfile
  ): Promise<TestTools> => {
    responses.push({ profileData });
    const testTools = await renderTestSuite();
    await testTools.fetch();
    return Promise.resolve(testTools);
  };

  const initialAddressInProfile = getAddressesFromNode(
    { myProfile: initialProfile },
    true
  )[0];

  it("renders user's address - also in edit mode", async () => {
    await act(async () => {
      const testTools = await initTests();
      const { clickElement } = testTools;
      await verifyValuesFromElements(testTools, initialAddressInProfile);
      // goto edit mode
      await clickElement(selectors.editButton);
      await verifyValuesFromElements(testTools, initialAddressInProfile, true);
    });
  });
  it(`sends updated data and returns to view mode when saved. 
      Shows save notifications. 
      Focus is returned to edit button`, async () => {
    await act(async () => {
      const testTools = await initTests();
      const { clickElement, submit, getElement } = testTools;
      await clickElement(selectors.editButton);
      await setValuesToInputs(testTools, newAddressValues);

      // create graphQL response for the update
      const updatedProfileData = cloneProfileAndProvideManipulationFunctions(
        initialProfile
      )
        .edit(dataType, { ...initialAddressInProfile, ...newAddressValues })
        .getProfile();

      // add the graphQL response
      responses.push({
        updatedProfileData,
      });

      const waitForOnSaveNotification: WaitForElementAndValueProps = {
        selector: { testId: `${dataType}-save-indicator` },
        value: t('notification.saving'),
      };

      const waitForAfterSaveNotification: WaitForElementAndValueProps = {
        selector: { id: `${dataType}-edit-notifications` },
        value: t('notification.saveSuccess'),
      };
      // submit and wait for "saving" and 'saveSuccess' notifications
      await submit({
        waitForOnSaveNotification,
        waitForAfterSaveNotification,
      });
      // verify new values are visible
      await verifyValuesFromElements(testTools, newAddressValues);
      // focus is set to edit button
      await waitForElementFocus(() => getElement(selectors.editButton));
    });
  });

  it('on send error shows error notification and stays in edit mode. Cancel-button resets data', async () => {
    await act(async () => {
      const testTools = await initTests();
      const { clickElement, submit } = testTools;
      await clickElement(selectors.editButton);
      await setValuesToInputs(testTools, newAddressValues);

      // add the graphQL response
      responses.push({
        errorType: 'networkError',
      });

      const waitForAfterSaveNotification: WaitForElementAndValueProps = {
        selector: { id: `${dataType}-edit-notifications` },
        value: t('notification.saveError'),
      };

      // submit and wait for saving and error notifications
      await submit({
        waitForAfterSaveNotification,
        skipDataCheck: true,
      });

      // input fields are still rendered
      await verifyValuesFromElements(testTools, newAddressValues, true);
      // cancel edits
      await clickElement({
        testId: `${dataType}-cancel-button`,
      });
      // values are reset to previous values
      await verifyValuesFromElements(testTools, initialAddressInProfile);
    });
  });
  it('trying to save unchanged data does not send requests or show notifications', async () => {
    await act(async () => {
      const testTools = await initTests();
      const { clickElement, getElement } = testTools;
      // initial profile has been fetched
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await clickElement(selectors.editButton);
      await setValuesToInputs(testTools, initialAddressInProfile);
      await clickElement(submitButtonSelector);
      // save indicator is not shown
      expect(() =>
        getElement({ testId: `${dataType}-save-indicator` })
      ).toThrow();
      // success notification is not shown
      expect(() =>
        getElement({ id: `${dataType}-edit-notifications` })
      ).toThrow();
      // focus is set to edit button
      await waitForElementFocus(() => getElement(selectors.editButton));
      // same value is still shown
      await verifyValuesFromElements(testTools, initialAddressInProfile);
      // new requests haven't been done
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  fields.forEach(async field => {
    it(`invalid value for ${field} is indicated and setting a valid value removes the error`, async () => {
      const testTools = await initTests();
      const {
        clickElement,
        setInputValue,
        getElement,
        comboBoxSelector,
      } = testTools;
      await act(async () => {
        const fieldValueSelector = getFieldValueSelector(field, true);
        await clickElement(selectors.editButton);
        const elementGetter = () => getElement(fieldValueSelector);
        const errorElementGetter = () =>
          getElement({ id: `${dataType}-${field}-error` });
        const errorListElementGetter = () =>
          getElement({ testId: `${dataType}-error-list` });

        const invalidValues = {
          ...validAddressValues,
          ...{ [field]: invalidAddressValues[field] },
        };
        // set invalid values
        if (field === 'countryCode') {
          await comboBoxSelector(
            'addresses-countryCode',
            invalidValues.countryCode
              ? countryList[invalidValues.countryCode]
              : ''
          );
        } else {
          await setInputValue({
            selector: getFieldValueSelector(field, true),
            newValue: invalidValues[field],
          });
        }
        // submit also validates the form
        await clickElement(submitButtonSelector);
        await waitForElementAttributeValue(elementGetter, 'aria-invalid', true);
        // error element and list are found
        expect(errorElementGetter).not.toThrow();
        expect(errorListElementGetter).not.toThrow();
        // set valid value
        if (field === 'countryCode') {
          await comboBoxSelector(
            'addresses-countryCode',
            countryList[validAddressValues.countryCode]
          );
        } else {
          await setInputValue({
            selector: getFieldValueSelector(field, true),
            newValue: validAddressValues[field],
          });
        }
        await waitForElementAttributeValue(
          elementGetter,
          'aria-invalid',
          false
        );
        // error element and list are not found
        expect(errorElementGetter).toThrow();
        expect(errorListElementGetter).toThrow();
      });
    });
  });
  it('When there is no address, an add button is rendered and an address can be added', async () => {
    await act(async () => {
      const profileWithoutAddresses = getProfileWithoutAddresses();
      const testTools = await initTests(profileWithoutAddresses);
      const {
        clickElement,
        getElement,
        submit,
        getTextOrInputValue,
      } = testTools;

      // edit button is not rendered
      expect(() => getElement(selectors.editButton)).toThrow();

      // info text is shown instead of an address
      await expect(getTextOrInputValue(selectors.noDataText)).resolves.toBe(
        t('profileInformation.noAddresses')
      );
      // click add button to create an address
      await clickElement(selectors.addButton);
      await setValuesToInputs(testTools, validAddressValues);

      // create the graphQL response
      const profileWithAddress = getProfileWithAddress(validAddressValues);

      // add the graphQL response
      responses.push({ updatedProfileData: profileWithAddress });

      const waitForAfterSaveNotification: WaitForElementAndValueProps = {
        selector: { id: `${dataType}-edit-notifications` },
        value: t('notification.saveSuccess'),
      };

      await submit({
        skipDataCheck: true,
        waitForAfterSaveNotification,
      });

      await verifyValuesFromElements(testTools, validAddressValues);
    });
  });
  it(`When removing an address, a confirmation modal is shown. 
      Remove error is handled and shown.
      When removal is complete, add button is shown and a text about no addresses.`, async () => {
    await act(async () => {
      const profileWithoutAddresses = getProfileWithoutAddresses();
      const profileWithAddress = getProfileWithAddress(validAddressValues);

      const {
        clickElement,
        getElement,
        waitForElementAndValue,
        waitForElement,
      } = await initTests(profileWithAddress);

      // add error response
      responses.push({
        errorType: 'networkError',
      });
      // add the graphQL response
      responses.push({
        updatedProfileData: profileWithoutAddresses,
      });

      // click remove button, confirm removal and handle error
      await clickElement(selectors.removeButton);
      await waitForElement(selectors.confirmRemovalButton);
      await clickElement(selectors.confirmRemovalButton);

      await waitForElementAndValue({
        selector: { id: `${dataType}-edit-notifications` },
        value: t('notification.removeError'),
      });

      // start removal again
      await clickElement(selectors.removeButton);
      await waitForElement(selectors.confirmRemovalButton);
      await clickElement(selectors.confirmRemovalButton);

      await waitForElementAndValue({
        selector: { id: `${dataType}-edit-notifications` },
        value: t('notification.removeSuccess'),
      });
      // item is removed and also remove button
      expect(() => getElement(selectors.removeButton)).toThrow();
      expect(() => getElement(selectors.addButton)).not.toThrow();
      expect(() => getElement(selectors.noDataText)).not.toThrow();
    });
  });
  it(`When a new address is cancelled, nothing is saved and
      add button is shown and a text about no addresses.
      Focus is returned to add button`, async () => {
    await act(async () => {
      const profileWithoutAddresses = getProfileWithoutAddresses();
      const {
        clickElement,
        getElement,
        getTextOrInputValue,
        waitForElement,
      } = await initTests(profileWithoutAddresses);

      await clickElement(selectors.addButton);
      await waitForElement(selectors.cancelButton);
      await expect(
        getTextOrInputValue(getFieldValueSelector('address', true))
      ).resolves.toBe('');
      expect(() => getElement(selectors.removeButton)).toThrow();
      expect(() => getElement(selectors.addButton)).toThrow();

      await clickElement(selectors.cancelButton);

      expect(() => getElement(selectors.addButton)).not.toThrow();
      expect(() => getElement(selectors.noDataText)).not.toThrow();
      // focus is set to add button
      await waitForElementFocus(() => getElement(selectors.addButton));
    });
  });
});
