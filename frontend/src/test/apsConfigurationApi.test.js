import { afterEach, expect, test, vi } from 'vitest';

import axiosInstance from '../api/axiosInstance';
import {
  getApsConfiguration,
  saveApsConfiguration,
} from '../features/aps/api/configuration';

afterEach(() => vi.restoreAllMocks());

test('reads the current authenticated user configuration through the existing API client', async () => {
  const response = { configured: false, configuration: null };
  const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: response });

  await expect(getApsConfiguration()).resolves.toEqual(response);
  expect(get).toHaveBeenCalledWith('/aps/configuration');
});

test('saves only the attempted configuration fields and returns the durable commit response', async () => {
  const attempted = {
    clientId: 'client-id',
    clientSecret: 'synthetic-secret',
    modelUrn: 'dGVzdC1tb2RlbA',
  };
  const response = {
    configured: true,
    configuration: {
      clientId: 'client-id',
      modelUrn: 'dGVzdC1tb2RlbA',
      hasClientSecret: true,
    },
    changeType: 'credential-replacement',
  };
  const put = vi.spyOn(axiosInstance, 'put').mockResolvedValue({ data: response });

  await expect(saveApsConfiguration(attempted)).resolves.toEqual(response);
  expect(put).toHaveBeenCalledWith('/aps/configuration', attempted);
});
