import React from 'react';
import { BrowserRouter } from 'react-router-dom';

import {
  mountWithProvider,
  updateWrapper,
} from '../../../../common/test/testUtils';
import authService from '../../../authService';
import OidcCallback from '../OidcCallback';

const mockedDefaultProps = {
  history: {
    replace: jest.fn(),
  },
};

const getWrapper = props =>
  mountWithProvider(
    <BrowserRouter>
      <OidcCallback {...mockedDefaultProps} {...props} />
    </BrowserRouter>
  );

const getHistoryReplaceCallArgument = () =>
  mockedDefaultProps.history.replace.mock.calls[0][0];

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: jest.fn().mockImplementation(() => mockedDefaultProps.history),
}));

describe('<OidcCallback />', () => {
  afterEach(() => {
    mockedDefaultProps.history.replace.mockReset();
  });

  it('as a user I want to see an error message about incorrect device time, because only I can fix it', async () => {
    jest
      .spyOn(authService, 'endLogin')
      .mockRejectedValue(new Error('iat is in the future'));

    const wrapper = getWrapper();

    await updateWrapper(wrapper);

    expect(
      getHistoryReplaceCallArgument().includes(
        'authentication.deviceTimeError.message'
      )
    ).toBe(true);
  });

  // eslint-disable-next-line max-len
  it('as a user I want to be informed when I deny permissions, because the application is unusable due to my choice', async () => {
    jest
      .spyOn(authService, 'endLogin')
      .mockRejectedValue(
        new Error(
          'The resource owner or authorization server denied the request'
        )
      );

    const wrapper = getWrapper();

    await updateWrapper(wrapper);

    expect(
      getHistoryReplaceCallArgument().includes(
        'authentication.permissionRequestDenied.message'
      )
    ).toBe(true);
  });

  describe('implementation details', () => {
    it('should call authService.endLogin', async () => {
      const authServiceEndLoginSpy = jest
        .spyOn(authService, 'endLogin')
        .mockResolvedValue();

      const wrapper = getWrapper();

      await updateWrapper(wrapper);

      expect(authServiceEndLoginSpy).toHaveBeenCalled();
    });

    it('should redirect user after successful login', async () => {
      jest.spyOn(authService, 'endLogin').mockResolvedValue();

      const wrapper = getWrapper();

      await updateWrapper(wrapper);

      expect(mockedDefaultProps.history.replace).toHaveBeenCalledTimes(1);
    });
  });
});
