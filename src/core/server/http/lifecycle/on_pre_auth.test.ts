/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import Boom from 'boom';
import { adoptToHapiOnPreAuthFormat } from './on_pre_auth';

const requestMock = {} as any;
const createResponseToolkit = (customization = {}): any => ({ ...customization });

describe('adoptToHapiOnPreAuthFormat', () => {
  it('Should allow passing request to the next handler', async () => {
    const continueSymbol = {};
    const onPreAuth = adoptToHapiOnPreAuthFormat((req, t) => t.next());
    const result = await onPreAuth(
      requestMock,
      createResponseToolkit({
        ['continue']: continueSymbol,
      })
    );

    expect(result).toBe(continueSymbol);
  });

  it('Should support redirecting to specified url', async () => {
    const redirectUrl = '/docs';
    const onPreAuth = adoptToHapiOnPreAuthFormat((req, t) => t.redirected(redirectUrl));
    const takeoverSymbol = {};
    const redirectMock = jest.fn(() => ({ takeover: () => takeoverSymbol }));
    const result = await onPreAuth(
      requestMock,
      createResponseToolkit({
        redirect: redirectMock,
      })
    );

    expect(redirectMock).toBeCalledWith(redirectUrl);
    expect(result).toBe(takeoverSymbol);
  });

  it('Should support request forwarding to specified url', async () => {
    const redirectUrl = '/docs';
    const onPreAuth = adoptToHapiOnPreAuthFormat((req, t) =>
      t.redirected(redirectUrl, { forward: true })
    );
    const continueSymbol = {};
    const setUrl = jest.fn();
    const reqMock = { setUrl, raw: { req: {} } } as any;
    const result = await onPreAuth(
      reqMock as any,
      createResponseToolkit({
        ['continue']: continueSymbol,
      })
    );

    expect(setUrl).toBeCalledWith(redirectUrl);
    expect(reqMock.raw.req.url).toBe(redirectUrl);
    expect(result).toBe(continueSymbol);
  });

  it('Should support specifying statusCode and message for Boom error', async () => {
    const onPreAuth = adoptToHapiOnPreAuthFormat((req, t) => {
      return t.rejected(new Error('unexpected result'), { statusCode: 501 });
    });
    const result = (await onPreAuth(requestMock, createResponseToolkit())) as Boom;

    expect(result).toBeInstanceOf(Boom);
    expect(result.message).toBe('unexpected result');
    expect(result.output.statusCode).toBe(501);
  });

  it('Should return Boom.internal error if interceptor throws', async () => {
    const onPreAuth = adoptToHapiOnPreAuthFormat((req, t) => {
      throw new Error('unknown error');
    });
    const result = (await onPreAuth(requestMock, createResponseToolkit())) as Boom;

    expect(result).toBeInstanceOf(Boom);
    expect(result.message).toBe('unknown error');
    expect(result.output.statusCode).toBe(500);
  });

  it('Should return Boom.internal error if interceptor returns unexpected result', async () => {
    const onPreAuth = adoptToHapiOnPreAuthFormat((req, toolkit) => undefined as any);
    const result = (await onPreAuth(requestMock, createResponseToolkit())) as Boom;

    expect(result).toBeInstanceOf(Boom);
    expect(result.message).toMatchInlineSnapshot(
      `"Unexpected result from OnPreAuth. Expected OnPreAuthResult, but given: undefined."`
    );
    expect(result.output.statusCode).toBe(500);
  });
});