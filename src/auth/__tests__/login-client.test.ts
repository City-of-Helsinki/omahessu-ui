import { waitFor } from '@testing-library/react';
import fetchMock from 'jest-fetch-mock';
import { OidcClient, SigninResponse, User, UserManager } from 'oidc-client-ts';

import { enableActualHttpPoller } from '../__mocks__/http-poller';
import openIdConfiguration from '../../common/test/openIdConfiguration.json';
import apiTokens from '../../common/test/apiTokens.json';
import createLoginClient, {
  LoginClient,
  LoginClientProps,
  LoginProps,
  LogoutProps,
  getUserStoreKey,
} from '../login-client';
import { API_TOKEN_SESSION_STORAGE_KEY, TokenData } from '../api-token-client';
import LoginClientError from '../login-client-error';
import { HttpPoller, HttpPollerProps } from '../http-poller';

type TestProps = {
  validUser: boolean;
  userProps?: Partial<User>;
};

type UserCreationProps = {
  valid?: boolean;
  expired?: boolean;
};

type PublicUserManagerEvents = {
  _userUnloaded: {
    raise: () => Promise<void>;
  };
  _userSignedOut: {
    raise: () => Promise<void>;
  };
};

let mockManuallyTriggerApiTokenResult = false;
const apiTokenFetchDelayInMs = 100;
const sessionPollingIntervalInMs = 500;
const mockedApiTokenResponses: (TokenData | LoginClientError)[] = [];

const spyOnSessionPoller = (sessionPoller: HttpPoller) => {
  const startSpy = jest.spyOn(sessionPoller, 'start');
  const stopSpy = jest.spyOn(sessionPoller, 'stop');
  return {
    removeMocks: () => {
      startSpy.mockRestore();
      stopSpy.mockRestore();
    },
    getStartCallCount: () => startSpy.mock.calls.length,
    getStopCallCount: () => stopSpy.mock.calls.length,
    jumpToNextPoll: () => {
      jest.advanceTimersByTime(sessionPollingIntervalInMs + 1);
    },
  };
};

const resetSessionPollerSpy = () => ({
  removeMocks: jest.fn(),
  getStartCallCount: () => 0,
  getStopCallCount: () => 0,
  jumpToNextPoll: () => {
    throw new Error('poller not used');
  },
});

let mockSessionPollerFunctions: ReturnType<typeof spyOnSessionPoller> = resetSessionPollerSpy();
// eslint-disable-next-line sonarjs/no-duplicate-string
const mockActualHttpPoller = jest.requireActual('../http-poller');
jest.mock('../http-poller', () => ({
  __esModule: true,
  default: (props: HttpPollerProps) => {
    const poller = mockActualHttpPoller.default(props) as HttpPoller;
    if (mockSessionPollerFunctions) {
      mockSessionPollerFunctions.removeMocks();
    }
    mockSessionPollerFunctions = spyOnSessionPoller(poller);
    return poller;
  },
}));

describe('loginClient', () => {
  let loginClient: LoginClient;
  let userManager: UserManager;
  let currentUser: User;
  const authority = 'https://api.hel.fi/sso/openid';
  const client_id = 'test-client';
  const scope = 'openid profile';
  const accessToken = 'db237bc3-e197-43de-8c86-3feea4c5f886';
  const idToken = 'abcd1234-0000-43de-8c86-3feea4c5f886';
  const refreshToken = '1234zyxp-1111-43de-8c86-3feea4c5f886';
  const tokenExpirationTimeInSeconds = 100;
  const accessTokenExpiringNotificationTimeInSeconds = 10;

  const defaultTestProps: LoginClientProps = {
    userManagerSettings: {
      authority,
      client_id,
      scope,
      accessTokenExpiringNotificationTimeInSeconds,
    },
    apiTokenUrl: `${window._env_.REACT_APP_OIDC_AUTHORITY}api-tokens/`,
    sessionPollingIntervalInMs,
  };

  const createSignInResponse = ({
    valid,
    expired,
  }: UserCreationProps): SigninResponse => {
    const nowAsSeconds = Math.round(Date.now() / 1000);
    const expires_in = expired !== true ? tokenExpirationTimeInSeconds : -1;
    const expires_at = nowAsSeconds + expires_in;
    return {
      access_token: valid !== false ? accessToken : '',
      code: 'code',
      error: null,
      error_description: null,
      error_uri: null,
      expires_at,
      id_token: valid !== false ? idToken : '',
      profile: {
        sub: 'sub',
        iss: 'issuer',
        aud: 'aud',
        exp: expires_at,
        iat: nowAsSeconds,
        name: 'Test User',
      },
      refresh_token: valid !== false ? refreshToken : '',
      scope,
      session_state: String(`${Math.random()}${Math.random()}`),
      state: '',
      token_type: 'Bearer',
      userState: {},
      expires_in,
      isOpenId: true,
    };
  };

  const createUser = (props: UserCreationProps = {}): User => {
    const response = createSignInResponse(props);
    const user = {
      ...response,
      expired: false,
    };
    return ({
      ...user,
      toStorageString() {
        return JSON.stringify(this);
      },
    } as unknown) as User;
  };

  const placeUserToUserManager = async (
    targetUserManager: UserManager,
    userProps: UserCreationProps = {}
  ) => {
    const user = createUser(userProps);
    await targetUserManager.storeUser(user);
    return Promise.resolve(user);
  };

  const placeUserToStorage = async (userProps: UserCreationProps = {}) => {
    const user = createUser(userProps);
    sessionStorage.setItem(
      getUserStoreKey({ authority, client_id }),
      JSON.stringify(user)
    );
    return user;
  };

  const removeUserFromStorage = async () => {
    sessionStorage.removeItem(getUserStoreKey({ authority, client_id }));
  };

  const mockSignInResponse = (
    targetUserManager: UserManager,
    userProps: UserCreationProps = {}
  ) => {
    const client = ((targetUserManager as unknown) as {
      _client: OidcClient;
    })._client;
    jest
      .spyOn(client, 'processSigninResponse')
      .mockImplementation(() =>
        Promise.resolve(createSignInResponse(userProps))
      );
  };

  const mockRefreshResponse = (
    targetUserManager: UserManager,
    userProps: UserCreationProps = {}
  ) => {
    const client = ((targetUserManager as unknown) as {
      _client: OidcClient;
    })._client;
    jest
      .spyOn(client, 'useRefreshToken')
      .mockImplementation(() =>
        Promise.resolve(createSignInResponse(userProps))
      );
  };

  const setSession = async ({
    validUser,
    userManager: currentUserManager,
    userProps,
  }: TestProps & { userManager: UserManager }): Promise<User> => {
    const user = await placeUserToUserManager(currentUserManager, {
      valid: validUser,
    });
    return user;
  };

  const initTests = async (
    testProps: TestProps,
    additionalLoginClientProps?: Partial<LoginClientProps>
  ): Promise<User> => {
    const loginClientProps = {
      ...defaultTestProps,
      ...additionalLoginClientProps,
    };
    loginClient = createLoginClient(loginClientProps);
    userManager = loginClient.getUserManager();
    currentUser = await setSession({ ...testProps, userManager });
    return currentUser;
  };

  const getFetchCalls = (path: string) =>
    fetchMock.mock.calls.filter(call => {
      const url = call[0];
      return String(url).includes(path);
    });

  const getApiTokenCalls = () => getFetchCalls('api-tokens');

  const returnOpenIdConfiguration = () =>
    Promise.resolve({
      body: JSON.stringify(openIdConfiguration),
      headers: {
        'content-type': 'application/json',
      },
    });

  const returnApiTokens = (tokens?: TokenData | LoginClientError) =>
    tokens && !(tokens instanceof Error)
      ? Promise.resolve({
          body: JSON.stringify(tokens),
        })
      : Promise.resolve({ status: 400 });

  const returnToken = () => {
    const response = JSON.stringify({
      access_token: '1d50132118664e568863a2263af4fd6d',
      refresh_token: '7c86f8b98ed64050a7b5c191bdf56934',
      token_type: 'bearer',
      expires_in: 3600,
      id_token: 'eyJmE2YmNiNmUtZWRjNi0xMWVhLTk2MjItYzJhNWQ3ODMxZjRlIiwiYXVkI',
    });
    return Promise.resolve({
      body: JSON.stringify(response),
      headers: {
        'content-type': 'application/json',
      },
    });
  };

  fetchMock.mockResponse(req => {
    if (req.url.includes('well-known')) {
      return returnOpenIdConfiguration();
    }
    if (req.url.includes('api-tokens')) {
      const response = mockedApiTokenResponses.shift();
      if (mockManuallyTriggerApiTokenResult) {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              body: JSON.stringify(response as TokenData),
            });
          }, apiTokenFetchDelayInMs);
        });
      }
      return returnApiTokens(response);
    }
    if (req.url.includes('openid/token')) {
      return returnToken();
    }
    return Promise.reject(`Unknown url ${req.url}`);
  });

  const createManualApiTokenCompletion = (): (() => void) => {
    mockManuallyTriggerApiTokenResult = true;
    return () => {
      mockManuallyTriggerApiTokenResult = false;
      jest.advanceTimersByTime(apiTokenFetchDelayInMs + 1);
    };
  };

  // loginClient.login redirects the browser.
  // The returned promise is never resolved.
  async function waitForLoginToTimeout(loginProps?: LoginProps) {
    await expect(() =>
      waitFor(() => loginClient.login(loginProps), {
        timeout: 1000,
      })
    ).rejects.toThrow();
  }

  // loginClient.logout redirects the browser.
  // The returned promise is never resolved.
  async function waitForLogoutToFinish(logoutProps?: LogoutProps) {
    await expect(() =>
      waitFor(() => loginClient.logout(logoutProps), { timeout: 1000 })
    ).rejects.toThrow();
  }

  const jumpToExpirationTime = () => {
    jest.advanceTimersByTime(
      (tokenExpirationTimeInSeconds -
        accessTokenExpiringNotificationTimeInSeconds) *
        1000 +
        5000
    );
  };

  const spyAndMockSigninRedirect = (user: User) =>
    jest
      .spyOn(userManager, 'signinRedirectCallback')
      .mockImplementation(() => Promise.resolve(user));

  afterEach(() => {
    sessionStorage.clear();
    jest.restoreAllMocks();
    mockedApiTokenResponses.length = 0;
    mockManuallyTriggerApiTokenResult = false;
  });

  beforeAll(() => {
    enableActualHttpPoller(jest.requireActual('../http-poller'));
  });
  /*
  afterAll(() => {
    disableActualHttpPoller();
  });

  */

  describe('getUser', () => {
    beforeEach(async () => initTests({ validUser: true }));
    it('should resolve to the user value which has been resolved from getUser', async () => {
      const user = loginClient.getUser();
      expect(user).toMatchObject(JSON.parse(currentUser.toStorageString()));
    });
  });

  describe('login', () => {
    beforeEach(async () => initTests({ validUser: true }));
    it('should call signinRedirect from oidc with the provided path', async () => {
      const path = '/applications';
      const signinRedirect = jest.spyOn(userManager, 'signinRedirect');
      await waitForLoginToTimeout({ state: { path } });
      expect(signinRedirect).toHaveBeenNthCalledWith(1, {
        state: { path },
        extraQueryParams: {},
      });
    });
    it('should add language to the login url', async () => {
      const signinRedirect = jest.spyOn(userManager, 'signinRedirect');
      await waitForLoginToTimeout({ language: 'sv' });
      expect(signinRedirect).toHaveBeenNthCalledWith(1, {
        extraQueryParams: {
          ui_locales: 'sv',
        },
      });
    });
  });

  describe('handleCallback', () => {
    it('should call signinRedirectCallback from oidc', async () => {
      await initTests({ validUser: true }, { apiTokenUrl: undefined });
      const signinRedirectCallback = spyAndMockSigninRedirect(currentUser);

      await loginClient.handleCallback();

      expect(signinRedirectCallback).toHaveBeenCalledTimes(1);
    });

    it('should return the same user object returned from signinRedirectCallback', async () => {
      await initTests({ validUser: true }, { apiTokenUrl: undefined });
      spyAndMockSigninRedirect(currentUser);

      const [user] = await loginClient.handleCallback();

      expect(user).toBe(currentUser);
    });

    it('should set the user to sessionStorage before the function returns', async () => {
      await initTests({ validUser: true }, { apiTokenUrl: undefined });
      const setSpy = jest.spyOn(Storage.prototype, 'setItem');
      mockSignInResponse(userManager);
      await loginClient.handleCallback();

      expect(setSpy).toHaveBeenCalledTimes(1);
    });

    it('should fetch apiTokens', async () => {
      await initTests({ validUser: true });
      mockedApiTokenResponses.push(apiTokens);
      mockSignInResponse(userManager);
      const [, tokens] = await loginClient.handleCallback();
      expect(getApiTokenCalls()).toHaveLength(1);
      expect(tokens).toMatchObject(apiTokens);
    });
  });
  describe('renewing user tokens', () => {
    beforeEach(async () => {
      await initTests({ validUser: true });
      mockedApiTokenResponses.push(apiTokens);
      mockedApiTokenResponses.push({
        'https://api.hel.fi/auth/helsinkiprofile': 'renewedToken',
      });
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });
    it('renewal also fetches apiTokens', async () => {
      const completeManualApiTokenFetch = createManualApiTokenCompletion();
      mockSignInResponse(userManager);
      mockRefreshResponse(userManager);
      const expirationListener = jest.fn();
      const loadListener = jest.fn();
      userManager.events.addAccessTokenExpiring(expirationListener);
      userManager.events.addUserLoaded(loadListener);

      const callbackPromise = loginClient.handleCallback();
      await waitFor(() => {
        expect(getApiTokenCalls()).toHaveLength(1);
      });
      completeManualApiTokenFetch();
      await callbackPromise;
      await waitFor(() => {
        expect(loadListener).toHaveBeenCalledTimes(1);
      });
      // login complete
      // renew
      const tokens = await loginClient.getUpdatedTokens();
      jumpToExpirationTime();
      const completeManualApiTokenFetch2 = createManualApiTokenCompletion();
      await waitFor(() => {
        expect(expirationListener).toHaveBeenCalledTimes(1);
        expect(loginClient.isRenewing()).toBeTruthy();
      });
      let middleOfRewalTokens: TokenData | null = null;
      completeManualApiTokenFetch2();
      const tokenPromise = loginClient
        .getUpdatedTokens()
        .then(returnedTokens => {
          middleOfRewalTokens = returnedTokens;
        });
      completeManualApiTokenFetch2();
      await waitFor(() => {
        expect(loadListener).toHaveBeenCalledTimes(2);
        expect(loginClient.isRenewing()).toBeFalsy();
      });
      // renewal complete
      await tokenPromise;
      await waitFor(() => {
        expect(!!middleOfRewalTokens).toBeTruthy();
      });
      const newTokens = await loginClient.getUpdatedTokens();
      expect(newTokens as TokenData).not.toMatchObject(tokens as TokenData);
      expect(newTokens as TokenData).toMatchObject(
        (middleOfRewalTokens as unknown) as TokenData
      );
    });
  });
  describe('Session polling ', () => {
    afterEach(() => {
      removeUserFromStorage();
      mockSessionPollerFunctions.removeMocks();
    });
    it('should start when .... is called and session is valid', async () => {
      placeUserToStorage();
      await initTests({ validUser: false }, { apiTokenUrl: undefined });
      expect(mockSessionPollerFunctions.getStartCallCount()).toBe(1);
    });
    it('should not start when .... is called and session is invalid', async () => {
      await initTests({ validUser: false }, { apiTokenUrl: undefined });
      expect(mockSessionPollerFunctions.getStartCallCount()).toBe(0);
    });
    it('should start in endLogin', async () => {
      await initTests({ validUser: true }, { apiTokenUrl: undefined });
      spyAndMockSigninRedirect(currentUser);
      await loginClient.handleCallback();
      expect(mockSessionPollerFunctions.getStartCallCount()).toBe(1);
    });
    it('should stop when user is unloaded', async () => {
      await initTests({ validUser: true }, { apiTokenUrl: undefined });
      spyAndMockSigninRedirect(currentUser);
      await loginClient.handleCallback();
      await ((userManager.events as unknown) as PublicUserManagerEvents)._userUnloaded.raise();
      await waitFor(() => {
        expect(mockSessionPollerFunctions.getStopCallCount()).toBe(1);
      });
    });
    it('should stop when user is signedOut', async () => {
      await initTests({ validUser: true }, { apiTokenUrl: undefined });
      spyAndMockSigninRedirect(currentUser);
      await loginClient.handleCallback();
      await ((userManager.events as unknown) as PublicUserManagerEvents)._userSignedOut.raise();
      await waitFor(() => {
        expect(mockSessionPollerFunctions.getStopCallCount()).toBe(1);
      });
    });
  });
  describe('logout', () => {
    afterEach(() => {
      loginClient.cleanUp();
    });
    beforeEach(async () => {
      await initTests({ validUser: true });
      mockedApiTokenResponses.push(apiTokens);
      spyAndMockSigninRedirect(currentUser);
      await loginClient.handleCallback();
    });
    it('should call signoutRedirect from oidc. Language is found in extraQueryParams', async () => {
      const signoutRedirectSpy = jest.spyOn(userManager, 'signoutRedirect');
      await waitForLogoutToFinish({ language: 'sv' });
      expect(signoutRedirectSpy).toHaveBeenCalledTimes(1);
      expect(signoutRedirectSpy).toHaveBeenNthCalledWith(1, {
        extraQueryParams: {
          ui_locales: 'sv',
        },
      });
    });

    it('should remove the tokens from sessionStorage', async () => {
      expect(
        sessionStorage.getItem(API_TOKEN_SESSION_STORAGE_KEY)
      ).not.toBeNull();
      await waitForLogoutToFinish();
      expect(sessionStorage.getItem(API_TOKEN_SESSION_STORAGE_KEY)).toBeNull();
    });

    it('should remove user, tokens and stop polling', async () => {
      await waitForLogoutToFinish();
      const [user, tokens] = loginClient.getStoredUserAndTokens();
      expect(user).toBeNull();
      expect(tokens).toBeNull();
      await waitFor(() => {
        expect(mockSessionPollerFunctions.getStopCallCount()).toBe(1);
      });
    });
  });
});