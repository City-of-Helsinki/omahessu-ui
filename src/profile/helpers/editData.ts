import _ from 'lodash';

import {
  ProfileRoot,
  ProfileData,
  AddressNode,
  EmailNode,
  PhoneNode,
  PrimaryAddress,
  PrimaryEmail,
  PrimaryPhone,
  Language,
} from '../../graphql/typings';
import { formConstants } from '../constants/formConstants';
import getAddressesFromNode from '../helpers/getAddressesFromNode';
import getEmailsFromNode from '../helpers/getEmailsFromNode';
import getPhonesFromNode from '../helpers/getPhonesFromNode';

export type BasicDataValue = Pick<
  ProfileData,
  'firstName' | 'nickname' | 'lastName'
>;
export type AdditionalInformationValue = {
  language: Language;
};
export type AddressValue = Pick<
  AddressNode,
  'address' | 'city' | 'postalCode' | 'countryCode'
>;

export type EmailValue = Pick<EmailNode, 'email'>;
export type PhoneValue = Pick<PhoneNode, 'phone'>;

export type BasicDataSource = BasicDataValue & { id: ProfileData['id'] };
export type AdditionalInformationSource = Pick<ProfileData, 'id' | 'language'>;
export type EditDataProfileSource =
  | BasicDataSource
  | AdditionalInformationSource
  | AddressNode
  | PhoneNode
  | EmailNode;

export type MultiItemProfileNode = AddressNode | PhoneNode | EmailNode;

export const basicDataType = 'basic-data';
export const additionalInformationType = 'additional-information';

export type EditDataType =
  | 'phones'
  | 'emails'
  | 'addresses'
  | typeof basicDataType
  | typeof additionalInformationType;

export type EditDataValue =
  | BasicDataValue
  | AdditionalInformationValue
  | AddressValue
  | PhoneValue
  | EmailValue;

export type FormValues = {
  firstName: string;
  nickname: string;
  lastName: string;
  primaryEmail: PrimaryEmail;
  primaryAddress: PrimaryAddress;
  primaryPhone: PrimaryPhone;
  language: Language;
  addresses: AddressNode[];
  emails: EmailNode[];
  phones: PhoneNode[];
};

export const saveTypeSetPrimary = 'set-primary';

export type SaveType =
  | 'value'
  | typeof saveTypeSetPrimary
  | 'remove'
  | undefined;

export type EditData = {
  readonly id: string;
  readonly value: EditDataValue;
  readonly primary?: boolean;
  readonly saving: SaveType;
};

type Backups = {
  add: (item: EditData) => void;
  clean: (allItems: EditData[]) => void;
  get: (id: string) => EditData | undefined;
};

export type EditFunctions = {
  create: (newProfileData: EditDataProfileSource) => EditData;
  getEditData: () => EditData[];
  updateItemAndCreateSaveData: (
    targetItem: EditData,
    newValue: EditDataValue
  ) => Partial<FormValues>;
  updateData: (newProfileRoot: ProfileRoot) => boolean;
  updateAfterSavingError: (id: string) => boolean;
  resetItem: (targetItem: EditData) => boolean;
};

function isMultiItemDataType(dataType: EditDataType): boolean {
  return !(
    dataType === basicDataType || dataType === additionalInformationType
  );
}

function isSaving(allItems: EditData[]): boolean {
  return !!allItems.find(item => !!item.saving);
}

function getNewItem(allItems: EditData[]): EditData | undefined {
  return allItems.find(item => item.id === '');
}

function hasNewItem(allItems: EditData[]): boolean {
  return !!getNewItem(allItems);
}

function getValueProps(dataType: EditDataType): string[] {
  if (dataType === 'phones') {
    return ['phone'];
  } else if (dataType === 'emails') {
    return ['email'];
  } else if (dataType === 'addresses') {
    return ['postalCode', 'address', 'city', 'countryCode'];
  } else if (dataType === basicDataType) {
    return ['firstName', 'nickname', 'lastName'];
  } else {
    return ['language'];
  }
}

export function pickValue(
  profileDataItem: EditDataProfileSource,
  dataType: EditDataType
): EditDataValue {
  const pickProps = getValueProps(dataType);
  return _.pick(profileDataItem, pickProps) as EditDataValue;
}

function createNewItem(
  profileData: EditDataProfileSource,
  dataType: EditDataType,
  overrides?: { value?: EditDataValue; saving?: SaveType }
): EditData {
  return {
    id: profileData.id,
    primary: (profileData as MultiItemProfileNode).primary,
    value: pickValue(profileData, dataType),
    saving: undefined,
    ...overrides,
  };
}

export function pickSources(
  profileData: ProfileData,
  dataType: EditDataType
): EditDataProfileSource[] {
  if (!isMultiItemDataType(dataType)) {
    const values = pickValue(profileData, dataType) as BasicDataValue &
      AdditionalInformationValue;
    return [{ ...values, id: profileData.id }];
  } else {
    const getter =
      dataType === 'phones'
        ? getPhonesFromNode
        : dataType === 'emails'
        ? getEmailsFromNode
        : getAddressesFromNode;
    const nodes: MultiItemProfileNode[] = getter(
      { myProfile: profileData },
      true
    );
    return nodes.map(node => ({ ...node }));
  }
}

function cloneAndMutateItem(
  data: EditData,
  overrides?: Partial<EditData>
): EditData {
  return {
    ...data,
    ...overrides,
  };
}

function findItemIndex(
  allItems: EditData[],
  idOrEditData: string | EditData
): number {
  const itemId =
    typeof idOrEditData === 'string' ? idOrEditData : idOrEditData.id;
  return allItems.findIndex(item => itemId === item.id);
}

function findItem(allItems: EditData[], id: string): EditData | undefined {
  return allItems.find(item => id === item.id);
}

function updateItemAndCloneList(
  allItems: EditData[],
  item: EditData,
  newValue: EditDataValue,
  saving?: SaveType
): EditData[] {
  const index = findItemIndex(allItems, item.id);
  if (index < 0) {
    throw new Error('Item not found in updateItemAndCloneList() ');
  }
  const updatedItem = cloneAndMutateItem(item, {
    value: newValue,
    saving: saving || undefined,
  });
  const newList = _.cloneDeep(allItems);
  newList[index] = updatedItem;
  return newList;
}

export function createNewProfileNode<T extends MultiItemProfileNode>(
  dataType: EditDataType,
  overrides?: Partial<T>
): T {
  return {
    ...(formConstants.EMPTY_VALUES[dataType] as T),
    ...overrides,
  };
}

function createFormValues(
  allItems: EditData[],
  dataType: EditDataType
): Partial<FormValues> {
  if (!isMultiItemDataType(dataType)) {
    const value = allItems[0].value as
      | BasicDataValue
      | AdditionalInformationValue;
    return {
      ...value,
    };
  } else {
    const nodes = allItems
      .filter(item => item.saving !== 'remove')
      .map(item =>
        createNewProfileNode(dataType, {
          ...item.value,
          primary: item.primary,
        })
      );
    return {
      [dataType]: nodes,
    };
  }
}

function hasItemUpdated(
  item: EditData,
  dataType: EditDataType,
  profileData: EditDataProfileSource
): boolean {
  const { saving } = item;
  if (!saving) {
    return false;
  }
  if (saving === 'value') {
    const profileDataValue = pickValue(profileData, dataType) as BasicDataValue;
    return _.isEqual(item.value, profileDataValue);
  }
  if (saving === saveTypeSetPrimary) {
    return _.isEqual(
      item.primary,
      (profileData as MultiItemProfileNode).primary
    );
  }
  return false;
}

export function updateItems(
  allItems: EditData[],
  profileDataItems: EditDataProfileSource[],
  dataType: EditDataType
): EditData[] | null {
  let dataHasUpdated = false;
  const newList: EditData[] = [];
  let newItem = getNewItem(allItems);
  profileDataItems.forEach(profileDataItem => {
    const existingItem = findItem(allItems, profileDataItem.id);
    const newValue = pickValue(profileDataItem, dataType);
    if (existingItem) {
      const itemHasUpdated = hasItemUpdated(
        existingItem,
        dataType,
        profileDataItem
      );
      if (itemHasUpdated) {
        const copy = createNewItem(profileDataItem, dataType, {
          saving: undefined,
        });
        newList.push(copy);
        dataHasUpdated = true;
      } else {
        newList.push(existingItem);
      }
    } else {
      if (newItem && _.isEqual(newItem.value, newValue)) {
        dataHasUpdated = true;
        newItem = undefined;
      }
      const copy = createNewItem(profileDataItem, dataType);
      newList.push(copy);
    }
  });
  if (newItem) {
    newList.push(newItem);
  }
  if (!dataHasUpdated && allItems.length !== profileDataItems.length) {
    dataHasUpdated = true;
  }
  return dataHasUpdated ? newList : null;
}

function createBackups(): Backups {
  const backups: Map<string, EditData> = new Map();
  const add: Backups['add'] = (item: EditData) => {
    const clone = cloneAndMutateItem(item);
    backups.set(clone.id, clone);
  };
  const get: Backups['get'] = id => backups.get(id);
  const clean: Backups['clean'] = allItems => {
    if (!allItems.length) {
      backups.clear();
      return;
    }
    allItems.forEach(item => {
      if (!item.saving) {
        backups.delete(item.id);
      }
    });
    if (!hasNewItem(allItems)) {
      backups.delete('');
    }
  };
  return {
    add,
    get,
    clean,
  };
}

export function createEditorForDataType(
  profileRoot: ProfileRoot,
  dataType: EditDataType
): EditFunctions {
  const profileData = profileRoot.myProfile as ProfileData;
  const profileDataSources = pickSources(profileData, dataType);
  let allItems: EditData[] = profileDataSources.map(source =>
    createNewItem(source, dataType)
  );
  const preventDoubleEdits = (item: EditData): void => {
    if (item.saving) {
      throw new Error(
        'Data is being saved. Cannot edit before save is complete'
      );
    }
  };
  const backups = createBackups();
  return {
    create: newProfileData => createNewItem(newProfileData, dataType),
    getEditData: () => allItems,
    updateItemAndCreateSaveData: (targetItem, newValue) => {
      preventDoubleEdits(targetItem);
      backups.add(targetItem);
      allItems = updateItemAndCloneList(
        allItems,
        targetItem,
        newValue,
        'value'
      );
      return createFormValues(allItems, dataType);
    },
    updateData: (newProfileRoot: ProfileRoot) => {
      const newSources = pickSources(
        newProfileRoot.myProfile as ProfileData,
        dataType
      );
      if (!newSources.length) {
        if (allItems.length) {
          backups.clean(allItems);
          allItems = [];
          return true;
        }
        return false;
      }
      if (!isSaving(allItems)) {
        return false;
      }

      const newList = updateItems(allItems, newSources, dataType);
      if (newList) {
        backups.clean(newList);
        allItems = newList;
      }
      return !!newList;
    },
    updateAfterSavingError: id => {
      const targetItem = findItem(allItems, id);
      if (!targetItem) {
        throw new Error('Target not found for updateAfterSavingError() ');
      }
      if (!targetItem.saving) {
        return false;
      }
      allItems = updateItemAndCloneList(allItems, targetItem, targetItem.value);
      return true;
    },
    resetItem: targetItem => {
      const backup = backups.get(targetItem.id);
      if (!backup) {
        return false;
      }
      if (_.isEqual(backup.value, targetItem.value)) {
        return false;
      }
      allItems = updateItemAndCloneList(allItems, targetItem, backup.value);
      return true;
    },
  };
}