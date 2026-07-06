import { AnyRouteContract } from './types';
import { healthContracts } from './health.contracts';
import { authContracts } from './auth.contracts';
import { usersContracts } from './users.contracts';
import { adminContracts } from './admin.contracts';
import { schedulingContracts } from './scheduling.contracts';
import { learningContracts } from './learning.contracts';
import { mushafContracts } from './mushaf.contracts';
import { rosterContracts } from './roster.contracts';

/** Every declared contract. Tests iterate this; an endpoint here but absent
 *  from the endpoint manifest (or vice versa, once its module is swapped) fails CI. */
export const contractRegistry: AnyRouteContract[] = [
  ...Object.values(healthContracts),
  ...Object.values(authContracts),
  ...Object.values(usersContracts),
  ...Object.values(adminContracts),
  ...Object.values(schedulingContracts),
  ...Object.values(learningContracts),
  ...Object.values(mushafContracts),
  ...Object.values(rosterContracts),
];
