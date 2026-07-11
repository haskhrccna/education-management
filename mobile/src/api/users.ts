import { usersContracts, adminContracts } from '@quran-review/shared';
import { contractClient, expectStatus } from './contract';

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  status: string;
  emailVerifiedAt?: string;
  createdAt: string;
}

export const usersApi = {
  getProfile: async (): Promise<UserProfile> => {
    // Pinned: GET /users/profile returns a RAW object (no success envelope).
    const res = expectStatus(await contractClient.call(usersContracts.getProfile), 200);
    return res.body as unknown as UserProfile;
  },

  listAll: async (): Promise<UserProfile[]> => {
    const res = expectStatus(
      await contractClient.call(adminContracts.listUsers, { query: { limit: 200 } as never }),
      200
    );
    return (res.body as unknown as { data: UserProfile[] }).data;
  },

  updateProfile: async (data: { firstName?: string; lastName?: string }) => {
    const res = expectStatus(await contractClient.call(usersContracts.updateProfile, { body: data as never }), 200);
    return res.body as unknown;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const res = expectStatus(
      await contractClient.call(usersContracts.changePassword, { body: { currentPassword, newPassword } as never }),
      200
    );
    return res.body as unknown;
  },
};
