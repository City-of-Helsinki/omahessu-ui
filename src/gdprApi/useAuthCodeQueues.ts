import { useCallback, useMemo, useRef } from 'react';

import {
  QueueState,
  useActionQueue,
} from '../common/actionQueue/useActionQueue';
import {
  canResumeWithRedirectionCatcher,
  resumeQueueFromRedirectionCatcher,
} from './actions/redirectionHandlers';
import { isQueueWaitingForAuthCodeRedirection } from './actions/authCodeRedirectionHandler';
import {
  createPagePathWithFailedActionParams,
  isGdprCallbackUrl,
  useInternalRedirect,
} from './actions/utils';
import {
  resumeQueueFromNextCallbackDetector,
  shouldResumeWithAuthCodeCallback,
} from './actions/authCodeCallbackUrlDetector';
import {
  actionLogTypes,
  isGenericError,
} from '../common/actionQueue/actionQueueRunner';
import { QueueProps, getQueue } from './actions/queues';
import { storeQueue } from '../common/actionQueue/actionQueueStorage';
import { QueueController } from '../common/actionQueue/actionQueue';

export type CurrentPhase = keyof typeof currentPhases;

export const currentPhases = {
  idle: 'idle',
  running: 'running',
  error: 'error',
  complete: 'complete',
} as const;

export type NextPhase = keyof typeof nextPhases;

export const nextPhases = {
  waitForAction: 'waitForAction',
  resumeWithAuthCodes: 'resumeWithAuthCodes',
  resumeCallback: 'resumeCallback',
  stoppedInMidQueue: 'stoppedInMidQueue',
  restart: 'restart',
  start: 'start',
  waitForInternalRedirect: 'waitForInternalRedirect',
  waitForAuthCodeRedirect: 'waitForAuthCodeRedirect',
  redirectBackToStartPage: 'redirectBackToStartPage',
} as const;

export type QueueComponentState = QueueState & {
  currentPhase?: CurrentPhase;
  nextPhase?: NextPhase;
};

export type AuthCodeQueuesProps = {
  onCompleted?: (controller: QueueController, state: QueueState) => void;
  onError?: (controller: QueueController, state: QueueState) => void;
} & QueueProps;

export const authCodeQueuesStorageKey = 'authCodeQueue';

function useAuthCodeQueues({
  startPagePath,
  serviceName,
  queueName,
  onCompleted,
  onError,
}: AuthCodeQueuesProps): {
  canStart: () => boolean;
  startOrRestart: () => void;
  shouldRestart: () => boolean;
  shouldResumeWithAuthCodes: () => boolean;
  shouldHandleCallback: () => boolean;
  resume: () => boolean;
  hasError: boolean;
  isLoading: boolean;
  state: QueueComponentState;
} {
  const queueComponentState = useRef<QueueComponentState>({
    isComplete: false,
    hasError: false,
    isActive: false,
    lastActionType: undefined,
    lastLogType: undefined,
    currentPhase: undefined,
    nextPhase: undefined,
  });

  const queue = useMemo(
    () => getQueue({ startPagePath, serviceName, queueName }),
    [startPagePath, serviceName, queueName]
  );
  const queueHookProps = useActionQueue(queue, authCodeQueuesStorageKey);
  const { state } = queueHookProps;
  const queueRunner = queueHookProps.getQueueRunner();
  const internalRedirections = useInternalRedirect(queueRunner);

  /**
   * Current phases:
   * - idle: not action is running / active
   * - error: an action has failed
   * - complete: all actions are complete or one has failed.
   */

  const resolveCurrentPhase = useCallback(
    (targetState: QueueState): CurrentPhase => {
      if (targetState.lastLogType === actionLogTypes.error) {
        return currentPhases.error;
      }
      if (targetState.lastLogType && isGenericError(targetState.lastLogType)) {
        return currentPhases.error;
      }

      if (targetState.isComplete) {
        return 'complete';
      }

      return targetState.isActive ? currentPhases.running : currentPhases.idle;
    },
    []
  );

  /**
   * Next possible phases:
   * - waitForAction: non-essential action is running
   * - resumeWithAuthCodes: authcodes are fetched, resume from next action (redirectionCatcher)
   * - resumeCallback: the browser has returned from oidc server and queue should be resumed
   * - stoppedInMidQueue: queue is stopped in non-essential action. After the queue was restored from storage.
   * - restart: an action has failed and user should restart it
   * - start: user should start the queue
   * - waitForAuthCodeRedirect: there is a redirection to the oidc server on-going
   * - waitForInternalRedirect: there is a redirection on-going (other that listed above)
   * - redirectBackToStartPage: user should be (and will be) redirected back to the page where auth codes are needed.
   */

  const resolveNextPhase = useCallback(
    (currentPhase: CurrentPhase): NextPhase => {
      if (currentPhase === currentPhases.complete) {
        return nextPhases.restart;
      }
      const isOnGrprCallbackPage = isGdprCallbackUrl();
      if (currentPhase !== currentPhases.error) {
        if (isQueueWaitingForAuthCodeRedirection(queueRunner)) {
          // eslint-disable-next-line sonarjs/no-duplicate-string
          return nextPhases.waitForAuthCodeRedirect;
        }

        if (canResumeWithRedirectionCatcher(queueRunner)) {
          return isOnGrprCallbackPage
            ? nextPhases.redirectBackToStartPage
            : currentPhase === currentPhases.idle
            ? nextPhases.resumeWithAuthCodes
            : nextPhases.waitForInternalRedirect;
        }
        if (
          currentPhase === currentPhases.idle &&
          shouldResumeWithAuthCodeCallback(queueRunner)
        ) {
          return isOnGrprCallbackPage
            ? nextPhases.resumeCallback
            : nextPhases.stoppedInMidQueue;
        }
      }
      if (internalRedirections.check()) {
        return nextPhases.waitForInternalRedirect;
      }
      if (currentPhase === currentPhases.idle) {
        if (queueRunner.getComplete().length) {
          return nextPhases.stoppedInMidQueue;
        }
        return nextPhases.start;
      }
      if (currentPhase === currentPhases.error) {
        return isOnGrprCallbackPage
          ? nextPhases.redirectBackToStartPage
          : nextPhases.restart;
      }
      return nextPhases.waitForAction;
    },
    [queueRunner, internalRedirections]
  );

  const handleChange = useCallback(
    (newState: QueueState) => {
      const currentPhase = resolveCurrentPhase(newState);
      const nextPhase = resolveNextPhase(currentPhase);

      if (nextPhase === nextPhases.redirectBackToStartPage) {
        // if a redirection is stored in an action result,
        // it is stored in internalRedirections and
        // .check() returns false when redirection has been done and is pending.
        if (!internalRedirections.check()) {
          internalRedirections.redirect(
            createPagePathWithFailedActionParams(
              startPagePath,
              queueRunner.getFailed()
            )
          );
        }
      }
      const oldIsComplete = queueComponentState.current.isComplete;
      queueComponentState.current = {
        ...queueComponentState.current,
        ...newState,
        currentPhase,
        nextPhase,
      };
      if (queueComponentState.current.isComplete && !oldIsComplete) {
        storeQueue(authCodeQueuesStorageKey, null);
        const callback = newState.hasError ? onError : onCompleted;
        if (callback) {
          callback(queueRunner, newState);
        }
      }
    },
    [
      resolveCurrentPhase,
      resolveNextPhase,
      internalRedirections,
      queueRunner,
      startPagePath,
      onCompleted,
      onError,
    ]
  );

  handleChange(state);

  const startOrRestart = useCallback(() => {
    internalRedirections.reset();
    queueHookProps.reset();
    queueRunner.start();
  }, [queueRunner, queueHookProps, internalRedirections]);

  const canStart = () =>
    queueComponentState.current.currentPhase === 'idle' &&
    queueComponentState.current.nextPhase === nextPhases.start;

  const shouldRestart = () =>
    queueComponentState.current.nextPhase === nextPhases.restart ||
    (queueComponentState.current.currentPhase === 'idle' &&
      queueComponentState.current.nextPhase === nextPhases.stoppedInMidQueue);

  const resumeGdprCallback = useCallback(() => {
    if (queueComponentState.current.nextPhase !== nextPhases.resumeCallback) {
      return false;
    }
    return !!resumeQueueFromNextCallbackDetector(queueRunner);
  }, [queueRunner]);

  const resumeWithAuthCodes = useCallback(() => {
    if (
      queueComponentState.current.nextPhase !== nextPhases.resumeWithAuthCodes
    ) {
      return false;
    }
    return resumeQueueFromRedirectionCatcher(queueRunner);
  }, [queueRunner]);

  const resume = () => resumeWithAuthCodes() || resumeGdprCallback();

  const shouldResumeWithAuthCodes = () =>
    queueComponentState.current.nextPhase === nextPhases.resumeWithAuthCodes;

  const shouldHandleCallback = () =>
    queueComponentState.current.currentPhase === 'idle' &&
    queueComponentState.current.nextPhase === nextPhases.resumeCallback;

  return {
    startOrRestart,
    resume,
    canStart,
    shouldRestart,
    shouldResumeWithAuthCodes,
    shouldHandleCallback,
    hasError: queueComponentState.current.hasError,
    isLoading:
      queueComponentState.current.currentPhase === currentPhases.running,
    state: queueComponentState.current,
  };
}

export default useAuthCodeQueues;