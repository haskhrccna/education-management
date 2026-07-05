import { AnyRouteContract } from './types';
import { healthContracts } from './health.contracts';
import { authContracts } from './auth.contracts';

/** Every declared contract. Tests iterate this; an endpoint here but absent
 *  from the endpoint manifest (or vice versa, once its module is swapped) fails CI. */
export const contractRegistry: AnyRouteContract[] = [
  ...Object.values(healthContracts),
  ...Object.values(authContracts),
];
