import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));
jest.mock('../../config', () => ({
  config: { firebaseProjectId: '', firebaseClientEmail: '', firebasePrivateKey: '', expoAccessToken: 'expo-secret' },
}));
jest.mock('../socket.service', () => ({ disconnectUserSockets: jest.fn(), sendToUser: jest.fn() }));

import { prisma } from '../../prisma/client';
import { sendPushNotification, sendPushToUser } from '../fcm.service';
import { saveDeviceToken } from '../users.service';
import { logoutUser } from '../auth.service';

const m = prisma as unknown as DeepMockProxy<PrismaClient>;
const EXPO = 'ExponentPushToken[abc123]';

const expoReply = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ data }) }) as unknown as Response;

describe('push delivery', () => {
  let fetchMock: jest.Mock;
  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock = jest.fn().mockResolvedValue(expoReply({ status: 'ok', id: 'ticket-1' }));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('sends Expo push tokens through the Expo push API', async () => {
    await sendPushNotification(EXPO, 'New grade', 'You scored 9/10', { type: 'grade' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://exp.host/--/api/v2/push/send');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer expo-secret');
    expect(JSON.parse(init.body)).toEqual({
      to: EXPO,
      title: 'New grade',
      body: 'You scored 9/10',
      data: { type: 'grade' },
      sound: 'default',
    });
  });

  it('forgets a token Expo reports as DeviceNotRegistered', async () => {
    fetchMock.mockResolvedValue(expoReply({ status: 'error', details: { error: 'DeviceNotRegistered' } }));
    await sendPushNotification(EXPO, 't', 'b');
    expect(m.user.updateMany).toHaveBeenCalledWith({ where: { deviceToken: EXPO }, data: { deviceToken: null } });
  });

  it('never throws when the push service is down', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    await expect(sendPushNotification(EXPO, 't', 'b')).resolves.toBeUndefined();
  });

  it('does not send raw FCM tokens to Expo (they use Firebase, which is unconfigured here)', async () => {
    await sendPushNotification('fcm-raw-token-xyz', 't', 'b');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sendPushToUser looks up the user's token and delivers", async () => {
    m.user.findUnique.mockResolvedValue({ deviceToken: EXPO } as never);
    await sendPushToUser('user-1', 'Hello', 'World');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('device token ownership', () => {
  beforeEach(() => jest.clearAllMocks());

  it('moves a token to the user who signed in last on that device', async () => {
    await saveDeviceToken('user-2', EXPO);
    expect(m.user.updateMany).toHaveBeenCalledWith({
      where: { deviceToken: EXPO, id: { not: 'user-2' } },
      data: { deviceToken: null },
    });
    expect(m.user.update).toHaveBeenCalledWith({ where: { id: 'user-2' }, data: { deviceToken: EXPO } });
  });

  it('clears the device token on logout, so a signed-out phone gets no pushes', async () => {
    await logoutUser('user-1');
    expect(m.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { refreshTokenHash: null, deviceToken: null },
    });
  });
});
