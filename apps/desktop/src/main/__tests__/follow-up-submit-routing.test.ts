/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  hasActiveTurnAtSubmit,
  interruptBeforeRootSend,
  mergeWorkspaceReferences,
  shouldContinueRootSendAfterInterrupt,
} from '../../renderer/follow-up-submit-routing.js';

describe('follow-up submit routing', () => {
  it('uses the synchronous turn arm before React publishes streaming state', () => {
    assert.equal(
      hasActiveTurnAtSubmit({
        liveTurns: [{ turnId: 'turn-1' }],
        runningTurnIds: [],
      }),
      true,
    );
  });

  it('ignores a terminal projection whose only running id is the same turn', () => {
    assert.equal(
      hasActiveTurnAtSubmit({
        liveTurns: [{ turnId: 'turn-1', terminal: true }],
        runningTurnIds: ['turn-1'],
      }),
      false,
    );
  });

  it('treats a non-terminal buffer entry as active even when a terminal turn is retained', () => {
    assert.equal(
      hasActiveTurnAtSubmit({
        liveTurns: [
          { turnId: 'turn-1', terminal: true },
          { turnId: 'turn-2' },
        ],
        runningTurnIds: ['turn-1'],
      }),
      true,
    );
  });

  it('ignores multiple retained terminal turns whose running ids are already settled', () => {
    assert.equal(
      hasActiveTurnAtSubmit({
        liveTurns: [
          { turnId: 'turn-1', terminal: true },
          { turnId: 'turn-2', terminal: true },
        ],
        runningTurnIds: ['turn-1', 'turn-2'],
      }),
      false,
    );
  });

  it('treats a running turn outside the retained terminal buffer as active', () => {
    assert.equal(
      hasActiveTurnAtSubmit({
        liveTurns: [{ turnId: 'turn-1', terminal: true }],
        runningTurnIds: ['turn-1', 'turn-2'],
      }),
      true,
    );
  });

  it('refuses the root send when the active Session changes during interrupt', () => {
    assert.equal(
      shouldContinueRootSendAfterInterrupt({
        submittingSessionId: 'session-a',
        activeSessionId: 'session-b',
      }),
      false,
    );
    assert.equal(
      shouldContinueRootSendAfterInterrupt({
        submittingSessionId: 'session-a',
        activeSessionId: 'session-a',
      }),
      true,
    );
  });

  it('pins the submitting Session across an awaited interrupt before root send', async () => {
    const stopped: string[] = [];
    const activeIdRef = { current: 'session-a' as string | undefined };
    assert.equal(
      await interruptBeforeRootSend({
        sessionId: 'session-a',
        slashCommand: undefined,
        liveTurns: [{ turnId: 'turn-1' }],
        runningTurnIds: [],
        activeSessionId: () => activeIdRef.current,
        stop: async (sessionId) => {
          stopped.push(sessionId ?? '');
          activeIdRef.current = 'session-b';
          return true;
        },
      }),
      false,
    );
    assert.deepEqual(stopped, ['session-a']);
  });

  it('restores workspace references after queued text returns to the draft', () => {
    assert.deepEqual(
      mergeWorkspaceReferences(
        'preface\n\nreview @src/app.ts',
        undefined,
        [{
          kind: 'workspace_file',
          value: '@src/app.ts',
          label: 'src/app.ts',
          start: 7,
        }],
      ),
      [{ value: '@src/app.ts', start: 16 }],
    );
  });
});
